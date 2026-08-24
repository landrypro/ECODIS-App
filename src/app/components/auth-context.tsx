import { createContext, useCallback, useContext, useState, useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { publicAnonKey, supabaseUrl } from "../../../utils/supabase/info";
import { fetchFavorites, fetchUserAuthorization, updateOwnProfile, verifyCurrentAccountAccess, type AppRole } from "./api";
import { SESSION_REJECTED_EVENT } from "../services/http";
import {
  INITIAL_MFA_STATE,
  type MfaEnrollment,
  type MfaFactor,
  type MfaLevel,
  type MfaState,
} from "../domain/mfa";

const supabase = createClient(supabaseUrl, publicAnonKey);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  favorites: string[];
  role: AppRole;
  roles: AppRole[];
  permissions: string[];
  isAdmin: boolean;
  mfa: MfaState;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  requestEmailChange: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshMfa: () => Promise<void>;
  startMfaEnrollment: (friendlyName: string) => Promise<MfaEnrollment>;
  verifyMfaEnrollment: (factorId: string, code: string) => Promise<void>;
  verifyMfaChallenge: (factorId: string, code: string) => Promise<void>;
  unenrollMfaFactor: (factorId: string) => Promise<void>;
  setFavorites: Dispatch<SetStateAction<string[]>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  accessToken: null,
  isLoading: true,
  favorites: [],
  role: "user",
  roles: ["user"],
  permissions: [],
  isAdmin: false,
  mfa: INITIAL_MFA_STATE,
  signIn: async () => {},
  requestPasswordReset: async () => {},
  resetPassword: async () => {},
  updateDisplayName: async () => {},
  requestEmailChange: async () => {},
  signOut: async () => {},
  refreshFavorites: async () => {},
  refreshRole: async () => {},
  refreshMfa: async () => {},
  startMfaEnrollment: async () => ({ factorId: "", qrCode: "" }),
  verifyMfaEnrollment: async () => {},
  verifyMfaChallenge: async () => {},
  unenrollMfaFactor: async () => {},
  setFavorites: () => {},
});

function normalizeMfaLevel(value: unknown): MfaLevel {
  return value === "aal1" || value === "aal2" ? value : null;
}

