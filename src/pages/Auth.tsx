import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Brain, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

const AuthPage = () => {
  const { isAuthenticated, isReady, login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isReady && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent, isLogin: boolean) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="container flex min-h-screen items-center justify-center py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 shadow-2xl shadow-primary/10 backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden bg-[linear-gradient(180deg,hsl(var(--warm-glow))_0%,hsl(var(--accent))_100%)] p-10 md:flex md:flex-col md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary/80">Memory Dump</p>
                <h1 className="text-3xl font-bold leading-tight text-foreground">
                  A gentle place to unload your mind.
                </h1>
              </div>
            </div>

            <div className="space-y-4">
              <p className="max-w-md text-lg text-muted-foreground">
                Keep your memories, moods, and chats together in one calm personal space.
              </p>
              <div className="rounded-3xl border border-white/50 bg-white/60 p-6 shadow-lg shadow-primary/5">
                <p className="text-sm font-medium text-foreground">
                  Sign in to continue your journaling, mood tracking, and companion chat, or create an account to get started.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8 space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                  Welcome
                </p>
                <h2 className="text-3xl font-bold">
                  Your private space awaits
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to your account or create a new one to get started.
                </p>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/50 p-1">
                  <TabsTrigger value="login" className="rounded-xl">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="rounded-xl">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 pl-11"
                          required
                        />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Password</span>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 pl-11"
                          required
                        />
                      </div>
                    </label>

                    {error && (
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={isSubmitting}>
                      {isSubmitting ? "Please wait..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-6">
                  <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Name</span>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 pl-11"
                          required
                        />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 pl-11"
                          required
                        />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Password</span>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="h-12 rounded-2xl border-border/80 bg-background/70 pl-11"
                          required
                        />
                      </div>
                    </label>

                    {error && (
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={isSubmitting}>
                      {isSubmitting ? "Please wait..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
