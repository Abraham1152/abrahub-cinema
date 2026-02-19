import { useState, useEffect, useMemo } from 'react';
import { Menu, User, LogOut, Settings, Crown, ShieldCheck, Image, Coins, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

interface HeaderProps {
  onMenuClick?: () => void;
  credits?: number;
  totalCredits?: number;
  user?: SupabaseUser | null;
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      // Check admin role
      supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' })
        .then(({ data }) => setIsAdmin(data === true));
    }
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const displayEmail = user?.email || '';

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  <span className="text-gradient-lime">ABRA</span>hub
                </h1>
                <p className="text-xs text-muted-foreground">Realism Studio</p>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/">
              <Button 
                variant={isActive('/') ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Image className="h-4 w-4" />
                Studio
              </Button>
            </Link>
            <Link to="/storyboard">
              <Button 
                variant={isActive('/storyboard') ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Film className="h-4 w-4" />
                Storyboard
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/admin">
                <Button 
                  variant={isActive('/admin') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1 text-primary"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Button>
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {/* User Menu - Opens on hover */}
            <HoverCard openDelay={0} closeDelay={200}>
              <HoverCardTrigger asChild>
                <button className="relative h-11 w-11 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center bg-secondary border border-border">
                  <User className="h-5 w-5 text-muted-foreground" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-64 p-0">
                {/* User info */}
                <div className="px-3 py-3 border-b border-border bg-secondary/30">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Assinante Ativo</span>
                  </div>
                </div>
                
                {/* Menu items */}
                <div className="p-1">
                  {/* Mobile nav items */}
                  <Link to="/" className="md:hidden flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary">
                    <Image className="h-4 w-4" />
                    Studio
                  </Link>
                  <Link to="/storyboard" className="md:hidden flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary">
                    <Film className="h-4 w-4" />
                    Storyboard
                  </Link>
                  <div className="md:hidden border-t border-border my-1" />
                  
                  <button 
                    onClick={() => setSettingsOpen(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary text-left"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </button>
                  {isAdmin && (
                    <Link to="/admin" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary">
                      <ShieldCheck className="h-4 w-4" />
                      Painel Admin
                    </Link>
                  )}
                  <div className="border-t border-border my-1" />
                  <button 
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary text-destructive text-left"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        user={user}
      />
    </>
  );
}
