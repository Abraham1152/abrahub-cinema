import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminStats {
  totalUsers: number;
  totalImages: number;
  totalCreditsUsed: number;
  totalCreditsAvailable: number;
  activeSubscriptions: number;
  freeUsers: number;
  proUsers: number;
  unlimitedUsers: number;
}

export interface UserOverview {
  id: string;
  email: string;
  display_name: string | null;
  plan: string;
  is_admin: boolean;
  credits_available: number;
  credits_used: number;
  campaigns_count: number;
  created_at: string;
}

export function useAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserOverview[]>([]);

  // Check if user is admin
  const checkAdminRole = useCallback(async () => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: userId, _role: 'admin' });

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data === true);
      }
    } catch (err) {
      console.error('Admin check failed:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch all admin stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // Fetch user credits aggregate
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('available, used');

      const totalCreditsAvailable = creditsData?.reduce((sum, c) => sum + c.available, 0) || 0;
      const totalCreditsUsed = creditsData?.reduce((sum, c) => sum + c.used, 0) || 0;

      // Fetch subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('plan, status');

      const activeSubscriptions = subsData?.filter(s => s.status === 'active').length || 0;
      const freeUsers = subsData?.filter(s => s.plan === 'free').length || 0;
      const proUsers = subsData?.filter(s => s.plan === 'pro').length || 0;
      const unlimitedUsers = subsData?.filter(s => s.plan === 'unlimited').length || 0;

      // Fetch images count (from user_generated_images instead of scene_images)
      const { count: imagesCount } = await supabase
        .from('user_generated_images')
        .select('*', { count: 'exact', head: true });

      // Fetch profiles count (as proxy for total users)
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: usersCount || 0,
        totalImages: imagesCount || 0,
        totalCreditsUsed,
        totalCreditsAvailable,
        activeSubscriptions,
        freeUsers,
        proUsers,
        unlimitedUsers,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [isAdmin]);




  // Fetch users overview
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usersWithDetails = await Promise.all(
        (profilesData || []).map(async (profile) => {
          // Get credits
          const { data: creditsData } = await supabase
            .from('user_credits')
            .select('available, used')
            .eq('user_id', profile.user_id)
            .single();

          // Get subscription
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('plan')
            .eq('user_id', profile.user_id)
            .single();

          // Get campaigns count
          const { count: campaignsCount } = await supabase
            .from('campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.user_id);

          // Check if user is admin
          const { data: isUserAdmin } = await supabase
            .rpc('has_role', { _user_id: profile.user_id, _role: 'admin' });

          return {
            id: profile.user_id,
            email: profile.display_name || 'Unknown',
            display_name: profile.display_name,
            plan: isUserAdmin ? 'admin' : (subData?.plan || 'free'),
            is_admin: isUserAdmin === true,
            credits_available: creditsData?.available || 0,
            credits_used: creditsData?.used || 0,
            campaigns_count: campaignsCount || 0,
            created_at: profile.created_at,
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [isAdmin]);

  // Add credits to a user
  const addCreditsToUser = useCallback(async (targetUserId: string, amount: number, description: string) => {
    try {
      // First, check if user_credits record exists
      const { data: existingCredits, error: checkError } = await supabase
        .from('user_credits')
        .select('id, available')
        .eq('user_id', targetUserId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // If no credits record exists, create one first
      if (!existingCredits) {
        const { error: insertError } = await supabase
          .from('user_credits')
          .insert({
            user_id: targetUserId,
            available: 0,
            used: 0,
          });

        if (insertError) throw insertError;
      }

      // Now add credits using the RPC
      const { data, error } = await supabase
        .rpc('add_credits', {
          _user_id: targetUserId,
          _amount: amount,
          _action: 'admin_grant',
          _description: description,
        });

      if (error) throw error;

      // Refresh data
      await Promise.all([fetchStats(), fetchUsers()]);
      return data;
    } catch (err) {
      console.error('Failed to add credits:', err);
      throw err;
    }
  }, [fetchStats, fetchUsers]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (targetUserId: string) => {
    try {
      // Check if already admin
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('role', 'admin')
        .single();

      if (existingRole) {
        throw new Error('Usuário já é administrador');
      }

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: targetUserId,
          role: 'admin',
        });

      if (error) throw error;

      // Refresh data
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Failed to add admin role:', err);
      throw err;
    }
  }, [fetchUsers]);

  // Remove admin role from a user
  const removeAdminRole = useCallback(async (targetUserId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', 'admin');

      if (error) throw error;

      // Refresh data
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Failed to remove admin role:', err);
      throw err;
    }
  }, [fetchUsers]);

  useEffect(() => {
    checkAdminRole();
  }, [checkAdminRole]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchUsers();
    }
  }, [isAdmin, fetchStats, fetchUsers]);

  return {
    isAdmin,
    loading,
    stats,
    users,
    addCreditsToUser,
    addAdminRole,
    removeAdminRole,
    refetch: () => {
      fetchStats();
      fetchUsers();
    },
  };
}
