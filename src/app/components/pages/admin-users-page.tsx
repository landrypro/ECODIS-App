import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Crown,
  KeyRound,
  Loader2,
  Mail,
  MailPlus,
  Search,
  Shield,
  ShieldOff,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../auth-context";
import { ApiError } from "../../services/http";
import {
  fetchAllUsers,
  inviteUser,
  requestUserPasswordReset,
  resendUserInvitation,
  updateUserAccountStatus,
  updateUserRoles,
  type AppRole,
  type AppUser,
} from "../api";

const ROLE_LABELS: Record<AppRole, string> = {
  user: "Membre",
  content_editor: "Éditeur",
  moderator: "Modérateur",
  admin: "Administrateur",
  super_admin: "Super-administrateur",
};

const PERMISSION_LABELS: Record<string, string> = {
  access_admin: "Accès à l’administration",
  content_create_own: "Créer ses contenus",
  content_edit_own: "Éditer ses contenus",
  content_submit_review: "Soumettre en revue",
  content_publish: "Publier du contenu",
  content_manage_all: "Gérer tous les contenus",
  comments_moderate: "Modérer les commentaires",
  users_manage_basic_roles: "Gérer les rôles de base",
  users_manage_admin_roles: "Gérer les rôles administrateur",
  users_delete: "Supprimer des comptes",
  system_manage_critical: "Gérer les opérations critiques",
};

function getAssignableRoles(actorRoles: AppRole[]): AppRole[] {
  return actorRoles.includes("super_admin")
    ? ["content_editor", "moderator", "admin"]
    : ["content_editor", "moderator"];
}

function hasSameRoles(left: AppRole[], right: AppRole[]) {
  return left.length === right.length && left.every((role) => right.includes(role));
}

