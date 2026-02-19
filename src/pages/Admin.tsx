import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Image, 
  Zap, 
  TrendingUp, 
  Crown,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Activity,
  UserPlus,
  UserMinus,
  Clapperboard
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AddCreditsModal } from '@/components/admin/AddCreditsModal';
import { PresetManager } from '@/components/admin/PresetManager';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  unlimited: 'Unlimited',
  admin: '👑 Admin',
};

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    isAdmin, 
    loading: adminLoading, 
    stats, 
    users,
    addCreditsToUser,
    addAdminRole,
    removeAdminRole,
    refetch 
  } = useAdmin(user?.id);

  const [addCreditsModalOpen, setAddCreditsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Dados atualizados');
  };

  const handleAddCredits = async (amount: number, description: string) => {
    if (!selectedUser) return;
    
    try {
      await addCreditsToUser(selectedUser.id, amount, description);
      toast.success(`${amount} créditos adicionados para ${selectedUser.name}`);
      setAddCreditsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar créditos';
      toast.error(message);
    }
  };

  const openAddCreditsModal = (userId: string, userName: string) => {
    setSelectedUser({ id: userId, name: userName });
    setAddCreditsModalOpen(true);
  };

  const handleToggleAdmin = async (userId: string, userName: string, isCurrentlyAdmin: boolean) => {
    // Prevent removing own admin role
    if (userId === user?.id) {
      toast.error('Você não pode remover seu próprio papel de admin');
      return;
    }

    setTogglingAdmin(userId);
    try {
      if (isCurrentlyAdmin) {
        await removeAdminRole(userId);
        toast.success(`${userName} não é mais administrador`);
      } else {
        await addAdminRole(userId);
        toast.success(`${userName} agora é administrador`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar papel de admin';
      toast.error(message);
    } finally {
      setTogglingAdmin(null);
    }
  };

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-studio-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ShieldCheck className="h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-studio-gradient flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20">
              <ShieldCheck className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o painel de administração.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-studio-gradient">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold">Painel Admin</h1>
                <p className="text-xs text-muted-foreground">Abrahub Creative Studio</p>
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8 md:px-6">
        {/* Stats Overview */}
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold mb-4">Visão Geral</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Usuários Totais"
              value={stats?.totalUsers || 0}
              icon={Users}
              description="Usuários registrados"
            />
            <StatCard
              title="Imagens Geradas"
              value={stats?.totalImages || 0}
              icon={Image}
              description="Total de imagens"
            />
            <StatCard
              title="Créditos Consumidos"
              value={stats?.totalCreditsUsed || 0}
              icon={Zap}
              description="Créditos utilizados"
            />
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold mb-4">Assinaturas</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Assinaturas Ativas"
              value={stats?.activeSubscriptions || 0}
              icon={Activity}
              variant="success"
            />
            <StatCard
              title="Plano Free"
              value={stats?.freeUsers || 0}
              icon={Users}
              variant="muted"
            />
            <StatCard
              title="Plano Pro"
              value={stats?.proUsers || 0}
              icon={Crown}
              variant="primary"
            />
            <StatCard
              title="Plano Unlimited"
              value={stats?.unlimitedUsers || 0}
              icon={TrendingUp}
              variant="accent"
            />
          </div>
        </div>

        {/* Tabs for detailed data */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="presets" className="gap-2">
              <Clapperboard className="h-4 w-4" />
              Presets
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Lista de todos os usuários registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>Campanhas</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((userItem) => (
                          <TableRow key={userItem.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {userItem.is_admin && (
                                  <ShieldCheck className="h-4 w-4 text-primary" />
                                )}
                                {userItem.display_name || userItem.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={userItem.is_admin ? 'default' : userItem.plan === 'pro' ? 'secondary' : 'outline'}>
                                {PLAN_LABELS[userItem.plan] || userItem.plan}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {userItem.is_admin ? (
                                <span className="text-muted-foreground">∞ ilimitado</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-primary" />
                                  <span>{userItem.credits_available}</span>
                                  <span className="text-muted-foreground">/ {userItem.credits_used} usados</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{userItem.campaigns_count}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(userItem.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAddCreditsModal(userItem.id, userItem.display_name || userItem.email)}
                                >
                                  <Zap className="h-3 w-3 mr-1" />
                                  Créditos
                                </Button>
                                <Button
                                  variant={userItem.is_admin ? "destructive" : "secondary"}
                                  size="sm"
                                  disabled={togglingAdmin === userItem.id || userItem.id === user?.id}
                                  onClick={() => handleToggleAdmin(userItem.id, userItem.display_name || userItem.email, userItem.is_admin)}
                                >
                                  {togglingAdmin === userItem.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : userItem.is_admin ? (
                                    <>
                                      <UserMinus className="h-3 w-3 mr-1" />
                                      Remover Admin
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      Tornar Admin
                                    </>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          {/* Presets Tab */}
          <TabsContent value="presets">
            <PresetManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Credits Modal */}
      <AddCreditsModal
        isOpen={addCreditsModalOpen}
        onClose={() => {
          setAddCreditsModalOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleAddCredits}
        userName={selectedUser?.name || ''}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  variant?: 'default' | 'primary' | 'success' | 'muted' | 'accent';
}

function StatCard({ title, value, icon: Icon, description, variant = 'default' }: StatCardProps) {
  const iconColors = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    muted: 'text-muted-foreground',
    accent: 'text-accent',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-display">{value.toLocaleString()}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-secondary/50 ${iconColors[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
