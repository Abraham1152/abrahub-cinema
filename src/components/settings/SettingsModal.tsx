import { useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Loader2, Mail, Trash2, Settings, Key, Eye, EyeOff, CheckCircle, XCircle, Zap, AlertTriangle } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';
import { validatePassword } from '@/lib/password-validation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: SupabaseUser | null;
}

export function SettingsModal({ open, onOpenChange, user }: SettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // BYOK state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'none' | 'validating' | 'valid' | 'invalid'>('none');
  const [savedKeyMask, setSavedKeyMask] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [isChangingKey, setIsChangingKey] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      fetchData();
    }
  }, [open, user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: apiKeyResult } = await supabase
        .from('user_api_keys')
        .select('is_valid, gemini_api_key')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // BYOK: check if user has a saved API key
      if (apiKeyResult?.gemini_api_key) {
        const key = apiKeyResult.gemini_api_key;
        setSavedKeyMask(`...${key.slice(-4)}`);
        setApiKeyStatus(apiKeyResult.is_valid ? 'valid' : 'invalid');
      } else {
        setSavedKeyMask(null);
        setApiKeyStatus('none');
      }
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await supabase.auth.signOut();
      toast.success('Você foi desconectado.');
      onOpenChange(false);
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordError('A senha não atende todos os requisitos');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setChangePasswordDialogOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleValidateApiKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Cole sua API key do Google AI Studio');
      return;
    }

    setValidatingKey(true);
    setApiKeyStatus('validating');
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { apiKey: apiKeyInput.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        setApiKeyStatus('valid');
        setSavedKeyMask(data.maskedKey);
        setApiKeyInput('');
        setIsChangingKey(false);
        toast.success(data.message);
      } else {
        setApiKeyStatus('invalid');
        toast.error(data?.error || 'API key inválida');
      }
    } catch (error) {
      console.error('Validate API key error:', error);
      setApiKeyStatus('invalid');
      toast.error(error instanceof Error ? error.message : 'Erro ao validar API key');
    } finally {
      setValidatingKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    try {
      const { error } = await supabase.functions.invoke('validate-api-key', {
        body: { action: 'delete' },
      });
      if (error) throw error;
      setApiKeyStatus('none');
      setSavedKeyMask(null);
      setApiKeyInput('');
      toast.success('API key removida');
    } catch (error) {
      console.error('Remove API key error:', error);
      toast.error('Erro ao remover API key');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Conta</h3>
                <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{user?.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setChangePasswordDialogOpen(true)}>
                    <Key className="h-4 w-4 mr-2" />
                    Alterar senha
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteAccountDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Google API Key (Gemini)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Adicione sua API key do Google AI Studio para habilitar a geração de cenas.
                </p>

                {apiKeyStatus === 'valid' && savedKeyMask && !isChangingKey ? (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span>API key ativa: {savedKeyMask}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-primary h-7 px-2 text-xs" onClick={() => setIsChangingKey(true)}>
                          Trocar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={handleRemoveApiKey}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiKeyStatus === 'invalid' && (
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <XCircle className="h-3 w-3" />
                        <span>API key inválida.</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="Cole sua API key aqui..."
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="pr-8 text-xs"
                        />
                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                      <Button size="sm" onClick={handleValidateApiKey} disabled={validatingKey || !apiKeyInput.trim()}>
                        {validatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Diagnostic Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Diagnóstico do Sistema
                </h3>
                <p className="text-xs text-muted-foreground">
                  Se a geração estiver travada, use o botão abaixo para acordar o processador.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs h-8"
                  onClick={async () => {
                    const { error } = await supabase.functions.invoke('process-generation-queue', { body: {} });
                    if (error) toast.error('Erro ao acordar o servidor');
                    else toast.success('Servidor acordado! Verifique sua galeria.');
                  }}
                >
                  Acordar Processador de Imagens
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-white">
              {deleting ? 'Processando...' : 'Excluir Conta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Senha</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <PasswordStrengthIndicator password={newPassword} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? 'Alterando...' : 'Salvar Senha'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
