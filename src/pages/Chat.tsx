import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api, type ChatMessageRecord } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type StoredChatMessage = ChatMessageRecord & {
  _id?: string;
  created_at?: string;
};

const mapMessage = (message: StoredChatMessage): Message => ({
  id:
    message.id ||
    message._id ||
    `${message.role ?? "msg"}-${message.createdAt ?? message.created_at ?? Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: message.role ?? "assistant",
  content: message.content ?? "",
  timestamp: new Date(message.createdAt ?? message.created_at ?? Date.now()),
});

const Chat = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await api.getChatMessages();
        setMessages(data.map(mapMessage));
      } catch (error) {
        toast({
          title: "Could not load chat history",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsBootstrapping(false);
      }
    };

    void loadMessages();
  }, [toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isBootstrapping) return;

    const nextContent = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage({ content: nextContent });
      setMessages((prev) => [
        ...prev,
        mapMessage(response.userMessage),
        mapMessage(response.assistantMessage),
      ]);
    } catch (error) {
      setInput(nextContent);
      toast({
        title: "Could not send message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] pb-16 md:pb-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container max-w-2xl mx-auto space-y-4">
          {isBootstrapping && (
            <div className="text-sm text-muted-foreground">Loading your conversation from the database...</div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "chat-bubble-user text-foreground rounded-br-md"
                      : "chat-bubble-ai text-foreground rounded-bl-md"
                  }`}
                >
                  <div className="prose prose-sm max-w-none [&>p]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 items-center"
            >
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="chat-bubble-ai rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="border-t border-border/50 bg-background/80 backdrop-blur-lg px-4 py-4">
        <div className="container max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind..."
            rows={1}
            disabled={isBootstrapping}
            className="flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading || isBootstrapping}
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
