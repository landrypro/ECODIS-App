import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth-context";
import { useDownloads, formatFileSize } from "../download-context";
import { usePlatform } from "../platform-utils";
import {
  User,
  Heart,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  LogIn,
  ChevronRight,
  Bell,
  Shield,
  Plus,
  Users,
  Crown,
  Layers,
  BarChart3,
  Smartphone,
  Globe,
  MonitorSmartphone,
  LayoutDashboard,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  user: "Membre",
  content_editor: "Éditeur",
  moderator: "Modérateur",
  admin: "Administrateur",
  super_admin: "Super-administrateur",
};

export function ProfilPage() {
  const { user, signOut, favorites, isAdmin, roles, permissions, mfa, updateDisplayName, requestEmailChange, requestPasswordReset } = useAuth();
  const { downloads } = useDownloads();
  const { platform, standalone, canInstall, installApp } = usePlatform();
  const navigate = useNavigate();
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const canModerate = roles.some((currentRole) => ["moderator", "admin", "super_admin"].includes(currentRole));

  useEffect(() => {
    setNameDraft(String(user?.user_metadata?.name ?? ""));
    setEmailDraft(user?.email ?? "");
  }, [user?.email, user?.id, user?.user_metadata?.name]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleNameUpdate = async () => {
    try {
      setIsSavingName(true);
      await updateDisplayName(nameDraft);
      toast.success("Votre nom affiché a été mis à jour.");
    } catch (error: any) {
      toast.error(error.message || "Le nom n'a pas pu être mis à jour.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleEmailUpdate = async () => {
    try {
      setIsSavingEmail(true);
      await requestEmailChange(emailDraft);
      toast.success("Vérifiez votre boîte e-mail : la modification doit être confirmée par un lien sécurisé.");
    } catch (error: any) {
      toast.error(error.message || "L'e-mail n'a pas pu être modifié.");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      setIsSendingPasswordReset(true);
      await requestPasswordReset(user.email);
      toast.success("Si le compte est éligible, un lien sécurisé a été envoyé à votre adresse.");
    } catch (error: any) {
      toast.error(error.message || "Le lien de réinitialisation n'a pas pu être envoyé.");
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  if (!user) {
    return (
      <div className="pb-20 lg:pb-6">
        <div className="bg-gradient-to-b from-[#152a6b] to-[#0d1a42] px-4 pt-10 pb-14 text-center">
          <div className="w-20 h-20 rounded-full bg-white/15 border-2 border-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <User className="w-9 h-9 text-white/80" />
          </div>
          <h2 className="text-white text-lg font-semibold">Bienvenue sur ECODIS</h2>
          <p className="text-white/50 text-xs mt-1">
            Connectez-vous pour acceder a toutes les fonctionnalites
          </p>
        </div>
        <div className="px-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-border p-5 space-y-3">
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 bg-[#152a6b] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-colors active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Se connecter
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="w-full py-3 bg-white text-[#152a6b] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-[#152a6b]/20 hover:bg-[#152a6b]/5 transition-colors active:scale-[0.98]"
            >
              <User className="w-4 h-4" />
              Creer un compte
            </button>
          </div>

          {/* Platform info */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            {platform === "web" ? (
              <Globe className="w-3.5 h-3.5" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
            <span>
              ECODIS v3.0.0 · {platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Web"}
              {standalone ? " (App)" : ""}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const userName =
    user.user_metadata?.name || user.email?.split("@")[0] || "Disciple";

  const menuItems = [
    { icon: Heart, label: "Mes favoris", count: favorites.length },
    {
      icon: Download,
      label: "Telechargements",
      count: downloads.length,
      subtitle: downloads.length > 0 ? formatFileSize(downloads.reduce((a, d) => a + d.fileSize, 0)) : undefined,
      path: "/downloads",
    },
    { icon: Layers, label: "Series & Programmes", path: "/series" },
    { icon: Bell, label: "Notifications" },
    { icon: Shield, label: "Confidentialite" },
    { icon: Settings, label: "Parametres" },
    { icon: HelpCircle, label: "Aide & Support" },
  ];

  return (
    <div className="pb-20 lg:pb-6">
      {/* Profile header */}
      <div className="bg-gradient-to-b from-[#152a6b] to-[#0d1a42] px-4 pt-6 pb-12">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-[#9b1b30] flex items-center justify-center backdrop-blur-sm">
              <User className="w-8 h-8 text-white" />
            </div>
            {isAdmin && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center border-2 border-[#152a6b] shadow-lg">
                <Crown className="w-3 h-3 text-amber-900" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white text-[16px] font-semibold">{userName}</h2>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  isAdmin
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    : "bg-white/10 text-white/60 border border-white/20"
                }`}
              >
                {isAdmin ? "Admin" : "Membre"}
              </span>
            </div>
            <p className="text-white/50 text-[12px]">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6 relative z-10 mb-4">
        <div className="bg-card rounded-2xl border border-border shadow-lg grid grid-cols-3 divide-x divide-border">
          {[
            { label: "Favoris", value: favorites.length.toString() },
            {
              label: "Membre depuis",
              value: new Date(user.created_at).toLocaleDateString("fr-FR", {
                month: "short",
                year: "numeric",
              }),
            },
            { label: "Role", value: isAdmin ? "Admin" : "Membre" },
          ].map((stat) => (
            <div key={stat.label} className="text-center py-3.5">
              <p className="text-[18px] font-bold text-primary">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="px-4 mb-4 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Mon identité et mon accès</p>
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm p-4 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Pencil className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-card-foreground">Nom affiché</h3>
            </div>
            <label className="sr-only" htmlFor="profile-display-name">Nom affiché</label>
            <div className="flex gap-2">
              <input
                id="profile-display-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={120}
                placeholder={userName}
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#152a6b]/20"
              />
              <button
                onClick={() => void handleNameUpdate()}
                disabled={isSavingName || nameDraft.trim().length < 2}
                className="rounded-xl bg-[#152a6b] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-card-foreground">Adresse e-mail</h3>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">La nouvelle adresse ne sera appliquée qu'après confirmation via le lien envoyé par Supabase Auth.</p>
            <label className="sr-only" htmlFor="profile-email">Nouvelle adresse e-mail</label>
            <div className="flex gap-2">
              <input
                id="profile-email"
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#152a6b]/20"
              />
              <button
                onClick={() => void handleEmailUpdate()}
                disabled={isSavingEmail || !emailDraft.trim() || emailDraft.trim().toLowerCase() === user.email?.toLowerCase()}
                className="rounded-xl border border-[#152a6b]/20 px-3 py-2 text-[12px] font-semibold text-[#152a6b] disabled:opacity-50"
              >
                {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Modifier"}
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-[13px] font-semibold text-card-foreground">Accès du compte</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Membre depuis le {new Date(user.created_at).toLocaleDateString("fr-FR")}{user.last_sign_in_at ? ` · Dernière connexion : ${new Date(user.last_sign_in_at).toLocaleDateString("fr-FR")}` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roles.map((currentRole) => <span key={currentRole} className="rounded-full border border-[#152a6b]/15 bg-[#152a6b]/5 px-2 py-1 text-[10px] font-medium text-[#152a6b]">{ROLE_LABELS[currentRole] ?? currentRole}</span>)}
            </div>
            <p className="mt-3 text-[11px] font-medium text-muted-foreground">Autorisations effectives</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{permissions.length > 0 ? permissions.join(" · ") : "Aucune autorisation élevée."}</p>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-[13px] font-semibold text-card-foreground">Mot de passe</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Un lien de réinitialisation sécurisé sera envoyé à votre adresse. Votre mot de passe n'est jamais affiché ni modifié par un administrateur.</p>
            <button
              onClick={() => void handlePasswordReset()}
              disabled={isSendingPasswordReset}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#9b1b30]/20 px-3 py-2 text-[12px] font-semibold text-[#9b1b30] disabled:opacity-50"
            >
              {isSendingPasswordReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Envoyer un lien de réinitialisation
            </button>
          </div>
        </div>
      </section>

      {/* Admin section */}
      {canModerate && (
        <div className="px-4 mb-4 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Modération</p>
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <button
              onClick={() => navigate("/moderation")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><Shield className="w-4 h-4 text-amber-600" /></div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">Modération des commentaires</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Admin section */}
      {isAdmin && (
        <div className="px-4 mb-4 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Administration
          </p>
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <button
              onClick={() => navigate("/security/mfa")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors border-b border-border"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mfa.currentLevel === "aal2" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <KeyRound className={`w-4 h-4 ${mfa.currentLevel === "aal2" ? "text-emerald-700" : "text-amber-600"}`} />
              </div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">Sécurité MFA</span>
              <span className={`text-[10px] font-medium ${mfa.currentLevel === "aal2" ? "text-emerald-700" : "text-amber-700"}`}>{mfa.currentLevel === "aal2" ? "Vérifiée" : "À configurer"}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors border-b border-border"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-amber-600" />
              </div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">
                Dashboard (Desktop)
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors border-b border-border"
            >
              <div className="w-9 h-9 rounded-xl bg-[#152a6b]/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[#152a6b]" />
              </div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">
                Ajouter un message
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/admin/users")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors border-b border-border"
            >
              <div className="w-9 h-9 rounded-xl bg-[#9b1b30]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#9b1b30]" />
              </div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">
                Gestion des utilisateurs
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/admin/stats")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-600" />
              </div>
              <span className="flex-1 text-[13px] text-card-foreground font-medium">
                Tableau de bord
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="px-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Mon compte
        </p>
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              onClick={item.path ? () => navigate(item.path!) : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors ${
                i !== menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <item.icon className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <span className="text-[13px] text-card-foreground font-medium">
                  {item.label}
                </span>
                {item.subtitle && (
                  <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
                )}
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className="bg-primary/10 text-primary text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
                  {item.count}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Install app CTA */}
        {canInstall && (
          <button
            onClick={installApp}
            className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-[#152a6b]/5 to-[#9b1b30]/5 rounded-2xl border border-[#152a6b]/15 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-[#152a6b]/10 flex items-center justify-center">
              <MonitorSmartphone className="w-4 h-4 text-[#152a6b]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold text-foreground">
                Installer l'application
              </p>
              <p className="text-[10px] text-muted-foreground">
                Ajoutez ECODIS a votre ecran d'accueil
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-[#9b1b30]/10 text-[#9b1b30] rounded-2xl border border-[#9b1b30]/20 active:bg-[#9b1b30]/20 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[13px] font-semibold">Se deconnecter</span>
        </button>

        {/* Platform info footer */}
        <div className="flex items-center justify-center gap-2 mt-6 mb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {platform === "web" ? (
              <Globe className="w-3.5 h-3.5" />
            ) : (
              <Smartphone className="w-3.5 h-3.5" />
            )}
            <span>
              ECODIS v3.0.0
            </span>
          </div>
          <span className="text-muted-foreground/30">|</span>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            {platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Web"}
            {standalone ? " App" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