function mapMfaFactors(data: any): MfaFactor[] {
  return [...(data?.totp ?? []), ...(data?.phone ?? [])].map((factor: any) => ({
    id: factor.id,
    factorType: factor.factor_type === "phone" ? "phone" : "totp",
    friendlyName: factor.friendly_name ?? null,
    status: factor.status ?? "unverified",
    createdAt: factor.created_at ?? null,
  }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [role, setRole] = useState<AppRole>("user");
  const [roles, setRoles] = useState<AppRole[]>(["user"]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mfa, setMfa] = useState<MfaState>(INITIAL_MFA_STATE);
  const sessionCheckInProgress = useRef(false);
  const sessionRejectionInProgress = useRef(false);

  const accessToken = session?.access_token || null;
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  const resetAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setFavorites([]);
    setRole("user");
    setRoles(["user"]);
    setPermissions([]);
    setMfa(INITIAL_MFA_STATE);
  }, []);

  const rejectCurrentSession = useCallback(async () => {
    if (sessionRejectionInProgress.current) return;
    sessionRejectionInProgress.current = true;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.error("Local sign out after session rejection failed:", error);
      resetAuthState();
      toast.error("Votre session n’est plus active. Veuillez contacter un administrateur.");
    } finally {
      sessionRejectionInProgress.current = false;
    }
  }, [resetAuthState]);

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
      void refreshMfa();
    } else {
      setFavorites([]);
      setRole("user");
      setRoles(["user"]);
      setPermissions([]);
      setMfa(INITIAL_MFA_STATE);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const checkAccountAccess = async () => {
      if (sessionCheckInProgress.current) return;
      sessionCheckInProgress.current = true;
      try {
        await verifyCurrentAccountAccess(accessToken);
      } catch (error: any) {
        // Les 401 sont traités par l'événement global émis dans fetchJson.
        if (error?.status !== 401) console.error("Account access verification failed:", error);
      } finally {
        sessionCheckInProgress.current = false;
      }
    };
    const onSessionRejected = () => void rejectCurrentSession();
    const onFocus = () => void checkAccountAccess();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkAccountAccess();
    };

    const intervalId = window.setInterval(() => void checkAccountAccess(), 30_000);
    window.addEventListener(SESSION_REJECTED_EVENT, onSessionRejected);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void checkAccountAccess();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(SESSION_REJECTED_EVENT, onSessionRejected);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [accessToken, rejectCurrentSession]);

  const refreshFavorites = async () => {
    if (!accessToken) return;
    const favs = await fetchFavorites(accessToken);
    setFavorites(favs);
  };

  const refreshRole = async () => {
    if (!accessToken) return;
    const authorization = await fetchUserAuthorization(accessToken);
    setRole(authorization.role);
    setRoles(authorization.roles);
    setPermissions(authorization.permissions);
  };

  const refreshMfa = async () => {
    if (!accessToken) return;
    setMfa((current) => ({ ...current, isLoading: true }));
    try {
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (assuranceError) throw assuranceError;
      if (factorsError) throw factorsError;
      setMfa({
        isLoading: false,
        currentLevel: normalizeMfaLevel(assurance?.currentLevel),
        nextLevel: normalizeMfaLevel(assurance?.nextLevel),
        factors: mapMfaFactors(factors),
      });
    } catch (error) {
      console.error("MFA status refresh failed:", error);
      setMfa({ ...INITIAL_MFA_STATE, isLoading: false });
    }
  };

  const refreshSessionAndMfa = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    setSession(data.session);
    setUser(data.user ?? data.session?.user ?? null);
    await refreshMfa();
  };

  const verifyMfaCode = async (factorId: string, code: string) => {
    const normalizedCode = code.replace(/\D/g, "");
    if (normalizedCode.length !== 6) throw new Error("Saisissez les six chiffres de votre application d'authentification.");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: normalizedCode });
    if (verifyError) throw verifyError;
    await refreshSessionAndMfa();
  };

  const startMfaEnrollment = async (friendlyName: string): Promise<MfaEnrollment> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName.trim().slice(0, 64) || "ECODIS Authenticator",
    });
    if (error) throw error;
    if (!data?.id || !data.totp?.qr_code) throw new Error("Le QR code MFA n'a pas pu être généré.");
    return { factorId: data.id, qrCode: data.totp.qr_code };
  };

  const verifyMfaEnrollment = async (factorId: string, code: string) => {
    await verifyMfaCode(factorId, code);
  };

  const verifyMfaChallenge = async (factorId: string, code: string) => {
    await verifyMfaCode(factorId, code);
  };

  const unenrollMfaFactor = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    await refreshSessionAndMfa();
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

  const requestPasswordReset = async (email: string) => {
    const redirectTo = new URL("/reset-password", window.location.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) throw error;
  };

  const resetPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    if (signOutError) console.error("Global sign out after password reset failed:", signOutError);
    resetAuthState();
  };

  const updateDisplayName = async (name: string) => {
    if (!accessToken || !user) throw new Error("Vous devez être connecté pour modifier votre profil.");
    const updated = await updateOwnProfile(name, accessToken);
    setUser((current) => current
      ? { ...current, user_metadata: { ...current.user_metadata, name: updated.user.name } }
      : current);
  };

  const requestEmailChange = async (email: string) => {
    if (!user) throw new Error("Vous devez être connecté pour modifier votre e-mail.");
    const redirectTo = new URL("/profil", window.location.origin).toString();
    const { error } = await supabase.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo: redirectTo },
    );
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetAuthState();
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
        roles,
        permissions,
        isAdmin,
        mfa,
        signIn,
        requestPasswordReset,
        resetPassword,
        updateDisplayName,
        requestEmailChange,
        signOut,
        refreshFavorites,
        refreshRole,
        refreshMfa,
        startMfaEnrollment,
        verifyMfaEnrollment,
        verifyMfaChallenge,
        unenrollMfaFactor,
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
