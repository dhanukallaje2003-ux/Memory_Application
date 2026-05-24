import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subDays } from "date-fns";
import { TrendingUp, Smile, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, type MoodEntry } from "@/lib/api";

const MOODS = [
  { key: "happy", emoji: "😊", label: "Happy", color: "hsl(45, 100%, 60%)", value: 4 },
  { key: "calm", emoji: "😌", label: "Calm", color: "hsl(195, 60%, 60%)", value: 3 },
  { key: "sad", emoji: "😢", label: "Sad", color: "hsl(220, 40%, 60%)", value: 1 },
  { key: "anxious", emoji: "😰", label: "Anxious", color: "hsl(15, 80%, 60%)", value: 2 },
  { key: "angry", emoji: "😤", label: "Angry", color: "hsl(0, 70%, 55%)", value: 1 },
];

const getColor = (mood: string) => MOODS.find((entry) => entry.key === mood)?.color || "hsl(28, 10%, 40%)";
const todayKey = new Date().toISOString().slice(0, 10);

const MoodTracker = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadMoods = async () => {
      try {
        const data = await api.getMoods(7);
        setEntries(data);
        const todaysEntry = data.find((entry) => entry.entryDate === todayKey);
        setTodayMood(todaysEntry?.mood || null);
      } catch (error) {
        toast({
          title: "Could not load mood history",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadMoods();
  }, [toast]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = subDays(new Date(), 6 - index);
      const entryDate = format(date, "yyyy-MM-dd");
      const entry = entries.find((item) => item.entryDate === entryDate);

      return {
        day: format(date, "EEE"),
        mood: entry?.mood ?? "none",
        value: entry?.intensity ?? 0,
      };
    });
  }, [entries]);

  const insight = useMemo(() => {
    const counts = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {});
    const dominantMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const moodMeta = MOODS.find((entry) => entry.key === dominantMood);

    if (!moodMeta) {
      return "Start logging your mood each day and the app will build a weekly pattern for you.";
    }

    return `You have been feeling mostly ${moodMeta.label.toLowerCase()} this week. Keeping track like this makes emotional patterns easier to notice before they build up.`;
  }, [entries]);

  const handleMoodSave = async (moodKey: string) => {
    setTodayMood(moodKey);
    setIsSaving(true);

    try {
      const moodMeta = MOODS.find((entry) => entry.key === moodKey);
      const savedEntry = await api.saveMood({
        mood: moodKey,
        intensity: moodMeta?.value || 3,
        entryDate: todayKey,
      });

      setEntries((prev) => {
        const next = prev.filter((entry) => entry.entryDate !== savedEntry.entryDate);
        return [...next, savedEntry].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
      });
      toast({
        title: "Mood logged",
        description: "Today's check-in has been saved to the database.",
      });
    } catch (error) {
      toast({
        title: "Could not save mood",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8 pb-24 md:pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Mood Tracker</h1>
        <p className="text-muted-foreground">Understand your emotional patterns</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card p-6 mb-6"
      >
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Smile className="h-4 w-4 text-primary" />
          How are you feeling right now?
        </h3>
        <div className="flex gap-3 flex-wrap">
          {MOODS.map((mood) => (
            <button
              key={mood.key}
              onClick={() => void handleMoodSave(mood.key)}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                todayMood === mood.key
                  ? "border-primary bg-accent text-foreground scale-105 shadow-md"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <span className="text-xl">{mood.emoji}</span>
              {mood.label}
            </button>
          ))}
        </div>
        {todayMood && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            Mood logged! Acknowledging your feelings is the first step.
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/50 bg-card p-6 mb-6"
      >
        <h3 className="font-semibold flex items-center gap-2 mb-6">
          <TrendingUp className="h-4 w-4 text-primary" />
          This Week's Mood
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={12} />
              <YAxis hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const datum = payload[0].payload;
                  const mood = MOODS.find((entry) => entry.key === datum.mood);
                  return (
                    <div className="rounded-lg bg-card border border-border px-3 py-2 shadow-lg text-sm">
                      <span>{mood ? `${mood.emoji} ${mood.label}` : "No mood logged"}</span>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getColor(entry.mood)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading mood data from the database...</p>}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border/50 bg-accent/50 p-6"
      >
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-primary" />
          Weekly Insight
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
      </motion.div>
    </div>
  );
};

export default MoodTracker;
