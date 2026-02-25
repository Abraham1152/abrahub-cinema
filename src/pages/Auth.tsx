import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Mail, CheckCircle2, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';
import { validatePassword } from '@/lib/password-validation';
import heroImage from '@/assets/hero-cinema.jpg';

type SetupStep = 'email' | 'sent' | 'password' | 'success';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, session, loading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // First access PRO state
  const [showFirstAccessModal, setShowFirstAccessModal] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('email');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // When Auth mounts: check if setup is pending (magic link flow)
  // SetupGuard already navigated here; useAuth provides the session via INITIAL_SESSION
  useEffect(() => {
    if (!session || loading) return;

    const pendingSetup = localStorage.getItem('abrahub_setup_pending');
    const needsPasswordSetup = session.user?.user_metadata?.needs_password_setup;

    if (pendingSetup === 'true' || needsPasswordSetup) {
      localStorage.removeItem('abrahub_setup_pending');
      setSetupEmail(session.user.email || '');
      setShowFirstAccessModal(true);
      setSetupStep('password');
    } else {
      navigate('/');
    }
  }, [session, loading, navigate]);

  const handleCloseModal = () => {
    // Don't allow closing if user still needs to set up password
    // Check both the metadata flag AND the setup step (if we're in password step, don't close)
    if (session?.user?.user_metadata?.needs_password_setup || setupStep === 'password') {
      return;
    }
    setShowFirstAccessModal(false);
    setSetupStep('email');
    setSetupEmail('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSetupError('');
  };

  // Step 1: Check eligibility and send Magic Link
  const handleCheckEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingEligibility(true);
    setSetupError('');

    try {
      // Verify if email is in the authorized whitelist
      const { data: authorized, error: dbError } = await supabase
        .from('authorized_users')
        .select('status')
        .eq('email', setupEmail.toLowerCase())
        .single();

      if (dbError || !authorized) {
        setSetupError('Este email não está na lista de acesso da comunidade ABRAhub. Verifique se usou o email correto da sua assinatura.');
        return;
      }

      if (authorized.status !== 'active') {
        setSetupError('Sua assinatura está inativa. Para reativar o acesso, renove sua assinatura na comunidade ABRAhub.');
        return;
      }

      // Mark pending setup before sending OTP (localStorage survives the redirect)
      localStorage.setItem('abrahub_setup_pending', 'true');

      // Email is authorized — send magic link (creates account if needed)
      // Use origin + pathname to include GitHub Pages subpath (/abrahub-cinema/)
      // Supabase appends #access_token=... to this URL after verification
      const redirectBase = window.location.origin + window.location.pathname;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: setupEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectBase,
        },
      });

      if (otpError) {
        throw new Error(otpError.message);
      }

      setSetupStep('sent');
      toast.success('Email enviado!', {
        description: 'Enviamos um link de confirmação para seu email.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao verificar', { description: errorMessage });
      setSetupError(errorMessage);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  // Step 2: Set password (after returning from Magic Link)
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (newPassword !== confirmNewPassword) {
      setSetupError('As senhas não coincidem');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setSetupError('A senha não atende todos os requisitos');
      return;
    }

    setIsSavingPassword(true);

    try {
      // Update password and mark setup as complete
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { needs_password_setup: false },
      });

      if (updateError) throw updateError;

      setSetupStep('success');
      toast.success('Senha configurada com sucesso!');

      // Redirect after 2 seconds
      setTimeout(() => {
        handleCloseModal();
        navigate('/', { replace: true });
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao configurar senha';
      toast.error('Erro', { description: errorMessage });
      setSetupError(errorMessage);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success('Bem-vindo de volta!');
      navigate('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Email not confirmed')) {
        toast.error('Email não confirmado', {
          description: 'Verifique sua caixa de entrada e confirme seu email.',
        });
      } else {
        toast.error('Erro ao entrar', {
          description: errorMessage || 'Verifique suas credenciais',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    // Validate password confirmation
    if (registerPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    const validation = validatePassword(registerPassword);
    if (!validation.isValid) {
      setPasswordError('A senha não atende todos os requisitos');
      return;
    }

    setIsRegistering(true);
    try {
      const result = await signUp(registerEmail, registerPassword, registerName);
      // Check if email confirmation is required (user exists but no session)
      if (result?.user && !result?.session) {
        setShowEmailConfirmation(true);
      } else {
        toast.success('Conta criada com sucesso!');
        navigate('/');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('already registered')) {
        toast.error('Email já cadastrado', {
          description: 'Tente fazer login ou use outro email.',
        });
      } else {
        toast.error('Erro ao criar conta', {
          description: errorMessage || 'Tente novamente',
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Email confirmation success screen
  if (showEmailConfirmation) {
    return (
      <div className="flex min-h-screen">
        <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-12 xl:px-24">
          <div className="mx-auto w-full max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            
            <h2 className="font-display text-2xl font-semibold mb-2">Verifique seu email</h2>
            <p className="text-muted-foreground mb-6">
              Enviamos um link de confirmação para <strong className="text-foreground">{registerEmail}</strong>. 
              Clique no link para ativar sua conta.
            </p>
            
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Não recebeu o email?</strong>
                  <br />
                  • Verifique sua pasta de spam
                  <br />
                  • O email pode levar alguns minutos para chegar
                </p>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowEmailConfirmation(false)}
              >
                Voltar para login
              </Button>
            </div>
          </div>
        </div>
        
        <div className="relative hidden lg:block lg:w-1/2">
          <img src={heroImage} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-12 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold">
                <span className="text-gradient-lime">ABRA</span>hub
              </h1>
              <p className="text-sm text-muted-foreground">Realism Studio</p>
            </div>
          </div>

          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold">Acesso à Comunidade</h2>
              <p className="mt-1 text-muted-foreground">Entre com o e-mail autorizado pela comunidade ABRAhub</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="h-12 pl-10"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-12 pl-10 pr-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-12 w-full gap-2 shadow-yellow" disabled={isLoggingIn}>
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-8 rounded-lg bg-secondary/50 p-4 border border-border">
              <p className="text-xs text-center text-muted-foreground">
                Não tem acesso? O registro é exclusivo para assinantes ativos da nossa comunidade.
              </p>
            </div>

            {/* First Access PRO Section */}
            <div className="mt-6 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setShowFirstAccessModal(true)}
                className="w-full text-center text-sm text-primary hover:underline font-medium"
              >
                Primeiro acesso? Configure sua senha aqui →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Hero Image */}
      <div className="relative hidden lg:block lg:w-1/2">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
      </div>

      {/* First Access PRO Modal */}
      <Dialog open={showFirstAccessModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-md">
          {/* Step 1: Email */}
          {setupStep === 'email' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Primeiro acesso
                </DialogTitle>
                <DialogDescription>
                  Digite o email da sua assinatura na comunidade ABRAhub
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCheckEligibility} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="h-12 pl-10"
                      value={setupEmail}
                      onChange={(e) => {
                        setSetupEmail(e.target.value);
                        setSetupError('');
                      }}
                      required
                      disabled={isCheckingEligibility}
                    />
                  </div>
                  {setupError && (
                    <p className="text-xs text-destructive">{setupError}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gap-2 shadow-yellow" 
                  disabled={isCheckingEligibility}
                >
                  {isCheckingEligibility ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Enviar link de acesso
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step 2: Link Sent */}
          {setupStep === 'sent' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Email enviado!
                </DialogTitle>
                <DialogDescription>
                  Enviamos um link de confirmação para <strong>{setupEmail}</strong>
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Clique no link que enviamos para o seu email.
                  <br />
                  Você será direcionado para configurar sua senha.
                </p>
                
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <strong>Não recebeu?</strong> Verifique a pasta de spam
                  ou aguarde alguns minutos.
                </div>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => setSetupStep('email')} 
                className="w-full"
              >
                Tentar outro email
              </Button>
            </>
          )}

          {/* Step 3: Set Password */}
          {setupStep === 'password' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Crie sua senha
                </DialogTitle>
                <DialogDescription>
                  Escolha uma senha segura para sua conta
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Crie uma senha segura"
                      className="h-12 pl-10 pr-10"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setSetupError('');
                      }}
                      required
                      disabled={isSavingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      placeholder="Digite a senha novamente"
                      className="h-12 pl-10 pr-10"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        setSetupError('');
                      }}
                      required
                      disabled={isSavingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {setupError && (
                    <p className="text-xs text-destructive">{setupError}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gap-2 shadow-yellow" 
                  disabled={isSavingPassword || !validatePassword(newPassword).isValid}
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      Salvar senha e entrar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step 4: Success */}
          {setupStep === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">Tudo pronto!</h3>
                <p className="text-muted-foreground">
                  Sua senha foi configurada. Você será redirecionado...
                </p>
              </div>
              
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
