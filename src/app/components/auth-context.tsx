import { createContext, useContext, useState, useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { publicAnonKey, supabaseUrl } from "/utils/supabase/info";
import { fetchFavorites, fetchUserRole } from "./api";

const supabase = createClient(supabaseUrl, publicAnonKey);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  favorites: string[];
  role: string;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshRole: () => Promise<void>;
  setFavorites: Dispatch<SetStateAction<string[]>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  accessToken: null,
  isLoading: true,
  favorites: [],
  role: "user",
  isAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
  refreshFavorites: async () => {},
  refreshRole: async () => {},
  setFavorites: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [role, setRole] = useState<string>("user");

  const accessToken = session?.access_token || null;
  const isAdmin = role === "admin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user || null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (accessToken) {
      void refreshFavorites();
      void refreshRole();
    } else {
      setFavorites([]);
      setRole("user");
    }
  }, [accessToken]);

  const refreshFavorites = async () => {
    if (!accessToken) return;
    const favs = await fetchFavorites(accessToken);
    setFavorites(favs);
  };

  const refreshRole = async () => {
    if (!accessToken) return;
    const r = await fetchUserRole(accessToken);
    setRole(r);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setSession(data.session);
    setUser(data.user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setFavorites([]);
    setRole("user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accessToken,
        isLoading,
        favorites,
        role,
        isAdmin,
        signIn,
        signOut,
        refreshFavorites,
        refreshRole,
        setFavorites,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
