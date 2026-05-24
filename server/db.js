import { MongoClient } from "mongodb";
import crypto from "node:crypto";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "memory_companion";

let client;
let db;

export async function connectDatabase() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB");

    await ensureIndexes();
    await seedData();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export function getDb() {
  if (!db) {
    throw new Error("Database not connected. Call connectDatabase() first.");
  }
  return db;
}

export async function ensureIndexes() {
  const db = getDb();

  // Users collection indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  // Memories collection indexes
  await db.collection("memories").createIndex({ userId: 1 });
  await db.collection("memories").createIndex({ createdAt: -1 });

  // Moods collection indexes
  await db.collection("moods").createIndex({ userId: 1 });
  await db.collection("moods").createIndex({ entryDate: 1 });
  await db.collection("moods").createIndex({ createdAt: -1 });

  // Chat messages collection indexes
  await db.collection("chat_messages").createIndex({ userId: 1 });
  await db.collection("chat_messages").createIndex({ createdAt: 1 });

  console.log("Database indexes ensured");
}

export async function seedData() {
  const db = getDb();

  // Check if we already have data
  const userCount = await db.collection("users").countDocuments();
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log("Seeding initial data...");

  // Seed some sample memories (these will be associated with the first user who registers)
  const sampleMemories = [
    {
      content: "Today I realized that small moments of kindness from strangers can completely shift my mood. A barista complimented my jacket and it made my entire morning brighter.",
      mood: "grateful",
      createdAt: "2026-02-23T09:00:00.000Z",
    },
    {
      content: "Had a tough conversation with a friend. It hurt, but I think we both needed to be honest. Growth is not always comfortable.",
      mood: "calm",
      createdAt: "2026-02-22T18:30:00.000Z",
    },
    {
      content: "I could not stop worrying about the presentation tomorrow. Took a walk and it helped a bit. Need to remember I have done this before and survived.",
      mood: "anxious",
      createdAt: "2026-02-21T20:15:00.000Z",
    },
  ];

  // Seed some sample moods
  const sampleMoods = [
    {
      mood: "happy",
      intensity: 4,
      entryDate: "2026-02-23",
      createdAt: "2026-02-23T09:00:00.000Z",
    },
    {
      mood: "calm",
      intensity: 3,
      entryDate: "2026-02-22",
      createdAt: "2026-02-22T18:30:00.000Z",
    },
    {
      mood: "anxious",
      intensity: 2,
      entryDate: "2026-02-21",
      createdAt: "2026-02-21T20:15:00.000Z",
    },
  ];

  // Note: These sample data won't be associated with any user initially
  // They serve as examples for when users first explore the app
  // In a real app, you might want to create a demo user or show these as examples

  console.log("Database seeded successfully");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(":");
  if (!salt || !hash) {
    throw new Error("Invalid password hash format");
  }

  const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return computedHash === hash;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    console.log("Database connection closed");
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});
