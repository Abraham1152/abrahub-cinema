import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";
import Storyboard from "./pages/Storyboard";
import NotFound from "./pages/NotFound";
import { CookieBanner } from "./components/cookies/CookieBanner";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

// Detects SIGNED_IN after magic link redirect and navigates to /auth to show setup modal
function SetupGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const pendingSetup = localStorage.getItem('abrahub_setup_pending');
        const needsPasswordSetup = session.user?.user_metadata?.needs_password_setup;
        if (pendingSetup === 'true' || needsPasswordSetup) {
          navigate('/auth');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <SetupGuard />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<Privacy />} />
           <Route path="/admin" element={<Admin />} />
           <Route path="/storyboard" element={<Storyboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieBanner />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
