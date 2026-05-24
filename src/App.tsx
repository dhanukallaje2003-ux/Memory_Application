import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Memories from "./pages/Memories";
import MoodTracker from "./pages/MoodTracker";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={
                <ProtectedPage>
                  <Index />
                </ProtectedPage>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedPage>
                  <Chat />
                </ProtectedPage>
              }
            />
            <Route
              path="/memories"
              element={
                <ProtectedPage>
                  <Memories />
                </ProtectedPage>
              }
            />
            <Route
              path="/mood"
              element={
                <ProtectedPage>
                  <MoodTracker />
                </ProtectedPage>
              }
            />
            <Route
              path="*"
              element={
                <ProtectedPage>
                  <NotFound />
                </ProtectedPage>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
