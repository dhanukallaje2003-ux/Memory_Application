import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, BookOpen, BarChart3, Shield, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import heroImage from "@/assets/hero-illustration.jpg";

const features = [
  {
    icon: MessageCircle,
    title: "AI Friend",
    description: "Chat with an empathetic AI companion who truly listens and understands you.",
  },
  {
    icon: BookOpen,
    title: "Memory Journal",
    description: "Dump your thoughts freely and store your emotional memories safely.",
  },
  {
    icon: BarChart3,
    title: "Mood Tracking",
    description: "Track your emotional patterns and gain insights into your well-being.",
  },
  {
    icon: Heart,
    title: "Emotional Support",
    description: "Receive gentle psychological guidance and coping strategies.",
  },
  {
    icon: Sparkles,
    title: "Spiritual Insights",
    description: "Get motivational and spiritual guidance to nurture inner peace.",
  },
  {
    icon: Shield,
    title: "Safe & Private",
    description: "Your memories and emotions are encrypted and completely private.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Index = () => {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(" ")[0] || "Friend";

  return (
    <div className="bg-hero-gradient">
      {/* Hero */}
      <section className="container py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-sm font-semibold tracking-wider uppercase text-primary mb-4">
              Your Safe Space
            </p>
            <p className="mb-3 text-sm text-muted-foreground">Welcome back, {firstName}.</p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Dump your thoughts.{" "}
              <span className="text-gradient">Find your peace.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Memory Dump is your AI companion that listens, remembers, and helps you 
              grow emotionally. A trusted friend available whenever you need one.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="rounded-full text-base px-8">
                <Link to="/chat">Start Talking</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full text-base px-8">
                <Link to="/memories">Write a Memory</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/10">
              <img
                src={heroImage}
                alt="A peaceful person sitting on a cloud surrounded by golden memory bubbles"
                className="w-full h-auto"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-sage/30 animate-float" />
            <div className="absolute -top-4 -right-4 h-14 w-14 rounded-full bg-primary/20 animate-float" style={{ animationDelay: "1s" }} />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to <span className="text-gradient">feel better</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete emotional wellness toolkit wrapped in a warm, friendly experience.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="card-hover rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl bg-card border border-border/50 p-12 md:p-16 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to unload your mind?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Start your journey towards emotional clarity. Your AI friend is waiting.
          </p>
          <Button asChild size="lg" className="rounded-full text-base px-10">
            <Link to="/chat">
              <MessageCircle className="mr-2 h-5 w-5" />
              Start Chatting
            </Link>
          </Button>
        </motion.div>
      </section>

      <footer className="container py-8 text-center text-sm text-muted-foreground border-t border-border/50">
        <p>© 2026 Memory Dump. Your thoughts are safe here.</p>
      </footer>
    </div>
  );
};

export default Index;