export function AdminUsersPage() {
  const { user, accessToken, isAdmin, roles: actorRoles } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [accountActionUserId, setAccountActionUserId] = useState<string | null>(null);
  const [showInvitationForm, setShowInvitationForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [invitationCooldowns, setInvitationCooldowns] = useState<Record<string, number>>({});

  const assignableRoles = useMemo(() => getAssignableRoles(actorRoles), [actorRoles]);

  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      setUsers(await fetchAllUsers(accessToken));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && isAdmin) void loadUsers();
  }, [accessToken, isAdmin, loadUsers]);

  const handleSaveRoles = async (target: AppUser, requestedRoles: AppRole[], reason: string) => {
    if (!accessToken) return;
    setSavingUserId(target.id);
    try {
      await updateUserRoles(target.id, requestedRoles, reason, accessToken);
      await loadUsers();
      toast.success(`Rôles de ${target.name} mis à jour.`);
    } catch (error: any) {
      toast.error(error?.message || "La mise à jour des rôles a échoué.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleInvitation = async () => {
    if (!accessToken) return;
    setSendingInvitation(true);
    try {
      const result = await inviteUser(inviteEmail.trim(), inviteName.trim(), accessToken);
      toast.success(result.message);
      setInviteName("");
      setInviteEmail("");
      setShowInvitationForm(false);
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "L'invitation n'a pas pu être envoyée.");
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleResendInvitation = async (target: AppUser) => {
    if (!accessToken) return;
    setAccountActionUserId(target.id);
    try {
      const result = await resendUserInvitation(target.id, accessToken);
      toast.success(result.message);
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        const expiresAt = Date.now() + error.retryAfterSeconds * 1000;
        setInvitationCooldowns((current) => ({ ...current, [target.id]: expiresAt }));
        window.setTimeout(() => {
          setInvitationCooldowns((current) => {
            const { [target.id]: _expired, ...remaining } = current;
            return remaining;
          });
        }, error.retryAfterSeconds * 1000);
      }
      toast.error(error?.message || "L'invitation n'a pas pu être renvoyée.");
    } finally {
      setAccountActionUserId(null);
    }
  };

  const handlePasswordReset = async (target: AppUser) => {
    if (!accessToken) return;
    setAccountActionUserId(target.id);
    try {
      const result = await requestUserPasswordReset(target.id, accessToken);
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error?.message || "Le lien n'a pas pu être demandé.");
    } finally {
      setAccountActionUserId(null);
    }
  };

  const handleAccountStatus = async (target: AppUser, status: "active" | "suspended", reason: string) => {
    if (!accessToken) return;
    setAccountActionUserId(target.id);
    try {
      const result = await updateUserAccountStatus(target.id, status, reason, accessToken);
      toast.success(result.message);
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "La modification de statut a échoué.");
    } finally {
      setAccountActionUserId(null);
    }
  };

  if (!user) {
    return <AccessMessage icon={<AlertCircle className="w-12 h-12 text-[#9b1b30]" />} title="Connexion requise" text="Vous devez être connecté pour accéder à cette page." action="Se connecter" onAction={() => navigate("/login")} />;
  }

  if (!isAdmin) {
    return <AccessMessage icon={<ShieldOff className="w-12 h-12 text-[#9b1b30]" />} title="Accès restreint" text="Seuls les administrateurs peuvent gérer les utilisateurs." action="Retour au profil" onAction={() => navigate("/profil")} />;
  }

  const filteredUsers = users.filter((appUser) => {
    const matchesSearch = appUser.name.toLowerCase().includes(search.toLowerCase()) || appUser.email.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (roleFilter === "all" || appUser.roles.includes(roleFilter));
  });
  const adminCount = users.filter((appUser) => appUser.roles.includes("admin") || appUser.roles.includes("super_admin")).length;

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-4xl lg:ml-[240px]">
      <header className="sticky top-0 z-40 bg-[#152a6b] text-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-[15px]">Gestion des utilisateurs</h1>
          <UserRoundCog className="h-5 w-5 text-white/70" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-5">
          <Stat label="Utilisateurs" value={users.length} />
          <Stat label="Administrateurs" value={adminCount} accent="text-amber-300" />
          <Stat label="Résultats" value={filteredUsers.length} />
        </div>
      </header>

      <main className="space-y-4 px-4 py-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-card-foreground">Comptes et habilitations</p>
          <button onClick={() => setShowInvitationForm((open) => !open)} className="flex items-center gap-2 rounded-xl bg-[#152a6b] px-3 py-2 text-xs font-medium text-white">
            {showInvitationForm ? <X className="h-4 w-4" /> : <MailPlus className="h-4 w-4" />}
            {showInvitationForm ? "Fermer" : "Inviter"}
          </button>
        </div>
        {showInvitationForm && <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div><h2 className="text-sm font-semibold text-card-foreground">Inviter un utilisateur</h2><p className="mt-1 text-xs text-muted-foreground">ECODIS envoie un lien sécurisé : aucun mot de passe n’est défini ici.</p></div>
          <input value={inviteName} onChange={(event) => setInviteName(event.target.value)} maxLength={120} placeholder="Nom complet" className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30" />
          <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" maxLength={320} placeholder="adresse@email.com" className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30" />
          <button onClick={() => void handleInvitation()} disabled={sendingInvitation || inviteName.trim().length < 2 || !inviteEmail.includes("@") } className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#152a6b] py-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{sendingInvitation && <Loader2 className="h-4 w-4 animate-spin" />}{sendingInvitation ? "Envoi…" : "Envoyer l’invitation"}</button>
        </section>}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Les rôles sont cumulables. Un motif d’au moins 10 caractères est requis et chaque modification est journalisée. Les rôles de super-administrateur ne sont pas modifiables depuis l’application.
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un utilisateur…" className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30" />
        </div>
        <div className="flex flex-wrap gap-2">
          <RoleFilter active={roleFilter === "all"} label="Tous" onClick={() => setRoleFilter("all")} />
          {(["content_editor", "moderator", "admin"] as AppRole[]).map((role) => <RoleFilter key={role} active={roleFilter === role} label={ROLE_LABELS[role]} onClick={() => setRoleFilter(role)} />)}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#152a6b]" /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">Aucun utilisateur trouvé.</p></div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((appUser) => (
              <UserCard
                key={appUser.id}
                appUser={appUser}
                expanded={expandedUserId === appUser.id}
                isCurrentUser={appUser.id === user.id}
                assignableRoles={assignableRoles}
                saving={savingUserId === appUser.id}
                accountActionLoading={accountActionUserId === appUser.id}
                resendRetrySeconds={Math.max(0, Math.ceil(((invitationCooldowns[appUser.id] ?? 0) - Date.now()) / 1000))}
                actorRoles={actorRoles}
                onToggle={() => setExpandedUserId(expandedUserId === appUser.id ? null : appUser.id)}
                onSave={(requestedRoles, reason) => handleSaveRoles(appUser, requestedRoles, reason)}
                onResendInvitation={() => handleResendInvitation(appUser)}
                onPasswordReset={() => handlePasswordReset(appUser)}
                onUpdateAccountStatus={(status, reason) => handleAccountStatus(appUser, status, reason)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function UserCard({ appUser, expanded, isCurrentUser, assignableRoles, actorRoles, saving, accountActionLoading, resendRetrySeconds, onToggle, onSave, onResendInvitation, onPasswordReset, onUpdateAccountStatus }: {
  appUser: AppUser;
  expanded: boolean;
  isCurrentUser: boolean;
  assignableRoles: AppRole[];
  actorRoles: AppRole[];
  saving: boolean;
  accountActionLoading: boolean;
  resendRetrySeconds: number;
  onToggle: () => void;
  onSave: (roles: AppRole[], reason: string) => Promise<void>;
  onResendInvitation: () => void;
  onPasswordReset: () => void;
  onUpdateAccountStatus: (status: "active" | "suspended", reason: string) => void;
}) {
  const isProtected = isCurrentUser || appUser.roles.includes("super_admin");
  const canManageStatus = !isProtected && (actorRoles.includes("super_admin") || !appUser.roles.includes("admin"));
  const initialRoles = useMemo(() => appUser.roles.filter((role) => role !== "user"), [appUser.roles]);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(initialRoles);
  const [reason, setReason] = useState("");
  const [statusReason, setStatusReason] = useState("");

  useEffect(() => {
    if (expanded) {
      setSelectedRoles(initialRoles);
      setReason("");
      setStatusReason("");
    }
  }, [appUser.id, expanded, initialRoles]);

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  };
  const requestedRoles = ["user", ...selectedRoles] as AppRole[];
  const hasChanges = !hasSameRoles([...new Set(appUser.roles)].sort(), [...new Set(requestedRoles)].sort());
  const canSave = !isProtected && hasChanges && reason.trim().length >= 10 && !saving;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/50">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${appUser.roles.includes("admin") || appUser.roles.includes("super_admin") ? "bg-amber-100" : "bg-[#152a6b]/10"}`}>
          {appUser.roles.includes("admin") || appUser.roles.includes("super_admin") ? <Crown className="h-5 w-5 text-amber-600" /> : <Shield className="h-5 w-5 text-[#152a6b]" />}
        </div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-medium text-card-foreground">{appUser.name}</p>{isCurrentUser && <span className="rounded bg-[#152a6b]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#152a6b]">Vous</span>}</div><p className="truncate text-[11px] text-muted-foreground">{appUser.email}</p></div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {expanded && <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
        <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{appUser.email}</span><span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Créé le {new Date(appUser.createdAt).toLocaleDateString("fr-FR")}</span></div>
        <div><p className="mb-2 text-xs font-medium text-card-foreground">Rôles attribués</p><div className="flex flex-wrap gap-2">{appUser.roles.map((role) => <RoleBadge key={role} role={role} />)}</div></div>
        <div><p className="mb-2 text-xs font-medium text-card-foreground">Statut du compte</p><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${appUser.accountStatus === "suspended" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{appUser.accountStatus === "suspended" ? "Suspendu" : "Actif"}</span>{appUser.accountStatus === "suspended" && appUser.suspensionReason && <p className="mt-2 text-xs text-muted-foreground">Motif : {appUser.suspensionReason}</p>}</div>
        <div><p className="mb-2 text-xs font-medium text-card-foreground">Autorisations effectives</p><div className="flex flex-wrap gap-2">{(appUser.permissions ?? []).length ? appUser.permissions!.map((permission) => <span key={permission} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700">{PERMISSION_LABELS[permission] ?? permission}</span>) : <span className="text-[11px] text-muted-foreground">Aucune autorisation élevée.</span>}</div></div>
        {!isProtected && <div className="grid gap-2 sm:grid-cols-2">
          {!appUser.emailConfirmedAt && <button onClick={onResendInvitation} disabled={accountActionLoading || resendRetrySeconds > 0} className="flex items-center justify-center gap-2 rounded-xl border border-[#152a6b]/20 bg-[#152a6b]/5 py-2.5 text-xs font-medium text-[#152a6b] disabled:opacity-40">{accountActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}{resendRetrySeconds > 0 ? `Réessayer dans ${resendRetrySeconds} s` : "Renvoyer l’invitation"}</button>}
          <button onClick={onPasswordReset} disabled={accountActionLoading} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-medium text-slate-700 disabled:opacity-40">{accountActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Envoyer un lien de mot de passe</button>
        </div>}
        {canManageStatus && <div className={`space-y-3 rounded-xl border p-3 ${appUser.accountStatus === "suspended" ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
          <div><p className="text-xs font-medium text-card-foreground">{appUser.accountStatus === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}</p><p className="mt-1 text-[11px] text-muted-foreground">La suspension bloque les nouvelles connexions et révoque les sessions actives.</p></div>
          <textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} maxLength={500} rows={2} placeholder={appUser.accountStatus === "suspended" ? "Motif de la réactivation…" : "Motif de la suspension…"} className="w-full rounded-lg border border-border bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30" />
          <button onClick={() => onUpdateAccountStatus(appUser.accountStatus === "suspended" ? "active" : "suspended", statusReason)} disabled={accountActionLoading || statusReason.trim().length < 10} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${appUser.accountStatus === "suspended" ? "bg-emerald-700" : "bg-[#9b1b30]"}`}>{accountActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}{appUser.accountStatus === "suspended" ? "Réactiver" : "Suspendre"}</button>
        </div>}
        {!isProtected && !canManageStatus && <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">Seul un super-administrateur peut modifier le statut d’un administrateur.</p>}
        {isProtected ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">{isCurrentUser ? "Vous ne pouvez pas modifier vos propres rôles." : "Le rôle super-administrateur est protégé et hors de ce flux."}</p> : <div className="space-y-3 rounded-xl border border-border p-3">
          <div><p className="mb-2 text-xs font-medium text-card-foreground">Modifier les rôles cumulables</p><div className="flex flex-wrap gap-2">{assignableRoles.map((role) => <label key={role} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs"><input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />{ROLE_LABELS[role]}</label>)}</div></div>
          <label className="block text-xs font-medium text-card-foreground">Motif de la modification <span className="font-normal text-muted-foreground">({reason.trim().length}/10 min.)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Ex. Validation du rôle de modérateur pour la communauté…" className="mt-2 w-full rounded-lg border border-border bg-white p-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30" /></label>
          <button onClick={() => void onSave(requestedRoles, reason)} disabled={!canSave} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#152a6b] py-2.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Enregistrement…" : "Enregistrer les rôles"}</button>
        </div>}
      </div>}
    </article>
  );
}

function AccessMessage({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 bg-background px-4 lg:ml-[240px] lg:max-w-3xl"><>{icon}</><h2 className="text-lg font-semibold text-foreground">{title}</h2><p className="text-center text-sm text-muted-foreground">{text}</p><button onClick={onAction} className="rounded-xl bg-[#152a6b] px-6 py-2 text-sm text-white">{action}</button></div>;
}

function Stat({ label, value, accent = "text-white" }: { label: string; value: number; accent?: string }) {
  return <div className="rounded-xl bg-white/10 p-3 text-center"><p className={`text-lg font-semibold ${accent}`}>{value}</p><p className="text-[10px] text-white/60">{label}</p></div>;
}

function RoleBadge({ role }: { role: AppRole }) {
  const color = role === "super_admin" ? "border-violet-200 bg-violet-50 text-violet-700" : role === "admin" ? "border-amber-200 bg-amber-50 text-amber-700" : role === "moderator" ? "border-teal-200 bg-teal-50 text-teal-700" : role === "content_editor" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-600";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${color}`}>{ROLE_LABELS[role]}</span>;
}

function RoleFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-[#152a6b] bg-[#152a6b] text-white" : "border-border bg-white text-muted-foreground"}`}>{label}</button>;
}
