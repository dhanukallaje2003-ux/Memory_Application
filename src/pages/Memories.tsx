import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, BookOpen, Calendar, Heart, Download, FileText } from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api, type MemoryRecord } from "@/lib/api";

type Memory = {
  id: string;
  content: string;
  mood: string;
  date: Date;
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  calm: "😌",
  sad: "😢",
  anxious: "😰",
  angry: "😤",
  grateful: "🙏",
  excited: "🤩",
  confused: "😵",
};

const mapMemory = (memory: MemoryRecord): Memory => ({
  id: memory.id,
  content: memory.content,
  mood: memory.mood,
  date: new Date(memory.createdAt),
});

const formatInputDate = (value: Date) => format(value, "yyyy-MM-dd");

const Memories = () => {
  const { toast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newMood, setNewMood] = useState("calm");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reportPreset, setReportPreset] = useState<"day" | "week" | "custom">("week");
  const [reportFromDate, setReportFromDate] = useState(formatInputDate(subDays(new Date(), 6)));
  const [reportToDate, setReportToDate] = useState(formatInputDate(new Date()));
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const data = await api.getMemories();
        setMemories(data.map(mapMemory));
      } catch (error) {
        toast({
          title: "Could not load memories",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadMemories();
  }, [toast]);

  const handleSave = async () => {
    if (!newContent.trim()) return;

    setIsSaving(true);
    try {
      const savedMemory = await api.createMemory({
        content: newContent.trim(),
        mood: newMood,
      });
      setMemories((prev) => [mapMemory(savedMemory), ...prev]);
      setNewContent("");
      setNewMood("calm");
      setIsWriting(false);
      toast({
        title: "Memory saved",
        description: "Your thought has been added to your journal.",
      });
    } catch (error) {
      toast({
        title: "Could not save memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const setPresetDates = (preset: "day" | "week" | "custom") => {
    setReportPreset(preset);

    if (preset === "day") {
      const today = formatInputDate(new Date());
      setReportFromDate(today);
      setReportToDate(today);
      return;
    }

    if (preset === "week") {
      setReportFromDate(formatInputDate(subDays(new Date(), 6)));
      setReportToDate(formatInputDate(new Date()));
    }
  };

  const handleDocumentationDownload = async () => {
    setIsExporting(true);

    try {
      const label =
        reportPreset === "day" ? "Daily Documentation" : reportPreset === "week" ? "Weekly Documentation" : "Custom Documentation";
      const report = await api.exportDocumentation({
        fromDate: reportFromDate,
        toDate: reportToDate,
        label,
      });

      const url = window.URL.createObjectURL(report.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Documentation downloaded",
        description: "Your PDF report is ready and has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Could not generate documentation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Your Memories</h1>
          <p className="text-muted-foreground">A safe place for your thoughts</p>
        </div>
        <Button onClick={() => setIsWriting(true)} className="rounded-full gap-2" disabled={isWriting}>
          <Plus className="h-4 w-4" />
          Dump a Thought
        </Button>
      </div>

      <div className="mb-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <FileText className="h-5 w-5 text-primary" />
              Download Work Documentation
            </h2>
            <p className="text-sm text-muted-foreground">
              Generate a detailed PDF report from your saved thoughts for a day, a week, or any custom date range.
            </p>
          </div>
          <Button onClick={handleDocumentationDownload} disabled={isExporting} className="rounded-full gap-2 sm:self-center">
            <Download className="h-4 w-4" />
            {isExporting ? "Generating..." : "Download Report"}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={reportPreset === "day" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setPresetDates("day")}
          >
            Day
          </Button>
          <Button
            type="button"
            variant={reportPreset === "week" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setPresetDates("week")}
          >
            Week
          </Button>
          <Button
            type="button"
            variant={reportPreset === "custom" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setPresetDates("custom")}
          >
            Custom
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">From</span>
            <input
              type="date"
              value={reportFromDate}
              onChange={(e) => {
                setReportPreset("custom");
                setReportFromDate(e.target.value);
              }}
              className="h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">To</span>
            <input
              type="date"
              value={reportToDate}
              onChange={(e) => {
                setReportPreset("custom");
                setReportToDate(e.target.value);
              }}
              className="h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm"
            />
          </label>
        </div>
      </div>

      <AnimatePresence>
        {isWriting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  What's on your mind?
                </h3>
                <button onClick={() => setIsWriting(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Let it all out... no judgment here."
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none mb-4"
                autoFocus
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">How are you feeling?</span>
                  <div className="flex gap-1">
                    {Object.entries(MOOD_EMOJIS).map(([mood, emoji]) => (
                      <button
                        key={mood}
                        onClick={() => setNewMood(mood)}
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-lg transition-all ${
                          newMood === mood ? "bg-accent ring-2 ring-primary scale-110" : "hover:bg-muted"
                        }`}
                        title={mood}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSave} disabled={!newContent.trim() || isSaving} className="rounded-full">
                  Save Memory
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">Loading your memories...</p>
            <p className="text-sm">Pulling your journal from the database.</p>
          </div>
        )}

        {memories.map((memory, index) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-hover rounded-2xl border border-border/50 bg-card p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {format(memory.date, "MMM d, yyyy")}
              </div>
              <span className="text-xl" title={memory.mood}>
                {MOOD_EMOJIS[memory.mood] || "😐"}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{memory.content}</p>
          </motion.div>
        ))}

        {!isLoading && memories.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">No memories yet</p>
            <p className="text-sm">Start dumping your thoughts. It feels good.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Memories;
