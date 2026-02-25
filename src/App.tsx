import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Outlet, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";
import Storyboard from "./pages/Storyboard";
import NotFound from "./pages/NotFound";
import { CookieBanner } from "./components/cookies/CookieBanner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

// Persistent header layout — shared across Studio, Storyboard, Admin
function MainLayout() {
  const { user } = useAuth();
  return (
    <>
      <Header user={user} />
      <Outlet />
    </>
  );
}

// Detects SIGNED_IN after magic link redirect and navigates to /auth to show setup modal
function SetupGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Capture hash BEFORE any navigation clears it
    // Supabase appends #access_token=...&type=magiclink after OTP verification
    const fullHash = window.location.hash;
    const isMagicLink = fullHash.includes('type=magiclink') || fullHash.includes('type=recovery');
    // Also check query string (some Supabase flows use ?token=)
    const isMagicLinkQuery = window.location.search.includes('type=magiclink');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle both SIGNED_IN and INITIAL_SESSION — SIGNED_IN can fire before
      // the subscription is set up, in which case new subscriptions only get INITIAL_SESSION
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const pendingSetup = localStorage.getItem('abrahub_setup_pending');
        const needsPasswordSetup = session.user?.user_metadata?.needs_password_setup;

        // Check if user has ever set a password (no password hash = needs setup)
        // For users created by webhook, needs_password_setup is true
        // For magic link users, force setup if coming from magic link
        const needsSetup = pendingSetup === 'true' || needsPasswordSetup || isMagicLink || isMagicLinkQuery;

        if (needsSetup) {
          // Ensure flag is set so Auth.tsx can detect it after navigation
          localStorage.setItem('abrahub_setup_pending', 'true');
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
          {/* Pages with persistent shared header */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          {/* Full-screen pages — manage their own layout */}
          <Route path="/storyboard" element={<Storyboard />} />
          {/* Pages without the shared header */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <CookieBanner />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
