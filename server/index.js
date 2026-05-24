import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import PDFDocument from "pdfkit";
import { ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase, getDb, hashPassword, verifyPassword } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-change-in-production";
const isVercel = Boolean(process.env.VERCEL);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("Database request setup failed:", error);
    res.status(503).json({ error: "Database is not available" });
  }
});

// JWT utility functions
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: "15m" } // 15 minutes
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // 7 days
  );
}

// Middleware to verify JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired access token" });
    }
    req.user = decoded;
    next();
  });
}

// Middleware to verify refresh tokens
function authenticateRefreshToken(req, res, next) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }
    req.user = decoded;
    next();
  });
}

const MOOD_INTENSITY = {
  happy: 4,
  calm: 3,
  sad: 1,
  anxious: 2,
  angry: 1,
  grateful: 5,
  excited: 5,
  confused: 2,
};

const supportiveResponses = [
  "Thank you for sharing that. It takes real courage to put feelings into words. What feels heaviest about this right now?",
  "I hear you. What you are feeling matters, and it makes sense that this is sitting with you. What would help you feel a little more grounded today?",
  "That sounds like a lot to carry alone. We can take it one piece at a time. Do you want to talk more about what triggered it?",
  "I appreciate you trusting this space with something personal. If you want, we can turn this into a memory so you can reflect on it later.",
  "You do not need to solve everything at once. Let us pause with what is true for you right now. What is one small kind thing you can do for yourself next?",
];

function mapMemory(doc) {
  return {
    id: doc._id.toString(),
    content: doc.content,
    mood: doc.mood,
    createdAt: doc.createdAt,
  };
}

function mapMood(doc) {
  return {
    id: doc._id.toString(),
    mood: doc.mood,
    intensity: doc.intensity,
    entryDate: doc.entryDate,
    createdAt: doc.createdAt,
  };
}

function mapChatMessage(doc) {
  return {
    id: doc._id.toString(),
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt,
  };
}

function mapUser(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    createdAt: doc.createdAt,
  };
}

async function getUserFromTokenPayload(payload) {
  if (!payload?.userId) return null;

  const db = getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });
  return user;
}

function chooseResponse(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes("anx") || normalized.includes("stress") || normalized.includes("worried")) {
    return "It sounds like anxiety is taking up a lot of space right now. Try one slow breath in and out, then tell me what feels most urgent.";
  }

  if (normalized.includes("sad") || normalized.includes("hurt") || normalized.includes("cry")) {
    return "That sounds painful, and I am sorry you are carrying it. You do not have to rush past it here. What happened just before this feeling got strongest?";
  }

  if (normalized.includes("happy") || normalized.includes("grateful") || normalized.includes("excited")) {
    return "I am glad you shared that bright moment. Holding onto good experiences matters too. What made this one feel especially meaningful?";
  }

  return supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)];
}

function formatHumanDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function summarizeThought(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0];
  const summary = firstSentence || normalized;
  return summary.length > 180 ? `${summary.slice(0, 177)}...` : summary;
}

function toSentenceCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinWithAnd(items) {
  const cleaned = items.filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)}`;
}

function formatMoodBreakdown(moodCounts) {
  const entries = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return "No mood check-ins were logged during this period.";
  }

  return entries
    .map(([mood, count]) => `${toSentenceCase(mood)} appeared ${count} time${count === 1 ? "" : "s"}`)
    .join(", ");
}

function buildNarrativeFromEntries(entries, emptyMessage, prefix) {
  if (!entries.length) {
    return emptyMessage;
  }

  const examples = entries.slice(0, 3).map((entry) => summarizeThought(entry.content));
  return `${prefix} ${examples.join(" ")}`.trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLongParagraph(seedText, minimumSentences = 20) {
  const normalized = String(seedText || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const rawSentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!rawSentences.length) {
    rawSentences.push(normalized.endsWith(".") ? normalized : `${normalized}.`);
  }

  const expanded = [];
  while (expanded.length < minimumSentences) {
    const source = rawSentences[expanded.length % rawSentences.length];
    const needsFullStop = /[.!?]$/.test(source) ? source : `${source}.`;
    const variantIndex = Math.floor(expanded.length / rawSentences.length);

    if (variantIndex === 0) {
      expanded.push(needsFullStop);
      continue;
    }

    const sentenceWithoutStop = needsFullStop.replace(/[.!?]$/, "");
    const embellishments = [
      `This suggests that ${sentenceWithoutStop.charAt(0).toLowerCase()}${sentenceWithoutStop.slice(1)}.`,
      `In practical terms, ${sentenceWithoutStop.charAt(0).toLowerCase()}${sentenceWithoutStop.slice(1)}.`,
      `From the user's point of view, ${sentenceWithoutStop.charAt(0).toLowerCase()}${sentenceWithoutStop.slice(1)}.`,
      `As part of the broader journey, ${sentenceWithoutStop.charAt(0).toLowerCase()}${sentenceWithoutStop.slice(1)}.`,
    ];
    expanded.push(embellishments[(variantIndex - 1) % embellishments.length]);
  }

  return expanded.slice(0, minimumSentences).join(" ");
}

