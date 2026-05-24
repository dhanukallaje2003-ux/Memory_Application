import { Link, useLocation } from "react-router-dom";
import { Brain, MessageCircle, BookOpen, BarChart3, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { path: "/", label: "Home", icon: Sparkles },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/memories", label: "Memories", icon: BookOpen },
  { path: "/mood", label: "Mood", icon: BarChart3 },
];

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const firstName = user?.name?.trim().split(" ")[0] || "Friend";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient">Memory Dump</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg bg-accent"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-sm text-muted-foreground">
              Hi, <span className="font-semibold text-foreground">{firstName}</span>
            </div>
            <Button variant="outline" className="rounded-full" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main>{children}</main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-lg md:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-xs text-muted-foreground md:hidden">
          <span>
            Hi, <span className="font-semibold text-foreground">{firstName}</span>
          </span>
          <button className="font-semibold text-primary" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
