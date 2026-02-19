import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export interface ClaimResult {
  success: boolean;
  claimed: boolean;
  plan_applied?: string;
  credits_applied?: number;
  error?: string;
  message?: string;
  email_checked?: string;
  stripe_customer_id?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  const claimAttempted = useRef<Set<string>>(new Set());

  // Claim pending entitlements after login/signup
  const claimPendingEntitlements = useCallback(async (userId: string, userEmail?: string): Promise<ClaimResult | null> => {
    // Avoid duplicate claims for the same user in this session
    if (claimAttempted.current.has(userId)) {
      console.log('[useAuth] Claim already attempted for user:', userId);
      return null;
    }
    claimAttempted.current.add(userId);

    console.log('[useAuth] Attempting to claim entitlements for user:', userId, 'email:', userEmail);

    try {
      const { data, error } = await supabase.rpc('claim_entitlements_for_user');
      
      if (error) {
        console.error('[useAuth] RPC claim_entitlements_for_user failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
          userEmail,
        });
        return null;
      }
      
      const result = data as unknown as ClaimResult;
      
      if (result?.claimed) {
        console.log('[useAuth] ✅ Successfully claimed pending entitlements:', {
          plan_applied: result.plan_applied,
          credits_applied: result.credits_applied,
          stripe_customer_id: result.stripe_customer_id,
        });
      } else {
        console.log('[useAuth] No pending entitlements to claim:', {
          message: result?.message,
          email_checked: result?.email_checked,
        });
      }
      
      return result;
    } catch (err) {
      console.error('[useAuth] Exception during claim_entitlements_for_user:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        userId,
        userEmail,
      });
      return null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state changed:', event, session?.user?.id);
        
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
        });

        // Claim entitlements on SIGNED_IN event (login or signup)
        if (event === 'SIGNED_IN' && session?.user) {
          // Use setTimeout to avoid blocking the auth flow
          setTimeout(async () => {
            const result = await claimPendingEntitlements(session.user.id, session.user.email);
            if (result?.claimed) {
              // Dispatch a custom event so other hooks can refetch
              window.dispatchEvent(new CustomEvent('entitlements-claimed', { 
                detail: result 
              }));
            }
          }, 100);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[useAuth] Initial session check:', session?.user?.id);
      
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });

      // Also claim for existing session (in case user had pending before this code was deployed)
      if (session?.user) {
        const result = await claimPendingEntitlements(session.user.id, session.user.email);
        if (result?.claimed) {
          window.dispatchEvent(new CustomEvent('entitlements-claimed', { 
            detail: result 
          }));
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [claimPendingEntitlements]);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[useAuth] Signing in user:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    console.log('[useAuth] Verificando autorização para:', email);
    
    // 1. Verificação de Acesso Exclusivo (Lista Branca)
    const { data: authorized, error: authError } = await supabase
      .from('authorized_users')
      .select('status')
      .eq('email', email.toLowerCase())
      .single();

    if (authError || !authorized || authorized.status !== 'active') {
      console.warn('[useAuth] Usuário não autorizado:', email);
      throw new Error('Acesso restrito. Apenas assinantes ativos da comunidade Circle podem criar conta. Por favor, assine para ter acesso.');
    }

    console.log('[useAuth] Usuário autorizado, prosseguindo com cadastro:', email);
    
    // 2. Prossiga com o cadastro normal se autorizado
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name: name || email.split('@')[0],
        },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    console.log('[useAuth] Signing out user');
    // Reset claim attempts on logout so user can claim again on next login
    claimAttempted.current.clear();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // Manual claim function for cases where automatic claim failed
  const manualClaimEntitlements = useCallback(async () => {
    if (!state.user) {
      console.error('[useAuth] Cannot claim - no user logged in');
      return null;
    }
    // Remove from attempted set to allow retry
    claimAttempted.current.delete(state.user.id);
    return claimPendingEntitlements(state.user.id, state.user.email ?? undefined);
  }, [state.user, claimPendingEntitlements]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    manualClaimEntitlements,
    isAuthenticated: !!state.user,
  };
}