function buildDailyParagraph(dayDate, items, themes, moodsForDay) {
  const thoughtCount = items.length;
  const moodNames = [...new Set(items.map((item) => item.mood).filter(Boolean))];
  const highlightedThoughts = items.map((item) => summarizeThought(item.content));
  const repeatedIdeas = extractThemes(items).slice(0, 4);
  const moodDetails = moodsForDay.length
    ? `The mood check-ins for this day suggest an emotional tone of ${joinWithAnd(
        [...new Set(moodsForDay.map((item) => item.mood).filter(Boolean))]
      ) || "mixed feelings"}, which adds extra context to the written thoughts.`
    : "There were no separate mood check-ins stored for this date, so the emotional reading comes mainly from the thoughts themselves.";

  const baseParagraph = [
    `On ${dayDate}, the user captured ${thoughtCount} thought${thoughtCount === 1 ? "" : "s"}, creating a detailed snapshot of the day rather than a single isolated note.`,
    moodNames.length
      ? `Across those reflections, the dominant emotional language pointed toward ${joinWithAnd(moodNames)}, showing how the user's inner state moved alongside the events being remembered.`
      : "The reflections on this day were recorded without explicit mood labels, so the emotional tone must be inferred from the wording of the thoughts.",
    repeatedIdeas.length
      ? `The strongest ideas that surfaced on this day centered around ${joinWithAnd(repeatedIdeas)}, which appear to have shaped how the day was experienced and later remembered.`
      : themes.length
        ? `Even though the day did not repeat many keywords on its own, it still connects to the broader period themes of ${joinWithAnd(themes.slice(0, 4))}.`
        : "The day reads as personal and specific, with the meaning coming more from the full narrative than from repeated keywords.",
    ...highlightedThoughts.map((thought, index) => `Thought ${index + 1} from the day shows that ${thought.charAt(0).toLowerCase()}${thought.slice(1)}`),
    moodDetails,
    "Taken together, these entries read like a lived narrative in which feelings, events, and reflections are closely connected rather than separated into small disconnected notes.",
    "When someone looks back on this day later, this paragraph is meant to preserve not only what happened, but also how it felt, what stood out, and why the day mattered in the larger journey.",
  ].join(" ");

  return buildLongParagraph(baseParagraph, 20);
}

function buildNoThoughtsOverview(fromDate, toDate, moods, dominantMood) {
  const moodNames = [...new Set(moods.map((item) => item.mood).filter(Boolean))];
  const baseParagraph = [
    `No thoughts were recorded between ${formatHumanDate(fromDate)} and ${formatHumanDate(toDate)}, so this report is being built without direct written reflections from the user for that selected period.`,
    "Even in the absence of thought entries, the report still serves an important purpose because it marks a real stretch of time in the user's journey and preserves the fact that this period existed, whether it was busy, quiet, emotionally heavy, or simply undocumented in writing.",
    moods.length
      ? `During the same period, ${moods.length} mood check-in${moods.length === 1 ? "" : "s"} were logged, which suggests that the emotional tone still leaned toward ${dominantMood} and included ${joinWithAnd(moodNames) || "a range of feelings"} even though those experiences were not expanded into full written notes.`
      : "There were also no mood check-ins stored in the selected range, which means this section is documenting a genuine gap in saved data rather than interpreting emotional patterns from incomplete evidence.",
    "This kind of gap does not mean the journey stopped. It more likely means the user was occupied with living through events in real time and did not pause to record them in detail.",
    "For a memory-based application, moments like this are still meaningful because they highlight how real life often moves faster than documentation, and that is exactly why having an automatic reporting system matters.",
    "When this report is read later, the absence of entries can itself become part of the story, showing that some periods were full of action, change, or emotion but were not translated into words at the time they happened.",
    "That makes this summary less of a missing page and more of a marker in the timeline, acknowledging that the user's life continued even when the journal was quiet.",
    "If the user returns to this period later with new memories, conversations, or reflections, the surrounding dates in the app can still help reconnect those experiences to the right place in the broader journey.",
    "In that sense, the report remains useful because it preserves continuity and creates a documented bridge between earlier recorded thoughts and later ones.",
    "The main takeaway from this executive summary is that the chosen date range did not include written thought dumps, but it still represents a meaningful chapter in the user's ongoing life story and emotional timeline.",
  ].join(" ");

  return buildLongParagraph(baseParagraph, 20);
}

