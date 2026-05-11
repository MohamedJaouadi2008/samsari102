import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import BanWarningDialog from '@/components/BanWarningDialog';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, captchaToken?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any, data?: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBanWarning, setShowBanWarning] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check ban/warning status when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          setShowBanWarning(true);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Also check on initial load if there's an existing session
      if (session?.user) {
        setShowBanWarning(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string, captchaToken?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
        captchaToken,
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken } as any,
    });
    return { error, data };
  };

  const signOut = async () => {
    // Clear local state first so user sees immediate feedback
    setUser(null);
    setSession(null);
    setShowBanWarning(false);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Sign out API error (session may have expired):', error.message);
      }
    } catch (e) {
      console.warn('Sign out failed:', e);
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showBanWarning && user && (
        <BanWarningDialog 
          userId={user.id} 
          onAcknowledged={() => setShowBanWarning(false)} 
        />
      )}
    </AuthContext.Provider>
  );
};
