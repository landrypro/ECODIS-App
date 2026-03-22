import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { fetchAllUsers, updateUserRole, deleteUser, AppUser } from "../api";
import {
  ArrowLeft,
  Users,
  Crown,
  ShieldOff,
  Search,
  AlertCircle,
  Loader2,
  Shield,
  UserX,
  ChevronDown,
  ChevronUp,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

export function AdminUsersPage() {
  const { user, accessToken, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken && isAdmin) {
      loadUsers();
    }
  }, [accessToken, isAdmin]);

  const loadUsers = async () => {
    if (!accessToken) return;
    setLoading(true);
    const data = await fetchAllUsers(accessToken);
    setUsers(data);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!accessToken) return;
    setUpdatingRole(userId);
    try {
      await updateUserRole(userId, newRole, accessToken);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(
        `Role mis a jour : ${newRole === "admin" ? "Administrateur" : "Membre"}`
      );
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise a jour du role");
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!accessToken) return;
    setDeletingUser(userId);
    try {
      await deleteUser(userId, accessToken);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDelete(null);
      toast.success("Utilisateur supprime avec succes");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeletingUser(null);
    }
  };

  // Auth guards
  if (!user) {
    return (
      <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-3xl lg:ml-[240px] flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-[#9b1b30]" />
        <p className="text-foreground text-center">
          Vous devez etre connecte pour acceder a cette page.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-2 bg-[#152a6b] text-white rounded-xl text-sm"
        >
          Se connecter
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-3xl lg:ml-[240px] flex flex-col items-center justify-center gap-4 px-4">
        <ShieldOff className="w-12 h-12 text-[#9b1b30]" />
        <h2 className="text-foreground text-lg font-semibold">
          Acces restreint
        </h2>
        <p className="text-muted-foreground text-center text-sm">
          Seuls les administrateurs peuvent gerer les utilisateurs.
        </p>
        <button
          onClick={() => navigate("/profil")}
          className="px-6 py-2 bg-[#152a6b] text-white rounded-xl text-sm"
        >
          Retour au profil
        </button>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const admins = filteredUsers.filter((u) => u.role === "admin");
  const members = filteredUsers.filter((u) => u.role !== "admin");

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-3xl lg:ml-[240px]">
      {/* Header */}
      <div className="sticky top-0 bg-[#152a6b] text-white z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[15px] flex-1">Gestion des utilisateurs</h1>
          <Users className="w-5 h-5 text-white/70" />
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-[#152a6b] px-4 pb-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-semibold">{users.length}</p>
            <p className="text-white/60 text-[10px]">Total</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-amber-400 text-lg font-semibold">
              {users.filter((u) => u.role === "admin").length}
            </p>
            <p className="text-white/60 text-[10px]">Admins</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-semibold">
              {users.filter((u) => u.role !== "admin").length}
            </p>
            <p className="text-white/60 text-[10px]">Membres</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#152a6b]" />
        </div>
      ) : (
        <div className="px-4 pb-8 space-y-4">
          {/* Admins section */}
          {admins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Administrateurs ({admins.length})
                </p>
              </div>
              <div className="space-y-2">
                {admins.map((u) => (
                  <UserCard
                    key={u.id}
                    appUser={u}
                    isCurrentUser={u.id === user?.id}
                    expanded={expandedUser === u.id}
                    onToggleExpand={() =>
                      setExpandedUser(expandedUser === u.id ? null : u.id)
                    }
                    onRoleChange={handleRoleChange}
                    onDelete={handleDeleteUser}
                    updatingRole={updatingRole === u.id}
                    deletingUser={deletingUser === u.id}
                    confirmDelete={confirmDelete === u.id}
                    onConfirmDelete={() => setConfirmDelete(u.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Members section */}
          {members.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Shield className="w-3.5 h-3.5 text-[#4a6fa5]" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Membres ({members.length})
                </p>
              </div>
              <div className="space-y-2">
                {members.map((u) => (
                  <UserCard
                    key={u.id}
                    appUser={u}
                    isCurrentUser={u.id === user?.id}
                    expanded={expandedUser === u.id}
                    onToggleExpand={() =>
                      setExpandedUser(expandedUser === u.id ? null : u.id)
                    }
                    onRoleChange={handleRoleChange}
                    onDelete={handleDeleteUser}
                    updatingRole={updatingRole === u.id}
                    deletingUser={deletingUser === u.id}
                    confirmDelete={confirmDelete === u.id}
                    onConfirmDelete={() => setConfirmDelete(u.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredUsers.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucun utilisateur trouve
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// UserCard sub-component
interface UserCardProps {
  appUser: AppUser;
  isCurrentUser: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRoleChange: (userId: string, role: string) => void;
  onDelete: (userId: string) => void;
  updatingRole: boolean;
  deletingUser: boolean;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function UserCard({
  appUser,
  isCurrentUser,
  expanded,
  onToggleExpand,
  onRoleChange,
  onDelete,
  updatingRole,
  deletingUser,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: UserCardProps) {
  const isAdmin = appUser.role === "admin";

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Main row */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/50 transition-colors"
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isAdmin ? "bg-amber-100" : "bg-[#152a6b]/10"
          }`}
        >
          {isAdmin ? (
            <Crown className="w-5 h-5 text-amber-600" />
          ) : (
            <Shield className="w-5 h-5 text-[#152a6b]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium text-card-foreground truncate">
              {appUser.name}
            </p>
            {isCurrentUser && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#152a6b]/10 text-[#152a6b] font-medium shrink-0">
                Vous
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {appUser.email}
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
            isAdmin
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-gray-100 text-gray-600 border border-gray-200"
          }`}
        >
          {isAdmin ? "Admin" : "Membre"}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          {/* User details */}
          <div className="grid grid-cols-2 gap-2 py-3">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground truncate">
                {appUser.email}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {new Date(appUser.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {appUser.lastSignIn && (
              <div className="flex items-center gap-2 col-span-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  Derniere connexion :{" "}
                  {new Date(appUser.lastSignIn).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {/* Role toggle */}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  onRoleChange(
                    appUser.id,
                    isAdmin ? "user" : "admin"
                  )
                }
                disabled={updatingRole || isCurrentUser}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isAdmin
                    ? "bg-gray-100 text-gray-700 border border-gray-200 active:bg-gray-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200 active:bg-amber-100"
                }`}
              >
                {updatingRole ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isAdmin ? (
                  <>
                    <Shield className="w-4 h-4" />
                    Retirer admin
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Promouvoir admin
                  </>
                )}
              </button>
            </div>

            {/* Delete */}
            {!isCurrentUser && (
              <>
                {confirmDelete ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-700 text-xs mb-2.5 text-center">
                      Confirmer la suppression de{" "}
                      <strong>{appUser.name}</strong> ? Cette action est
                      irreversible.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onCancelDelete}
                        className="flex-1 py-2 rounded-lg text-xs font-medium bg-white text-gray-700 border border-gray-200"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => onDelete(appUser.id)}
                        disabled={deletingUser}
                        className="flex-1 py-2 rounded-lg text-xs font-medium bg-[#9b1b30] text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {deletingUser ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Supprimer
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onConfirmDelete}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-red-50 text-[#9b1b30] border border-red-200 active:bg-red-100 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    Supprimer l'utilisateur
                  </button>
                )}
              </>
            )}

            {isCurrentUser && (
              <p className="text-center text-[10px] text-muted-foreground italic">
                Vous ne pouvez pas modifier votre propre compte ici
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}