function buildNoThoughtsDailyJourney(fromDate, toDate, moods, dominantMood) {
  const moodNames = [...new Set(moods.map((item) => item.mood).filter(Boolean))];
  const baseParagraph = [
    `Across the selected period from ${formatHumanDate(fromDate)} to ${formatHumanDate(toDate)}, no daily thought entries were available to transform into specific day-by-day narratives.`,
    "Because of that, this section cannot describe individual events in the user's own words, yet it still reflects an important truth: the days passed, experiences accumulated, and the journey continued even though those moments were not written down at the time.",
    moods.length
      ? `The available mood data suggests that the period carried a generally ${dominantMood} tone, with emotional check-ins touching on ${joinWithAnd(moodNames) || "several feelings"}, which offers at least some indirect understanding of what the user may have been moving through each day.`
      : "Since there were no mood entries either, this section stands as a simple but honest placeholder for a stretch of life that was lived but not documented inside the app.",
    "This is still valuable for long-term reflection because a person's life journey is not only made of the days they wrote about, but also the days they were too busy, too tired, too overwhelmed, or too focused on living to stop and write.",
    "Looking back later, a quiet section like this may remind the user of a transition period, a demanding week, a recovery phase, or a stretch of routine that felt too ordinary to capture in words while it was happening.",
    "The absence of entries can therefore be read not as failure, but as evidence that the app is tracking a real human pattern in which documentation comes and goes while life keeps moving.",
    "If future reports contain richer daily reflections before and after this range, this empty section will still help show the rhythm of the user's journey over time, including when they were expressive and when they were silent.",
    "That continuity matters, because it makes the archive more honest and more personal than a perfectly complete journal would be.",
    "For now, this daily journey section preserves the selected dates as part of the user's timeline and leaves room for those days to gain fuller meaning whenever the user remembers them later.",
    "In a long-term memory companion, even silence is part of the story, and this paragraph is here to make sure that silence is still represented with dignity and context.",
  ].join(" ");

  return buildLongParagraph(baseParagraph, 20);
}

function buildDocumentationData(memories, moods, fromDate, toDate, label) {
  const moodCounts = moods.reduce((acc, item) => {
    acc[item.mood] = (acc[item.mood] || 0) + 1;
    return acc;
  }, {});
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";
  const themes = extractThemes(memories);
  const timeline = [...memories].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const groupedMoodsByDay = moods.reduce((acc, item) => {
    const key = String(item.entryDate || item.createdAt || "").slice(0, 10);
    if (key) {
      acc[key] ??= [];
      acc[key].push(item);
    }
    return acc;
  }, {});
  const groupedByDay = timeline.reduce((acc, item) => {
    const key = item.createdAt.slice(0, 10);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});

  const overview = memories.length
    ? `This report covers the period from ${formatHumanDate(fromDate)} to ${formatHumanDate(toDate)}. During that time, the user recorded ${memories.length} thought${memories.length === 1 ? "" : "s"} across ${Object.keys(groupedByDay).length} active day${Object.keys(groupedByDay).length === 1 ? "" : "s"}. The overall emotional direction leans toward ${dominantMood}, and the most visible repeating themes include ${joinWithAnd(themes.slice(0, 4)) || "personal reflection, growth, and everyday experience"}. The purpose of this document is to turn short thought entries into a fuller account of the user's journey so it can be revisited later as a readable record.`
    : buildNoThoughtsOverview(fromDate, toDate, moods, dominantMood);

  const dailySections = Object.entries(groupedByDay).map(([dateKey, items]) => ({
    key: dateKey,
    title: formatHumanDate(new Date(`${dateKey}T00:00:00.000Z`)),
    paragraph: buildDailyParagraph(
      formatHumanDate(new Date(`${dateKey}T00:00:00.000Z`)),
      items,
      themes,
      groupedMoodsByDay[dateKey] || []
    ),
  }));

  return {
    label,
    fromDate,
    toDate,
    overview,
    dominantMood,
    totalMemories: memories.length,
    totalMoods: moods.length,
    themes,
    dailySections,
    emptyDailyJourneyParagraph: buildNoThoughtsDailyJourney(fromDate, toDate, moods, dominantMood),
  };
}

function renderPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: report.label,
        Author: "Memory Dump",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ensurePageSpace = (minimumHeight = 140) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - minimumHeight) {
        doc.addPage();
      }
    };

    const addHeading = (text, size = 15, color = "#8a4b12") => {
      ensurePageSpace();
      doc.moveDown(0.7);
      doc.font("Helvetica-Bold").fontSize(size).fillColor(color).text(text, { align: "left" });
      doc.moveDown(0.2);
    };

    const addParagraph = (text, options = {}) => {
      ensurePageSpace(90);
      doc.font("Helvetica").fontSize(11).fillColor("#2b2117").text(text, {
        align: "justify",
        lineGap: 4,
        paragraphGap: 10,
        ...options,
      });
      doc.moveDown(0.35);
    };

    doc.font("Helvetica-Bold").fontSize(22).fillColor("#8a4b12").text("Memory Dump Journey Documentation", {
      align: "left",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).fillColor("#5d5246").text(`Report Type: ${report.label}`);
    doc.text(`From: ${formatHumanDate(report.fromDate)}`);
    doc.text(`To: ${formatHumanDate(report.toDate)}`);
    doc.text(`Thought Entries: ${report.totalMemories}`);
    doc.text(`Mood Entries: ${report.totalMoods}`);
    doc.text(`Dominant Mood: ${report.dominantMood}`);

    addHeading("Executive Summary");
    addParagraph(report.overview);

    addHeading("Daily Journey");
    if (report.dailySections.length) {
      report.dailySections.forEach((section) => {
        addHeading(section.title, 13, "#5b3716");
        addParagraph(section.paragraph);
      });
    } else {
      addParagraph(report.emptyDailyJourneyParagraph);
    }

    doc.end();
  });
}

