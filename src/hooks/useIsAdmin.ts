import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [panelRole, setPanelRole] = useState<'admin' | 'moderator' | 'support' | 'dispute_manager' | 'logistics' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setPanelRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_panel_role');
        
        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          setPanelRole(null);
        } else if (data) {
          setIsAdmin(true);
          setPanelRole(data as 'admin' | 'moderator' | 'support' | 'dispute_manager' | 'logistics');
        } else {
          setIsAdmin(false);
          setPanelRole(null);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setPanelRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, panelRole, loading };
};
