import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STRIPE_PLANS } from '@/config/stripe-plans';

export interface UserCredits {
  available: number;
  used: number;
  total: number;
}

export interface Subscription {
  plan: string;
  status: string;
  isActive: boolean;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  downgradedAt: string | null;
}

// Get base credits for a plan (monthly allowance)
function getBaseCreditsForPlan(plan: string): number {
  if (plan === 'free') return 0;
  if (plan === 'pro') return 10; // PRO (Circle intermediate tier)
  if (plan === 'proplus') return STRIPE_PLANS.pro.credits; // PRO+ uses the config (100 credits)
  return 0;
}

export function useCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<UserCredits>({ available: 0, used: 0, total: 0 });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch credits from credit_wallet (primary), subscription from entitlements, and admin status
      const [walletResult, entitlementsResult, adminResult] = await Promise.all([
        supabase
          .from('credit_wallet')
          .select('credits_balance, monthly_allowance')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('entitlements')
          .select('plan, status, current_period_end, grace_until, downgraded_at, is_blocked, blocked_reason')
          .eq('user_id', userId)
          .single(),
        supabase
          .rpc('has_role', { _user_id: userId, _role: 'admin' }),
      ]);

      const walletData = walletResult.data;
      const entData = entitlementsResult.data;
      const isUserAdmin = adminResult.data === true;
      
      setIsAdmin(isUserAdmin);
      setIsBlocked(entData?.is_blocked === true);
      setBlockedReason(entData?.blocked_reason || null);
      // ADMINS GET PRO AUTOMATICALLY - unlimited access
      if (isUserAdmin) {
        setSubscription({
          plan: 'admin',
          status: 'active',
          isActive: true,
          currentPeriodEnd: null,
          graceUntil: null,
          downgradedAt: null,
        });
        // Admins have "unlimited" credits displayed as 9999
        setCredits({
          available: 9999,
          used: 0,
          total: 9999,
        });
        setError(null);
        setLoading(false);
        return;
      }

      // Set subscription from entitlements
      const plan = entData?.plan || 'free';
      
      // Check if user is in grace period (downgraded but still has access)
      // Detect both explicit grace_until and implicit (downgraded with remaining credits)
      const inGracePeriod = entData?.downgraded_at && (
        // Explicit grace_until date
        (entData?.grace_until && new Date(entData.grace_until) > new Date()) ||
        // OR: downgraded with remaining credits (implicit grace)
        (walletData?.credits_balance > 0 && entData?.plan === 'free')
      );

      // Calculate base credits for the plan
      let baseCredits: number;
      if (inGracePeriod) {
        // Grace period: use monthly_allowance from wallet (set when they were PRO/PRO+)
        baseCredits = walletData?.monthly_allowance && walletData.monthly_allowance > 0
          ? walletData.monthly_allowance
          : getBaseCreditsForPlan('proplus'); // fallback to PRO+ limit
      } else {
        baseCredits = getBaseCreditsForPlan(plan);
      }

      // Calculate total credits: max(baseCredits, currentBalance)
      // This handles purchased extra credits correctly
      const currentBalance = walletData?.credits_balance ?? 0;
      const totalCredits = Math.max(baseCredits, currentBalance);

      if (entData) {
        setSubscription({
          plan: entData.plan,
          status: entData.status,
          isActive: entData.status === 'active' || entData.status === 'trialing',
          currentPeriodEnd: entData.current_period_end,
          graceUntil: entData.grace_until,
          downgradedAt: entData.downgraded_at,
        });
      } else {
        setSubscription({
          plan: 'free',
          status: 'free',
          isActive: false,
          currentPeriodEnd: null,
          graceUntil: null,
          downgradedAt: null,
        });
      }

      // Use community mode: Unlimited credits for authorized users
      setCredits({
        available: 999999,
        used: 0,
        total: 999999,
      });
      
      if (entData) {
        setSubscription({
          plan: 'community',
          status: 'active',
          isActive: true,
          currentPeriodEnd: null,
          graceUntil: null,
          downgradedAt: null,
        });
      }

      setError(null);
    } catch (err) {
      // For community mode, we ignore errors and provide unlimited access
      setCredits({ available: 999999, used: 0, total: 999999 });
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const hasEnoughCredits = useCallback((amount: number) => {
    return true; // Always enough credits
  }, []);

  const isSubscriptionActive = useCallback(() => {
    return true; // Always active
  }, []);

  const canGenerate = useCallback(() => {
    return true; // Always can generate
  }, []);

  const isPro = useCallback(() => {
    return true; // Everyone is PRO
  }, []);

  // Check if user is in grace period (downgraded but still has access to remaining credits)
  const isInGracePeriod = useCallback(() => {
    return false;
  }, []);

  return {
    credits,
    subscription,
    loading,
    error,
    isAdmin,
    isBlocked,
    blockedReason,
    hasEnoughCredits,
    isSubscriptionActive,
    canGenerate,
    isPro,
    isInGracePeriod,
    refetch: fetchCredits,
  };
}
