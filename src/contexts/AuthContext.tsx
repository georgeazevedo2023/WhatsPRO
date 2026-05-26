import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'gerente' | 'user';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  isGerente: boolean;
  userRole: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Retorna o papel de maior hierarquia de uma lista de papéis */
const resolveHighestRole = (roles: AppRole[]): AppRole | null => {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('gerente')) return 'gerente';
  if (roles.includes('user')) return 'user';
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGerente, setIsGerente] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile and all roles in parallel
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      const roleList = (rolesRes.data || []).map(r => r.role) as AppRole[];
      const highest = resolveHighestRole(roleList);

      setIsSuperAdmin(roleList.includes('super_admin'));
      setIsGerente(roleList.includes('gerente'));
      setUserRole(highest);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let initialDone = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip the INITIAL_SESSION event — handled by getSession below
        if (!initialDone) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setIsSuperAdmin(false);
          setIsGerente(false);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session (runs once), com TIMEOUT de wall-clock.
    //
    // Bug da sessão zumbi (2026-05-26): se o refresh token está inválido e a
    // resolução de sessão do supabase-js TRAVA (em vez de falhar limpo), o
    // getSession() nunca resolve → `loading` fica preso em true → o app inteiro
    // congela no spinner do ProtectedRoute. O race garante que, se a sessão não
    // resolver em 8s, tratamos como SEM sessão e limpamos o token zumbi do
    // localStorage (signOut) — o ProtectedRoute então redireciona pro /login.
    const sessionTimeout = new Promise<{ data: { session: Session | null } }>((resolve) => {
      setTimeout(() => resolve({ data: { session: null } }), 8000);
    });
    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user.id);
        }
        setLoading(false);
        initialDone = true;
      })
      .catch(async (err) => {
        // Sessão zumbi / refresh falho → limpa estado e token persistido.
        console.warn('[Auth] getSession falhou/travou — limpando sessão', err);
        try { await supabase.auth.signOut(); } catch { /* best-effort */ }
        setSession(null);
        setUser(null);
        setLoading(false);
        initialDone = true;
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsSuperAdmin(false);
    setIsGerente(false);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isSuperAdmin,
        isGerente,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