function extractThemes(memories) {
  const stopwords = new Set([
    "about", "after", "again", "almost", "also", "always", "because", "before", "being", "between",
    "could", "did", "does", "done", "each", "felt", "from", "have", "into", "just", "like", "made",
    "make", "more", "most", "need", "really", "should", "some", "still", "that", "their", "them",
    "then", "there", "these", "they", "this", "thought", "today", "tomorrow", "very", "want", "went",
    "were", "what", "when", "with", "work", "would", "your",
  ]);

  const counts = new Map();
  for (const memory of memories) {
    const words = String(memory.content || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopwords.has(word));

    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

// Auth routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const db = getDb();
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    const hashedPassword = await hashPassword(password);
    const user = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("users").insertOne(user);
    const newUser = { ...user, _id: result.insertedId };

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.status(201).json({
      user: mapUser(newUser),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      user: mapUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/refresh", authenticateRefreshToken, async (req, res) => {
  try {
    const user = await getUserFromTokenPayload(req.user);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await getUserFromTokenPayload(req.user);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user: mapUser(user) });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected routes
app.get("/api/memories", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const memories = await db.collection("memories")
      .find({ userId: new ObjectId(req.user.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(memories.map(mapMemory));
  } catch (error) {
    console.error("Get memories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/memories", authenticateToken, async (req, res) => {
  try {
    const { content, mood } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const db = getDb();
    const memory = {
      userId: new ObjectId(req.user.userId),
      content,
      mood: mood || null,
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("memories").insertOne(memory);
    const newMemory = { ...memory, _id: result.insertedId };

    res.status(201).json(mapMemory(newMemory));
  } catch (error) {
    console.error("Create memory error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/memories/:id", authenticateToken, async (req, res) => {
  try {
    const { content, mood } = req.body;
    const memoryId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const db = getDb();
    const result = await db.collection("memories").updateOne(
      { _id: new ObjectId(memoryId), userId: new ObjectId(req.user.userId) },
      { $set: { content, mood: mood || null } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    const updatedMemory = await db.collection("memories").findOne({ _id: new ObjectId(memoryId) });
    res.json(mapMemory(updatedMemory));
  } catch (error) {
    console.error("Update memory error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/memories/:id", authenticateToken, async (req, res) => {
  try {
    const memoryId = req.params.id;
    const db = getDb();

    const result = await db.collection("memories").deleteOne({
      _id: new ObjectId(memoryId),
      userId: new ObjectId(req.user.userId)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Delete memory error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/moods", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const moods = await db.collection("moods")
      .find({ userId: new ObjectId(req.user.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(moods.map(mapMood));
  } catch (error) {
    console.error("Get moods error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/moods", authenticateToken, async (req, res) => {
  try {
    const { mood, intensity, entryDate } = req.body;

    if (!mood) {
      return res.status(400).json({ error: "Mood is required" });
    }

    const db = getDb();
    const moodEntry = {
      userId: new ObjectId(req.user.userId),
      mood,
      intensity: intensity || MOOD_INTENSITY[mood] || 3,
      entryDate: entryDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("moods").insertOne(moodEntry);
    const newMood = { ...moodEntry, _id: result.insertedId };

    res.status(201).json(mapMood(newMood));
  } catch (error) {
    console.error("Create mood error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/chat/messages", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const messages = await db.collection("chat_messages")
      .find({ userId: new ObjectId(req.user.userId) })
      .sort({ createdAt: 1 })
      .toArray();

    res.json(messages.map(mapChatMessage));
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/chat/messages", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const db = getDb();

    // Save user message
    const userMessage = {
      userId: new ObjectId(req.user.userId),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const userResult = await db.collection("chat_messages").insertOne(userMessage);

    // Generate AI response
    const aiResponse = chooseResponse(content);
    const aiMessage = {
      userId: new ObjectId(req.user.userId),
      role: "assistant",
      content: aiResponse,
      createdAt: new Date().toISOString(),
    };

    const aiResult = await db.collection("chat_messages").insertOne(aiMessage);

    res.status(201).json({
      userMessage: mapChatMessage({ ...userMessage, _id: userResult.insertedId }),
      assistantMessage: mapChatMessage({ ...aiMessage, _id: aiResult.insertedId }),
    });
  } catch (error) {
    console.error("Create chat message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/chat/messages", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    await db.collection("chat_messages").deleteMany({
      userId: new ObjectId(req.user.userId)
    });

    res.status(204).send();
  } catch (error) {
    console.error("Delete chat messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/report", authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const db = getDb();
    const memories = await db.collection("memories")
      .find({
        userId: new ObjectId(req.user.userId),
        createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const moods = await db.collection("moods")
      .find({
        userId: new ObjectId(req.user.userId),
        createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const label = `Report from ${formatHumanDate(fromDate)} to ${formatHumanDate(toDate)}`;
    const report = buildDocumentationData(memories, moods, fromDate, toDate, label);

    res.json({ report });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/report/pdf", authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const db = getDb();
    const memories = await db.collection("memories")
      .find({
        userId: new ObjectId(req.user.userId),
        createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const moods = await db.collection("moods")
      .find({
        userId: new ObjectId(req.user.userId),
        createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const label = `Memory Report: ${formatHumanDate(fromDate)} to ${formatHumanDate(toDate)}`;
    const report = buildDocumentationData(memories, moods, fromDate, toDate, label);
    const pdfBuffer = await renderPdfBuffer(report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Generate PDF report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/documentation/export", authenticateToken, async (req, res) => {
  try {
    const fromDateRaw = String(req.body?.fromDate || "").trim();
    const toDateRaw = String(req.body?.toDate || "").trim();
    const label = String(req.body?.label || "Documentation Report").trim();

    if (!fromDateRaw || !toDateRaw) {
      return res.status(400).json({ error: "Both fromDate and toDate are required." });
    }

    const fromDate = new Date(`${fromDateRaw}T00:00:00.000Z`);
    const toDate = new Date(`${toDateRaw}T23:59:59.999Z`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Please provide a valid date range." });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ error: "The from date must be before the to date." });
    }

    const db = getDb();
    const memories = await db.collection("memories")
      .find({
        userId: new ObjectId(req.user.userId),
        createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() }
      })
      .sort({ createdAt: 1 })
      .toArray();

    const moods = await db.collection("moods")
      .find({
        userId: new ObjectId(req.user.userId),
        $or: [
          { entryDate: { $gte: fromDateRaw, $lte: toDateRaw } },
          { createdAt: { $gte: fromDate.toISOString(), $lte: toDate.toISOString() } }
        ]
      })
      .sort({ createdAt: 1 })
      .toArray();

    const report = buildDocumentationData(memories, moods, fromDate, toDate, label);
    const pdfBuffer = await renderPdfBuffer(report);
    const fileName = `memory-dump-documentation-${fromDateRaw.replaceAll("-", "")}-to-${toDateRaw.replaceAll("-", "")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Documentation export error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

if (!isVercel) {
  // Serve static files from the React build in production
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: false
  }));

  // SPA fallback - serve index.html for any non-API route
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) {
        res.status(404).json({ error: "Not found" });
      }
    });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
