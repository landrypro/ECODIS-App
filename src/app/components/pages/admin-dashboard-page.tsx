import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth-context";
// Platform-utils import removed — dashboard is now responsive on all viewports
import {
  fetchAdminStats, fetchAllUsers, fetchAdminMessages, fetchAdminSeries, fetchAppConfig,
  updateAppConfig, fetchAuditLogs, clearAuditLogs, fetchStorageStats,
  updateUserRoles, deleteUser, deleteMessage, deleteSeries, bulkDeleteMessages,
  fetchSystemHealth, fetchCategories, updateCategories,
  fetchAnnouncements, createAnnouncement, deleteAnnouncement, exportDataAsJson,
  createMessage, updateMessage, signupUser, createSeries, transitionMessage, transitionSeries,
  AdminStats, AppRole, AppUser, Message, Series, AppConfig, AuditLog, StorageStats, EditorialStatus,
  SystemHealth, Announcement,
} from "../api";
import {
  LayoutDashboard, Users, FileText, Settings, Shield, HardDrive, BarChart3,
  Loader2, ShieldOff, Crown, Search, Trash2, Save, X, RefreshCw, AlertTriangle,
  CheckCircle, Eye, Mic, Video, FileText as FileTextIcon, Heart, MessageSquare, Layers,
  TrendingUp, Percent, Bell, Download, Plus, ArrowLeft,
  Activity, Info, Database, ChevronRight, Tag, Send,
  CheckCircle2, XCircle, Palette,
  Globe, Lock, Zap, FolderOpen, Megaphone, FileDown, Upload, UserPlus,
  Image, Clock, BookOpen,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";

// ==================== TYPES ====================
type Section =
  | "overview" | "users" | "content" | "config" | "appearance"
  | "categories" | "notifications" | "security" | "storage" | "stats" | "system" | "export";

interface NavItem { key: Section; label: string; icon: any; group: string }

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, group: "Principal" },
  { key: "users", label: "Utilisateurs", icon: Users, group: "Principal" },
  { key: "content", label: "Gestion du contenu", icon: FileText, group: "Principal" },
  { key: "stats", label: "Statistiques", icon: BarChart3, group: "Principal" },
  { key: "config", label: "Configuration", icon: Settings, group: "Parametres" },
  { key: "appearance", label: "Apparence", icon: Palette, group: "Parametres" },
  { key: "categories", label: "Categories", icon: Tag, group: "Parametres" },
  { key: "notifications", label: "Annonces", icon: Bell, group: "Parametres" },
  { key: "security", label: "Securite & Audit", icon: Shield, group: "Systeme" },
  { key: "storage", label: "Stockage", icon: HardDrive, group: "Systeme" },
  { key: "system", label: "Sante systeme", icon: Zap, group: "Systeme" },
  { key: "export", label: "Export de donnees", icon: FileDown, group: "Systeme" },
];

const PIE_COLORS = ["#152a6b", "#9b1b30", "#4a6fa5"];

// ==================== HELPERS ====================
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const u = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${u[i]}`;
}

function formatDateFr(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "A l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `Il y a ${days}j`;
  return formatDateFr(d);
}

// ==================== SHARED UI ====================
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-border shadow-sm ${className}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, actions }: { icon: any; title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[16px] font-bold text-foreground flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-[#152a6b]" /> {title}
      </h2>
      {actions}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[22px] font-bold text-foreground leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </Card>
  );
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
      <div className="pr-4">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${value ? "bg-[#152a6b]" : "bg-gray-300"}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all ${value ? "left-5.5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />;
}

// ==================== MAIN COMPONENT ====================
export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, accessToken, isAdmin, roles, isLoading: authLoading } = useAuth();
  // Platform detection removed — dashboard works on all viewports
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [categories, setCategoriesState] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (accessToken && isAdmin) loadAll();
  }, [accessToken, isAdmin]);

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [st, us, ms, sr, cf, al, sg, hl, cats, ann] = await Promise.all([
        fetchAdminStats(accessToken),
        fetchAllUsers(accessToken),
        fetchAdminMessages(accessToken),
        fetchAdminSeries(accessToken),
        fetchAppConfig(accessToken),
        fetchAuditLogs(accessToken),
        fetchStorageStats(accessToken),
        fetchSystemHealth(accessToken),
        fetchCategories(accessToken),
        fetchAnnouncements(accessToken),
      ]);
      setStats(st);
      setUsers(us);
      setMessages(ms);
      setSeries(sr);
      setConfig(cf);
      setAuditLogs(al);
      setStorage(sg);
      setHealth(hl);
      setCategoriesState(cats);
      setAnnouncements(ann);
    } catch (e) {
      console.error("Load dashboard error:", e);
    }
    setLoading(false);
  }, [accessToken]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <ShieldOff className="w-14 h-14 text-[#9b1b30]/50" />
        <h2 className="text-lg font-semibold">Acces restreint</h2>
        <p className="text-sm text-muted-foreground text-center">Seuls les administrateurs connectes peuvent acceder au dashboard.</p>
        <button onClick={() => navigate("/login")} className="px-5 py-2.5 bg-[#152a6b] text-white rounded-xl text-sm font-semibold">Se connecter</button>
      </div>
    );
  }

  const groups = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#152a6b] to-[#4a6fa5] flex items-center justify-center shrink-0">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[14px] font-bold text-[#152a6b] leading-tight truncate">Admin ECODIS</h1>
          <p className="text-[10px] text-muted-foreground">Tableau de bord</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="mb-3">
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider px-3 mb-1.5">{group}</p>
            {items.map((item) => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key === "users") navigate("/admin/users");
                    else setActiveSection(item.key);
                    setMobileSidebar(false);
                  }}
                  title={item.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-0.5 text-[12px] font-medium transition-all ${
                    active
                      ? "bg-[#152a6b] text-white shadow-md shadow-[#152a6b]/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : ""}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border">
        <button onClick={() => navigate("/")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors">
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Retour a l'app</span>
        </button>
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="w-7 h-7 rounded-full bg-[#152a6b]/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#152a6b]">{user.user_metadata?.name?.charAt(0)?.toUpperCase() || "A"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">{user.user_metadata?.name || "Admin"}</p>
            <p className="text-[9px] text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f0f1f6] flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-border flex-col transition-all duration-300 ${sidebarOpen ? "w-[260px]" : "w-[68px]"}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebar(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-white border-r border-border flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-[260px]" : "lg:ml-[68px]"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
            <button onClick={() => { if (window.innerWidth >= 1024) setSidebarOpen(!sidebarOpen); else setMobileSidebar(!mobileSidebar); }} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{NAV_ITEMS.find(n => n.key === activeSection)?.label}</span>
            </div>
            <div className="flex-1" />
            <span className="text-[10px] px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold border border-amber-200">Admin</span>
            {health && (
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 ${
                health.status === "healthy" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                health.status === "degraded" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200"
              }`}>
                <StatusDot ok={health.status === "healthy"} />
                {health.status === "healthy" ? "En ligne" : health.status === "degraded" ? "Degrade" : "Hors ligne"}
              </span>
            )}
            <button onClick={loadAll} disabled={loading} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="max-w-[1200px] mx-auto px-3 py-4 lg:px-6 lg:py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Chargement du tableau de bord...</p>
            </div>
          ) : (
            <>
              {activeSection === "overview" && <OverviewSection stats={stats} users={users} messages={messages} series={series} auditLogs={auditLogs} health={health} navigate={navigate} setActiveSection={setActiveSection} />}
              {activeSection === "users" && <UsersSection users={users} setUsers={setUsers} accessToken={accessToken!} currentUserId={user.id} currentRoles={roles} />}
              {activeSection === "content" && <ContentSection messages={messages} series={series} setMessages={setMessages} setSeries={setSeries} accessToken={accessToken!} navigate={navigate} />}
              {activeSection === "config" && <ConfigSection config={config} setConfig={setConfig} accessToken={accessToken!} />}
              {activeSection === "appearance" && <AppearanceSection config={config} setConfig={setConfig} accessToken={accessToken!} />}
              {activeSection === "categories" && <CategoriesSection categories={categories} setCategories={setCategoriesState} messages={messages} accessToken={accessToken!} />}
              {activeSection === "notifications" && <NotificationsSection announcements={announcements} setAnnouncements={setAnnouncements} accessToken={accessToken!} />}
              {activeSection === "security" && <SecuritySection auditLogs={auditLogs} setAuditLogs={setAuditLogs} accessToken={accessToken!} />}
              {activeSection === "storage" && <StorageSection storage={storage} />}
              {activeSection === "stats" && <StatsSection stats={stats} navigate={navigate} />}
              {activeSection === "system" && <SystemSection health={health} onRefresh={loadAll} />}
              {activeSection === "export" && <ExportSection accessToken={accessToken!} users={users} messages={messages} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== OVERVIEW ====================
function OverviewSection({ stats, users, messages, series, auditLogs, health, navigate, setActiveSection }: any) {
  if (!stats) return <p className="text-muted-foreground text-center py-12">Aucune donnee disponible</p>;

  const kpis = [
    { label: "Utilisateurs", value: stats.totals.users, icon: Users, color: "bg-[#152a6b]/10 text-[#152a6b]" },
    { label: "Messages", value: stats.totals.messages, icon: MessageSquare, color: "bg-[#4a6fa5]/10 text-[#4a6fa5]" },
    { label: "Commentaires", value: stats.totals.comments, icon: MessageSquare, color: "bg-emerald-100 text-emerald-600" },
    { label: "Favoris", value: stats.totals.favorites, icon: Heart, color: "bg-[#9b1b30]/10 text-[#9b1b30]" },
    { label: "Series", value: stats.totals.series, icon: Layers, color: "bg-purple-100 text-purple-600" },
    { label: "Engagement", value: `${stats.engagementRate}%`, icon: Percent, color: "bg-amber-100 text-amber-600" },
  ];

  const recentLogs = auditLogs.slice(0, 6);
  const recentUsers = [...users].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      <SectionHeader icon={LayoutDashboard} title="Vue d'ensemble" />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value} color={k.color} />
        ))}
      </div>

      {/* System status bar */}
      {health && (
        <Card className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <StatusDot ok={health.status === "healthy"} />
              <span className="text-[12px] font-semibold text-foreground">Systeme : {health.status === "healthy" ? "Operationnel" : "Probleme detecte"}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><StatusDot ok={health.dbConnected} /> Base de donnees</span>
              <span className="flex items-center gap-1"><StatusDot ok={health.authServiceUp} /> Authentification</span>
              <span className="flex items-center gap-1"><StatusDot ok={health.storageConnected} /> Stockage</span>
              <span>v{health.serverVersion}</span>
              <span>{health.kvEntries} entrees KV</span>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" /> Activite (14 derniers jours)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.activityTimeline.slice(-14)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#152a6b" stopOpacity={0.3} /><stop offset="95%" stopColor="#152a6b" stopOpacity={0} /></linearGradient>
                <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9b1b30" stopOpacity={0.3} /><stop offset="95%" stopColor="#9b1b30" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,42,107,0.06)" />
              <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} tick={{ fontSize: 9, fill: "#6b7194" }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: "#6b7194" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="comments" name="Commentaires" stroke="#152a6b" fill="url(#gC)" strokeWidth={2} />
              <Area type="monotone" dataKey="favorites" name="Favoris" stroke="#9b1b30" fill="url(#gF)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent audit */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Journal recent
            </h3>
            <button onClick={() => setActiveSection("security")} className="text-[10px] text-[#152a6b] hover:underline font-medium">Voir tout</button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Aucune activite</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {recentLogs.map((log: AuditLog) => (
                <div key={log.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-[#152a6b]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-[#152a6b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground truncate">{log.description}</p>
                    <p className="text-[10px] text-muted-foreground">{log.userEmail} · {relativeTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent users */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Derniers inscrits
            </h3>
            <button onClick={() => navigate("/admin/users")} className="text-[10px] text-[#152a6b] hover:underline font-medium">Gerer</button>
          </div>
          <div className="space-y-1.5">
            {recentUsers.map((u: AppUser) => (
              <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-[#152a6b]/10 text-[#152a6b]"}`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-[9px] text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Content breakdown */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" /> Repartition du contenu
          </h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="45%" height={120}>
              <PieChart>
                <Pie data={[
                  { name: "Audio", value: stats.messagesByType.audio || 0 },
                  { name: "Video", value: stats.messagesByType.video || 0 },
                  { name: "Texte", value: stats.messagesByType.text || 0 },
                ]} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">
                  {[0, 1, 2].map((i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {[
                { name: "Audio", count: stats.messagesByType.audio || 0, color: "#152a6b" },
                { name: "Video", count: stats.messagesByType.video || 0, color: "#9b1b30" },
                { name: "Texte", count: stats.messagesByType.text || 0, color: "#4a6fa5" },
              ].map((t) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-[11px] text-foreground flex-1">{t.name}</span>
                  <span className="text-[11px] font-bold text-foreground">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" /> Actions rapides
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Nouveau message", icon: Plus, color: "bg-[#152a6b]", onClick: () => setActiveSection("content") },
              { label: "Creer programme", icon: BookOpen, color: "bg-purple-600", onClick: () => setActiveSection("content") },
              { label: "Gerer les utilisateurs", icon: UserPlus, color: "bg-[#9b1b30]", onClick: () => navigate("/admin/users") },
              { label: "Exporter", icon: Download, color: "bg-emerald-600", onClick: () => setActiveSection("export") },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick} className="flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left active:scale-[0.98]">
                <div className={`w-8 h-8 rounded-lg ${a.color} flex items-center justify-center shrink-0`}>
                  <a.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-foreground leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==================== USERS ====================
const ROLE_LABELS: Record<AppRole, string> = {
  user: "Membre",
  content_editor: "Éditeur",
  moderator: "Modérateur",
  admin: "Admin",
  super_admin: "Super-admin",
};

function UsersSection({ users, setUsers, accessToken, currentUserId, currentRoles }: { users: AppUser[]; setUsers: any; accessToken: string; currentUserId: string; currentRoles: AppRole[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const admins = users.filter((u) => u.roles.some((role) => role === "admin" || role === "super_admin")).length;
  const assignableRoles: AppRole[] = currentRoles.includes("super_admin")
    ? ["content_editor", "moderator", "admin"]
    : ["content_editor", "moderator"];

  const handleRoleToggle = async (target: AppUser, role: AppRole) => {
    const nextRoles = target.roles.includes(role)
      ? target.roles.filter((assignedRole) => assignedRole !== role)
      : [...target.roles, role];
    setUpdatingRole(target.id);
    try {
      const updated = await updateUserRoles(target.id, nextRoles, "Mise à jour depuis l'administration", accessToken);
      setUsers((prev: AppUser[]) => prev.map((u) => u.id === target.id ? { ...u, role: updated.role, roles: updated.roles } : u));
      toast.success("Rôles mis à jour");
    } catch (e: any) { toast.error(e.message); } finally { setUpdatingRole(null); }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Supprimer cet utilisateur ? Cette action est irreversible.")) return;
    setDeletingUser(userId);
    try {
      await deleteUser(userId, accessToken);
      setUsers((prev: AppUser[]) => prev.filter((u) => u.id !== userId));
      toast.success("Utilisateur supprime");
    } catch (e: any) { toast.error(e.message); } finally { setDeletingUser(null); }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newName.trim() || newPassword.length < 6) {
      toast.error("Veuillez remplir tous les champs (mot de passe min. 6 caracteres)");
      return;
    }
    setCreating(true);
    try {
      const result = await signupUser(newEmail.trim(), newPassword, newName.trim());
      if (result?.user) {
        setUsers((prev: AppUser[]) => [...prev, {
          id: result.user.id,
          email: result.user.email || newEmail.trim(),
          name: newName.trim(),
          role: result.role || "user",
          roles: result.roles || ["user"],
          createdAt: new Date().toISOString(),
          lastSignIn: null,
        }]);
        toast.success(`Utilisateur "${newName.trim()}" cree avec succes`);
        setNewEmail("");
        setNewName("");
        setNewPassword("");
        setShowCreateForm(false);
      }
    } catch (e: any) { toast.error(`Erreur: ${e.message}`); } finally { setCreating(false); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader icon={Users} title="Gestion des utilisateurs" actions={
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="px-4 py-2 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-1.5 active:scale-[0.98]">
          {showCreateForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {showCreateForm ? "Annuler" : "Creer un utilisateur"}
        </button>
      } />

      {/* Create user form */}
      {showCreateForm && (
        <Card className="p-6 border-l-4 border-l-[#152a6b]">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-[#152a6b]" /> Creer un nouvel utilisateur
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Nom complet *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jean Dupont" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Email *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jean@eglise.org" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Mot de passe * (min 6 car.)</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCreateUser} disabled={creating || !newEmail.trim() || !newName.trim() || newPassword.length < 6} className="px-5 py-2.5 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Creer le compte
            </button>
            <p className="text-[10px] text-muted-foreground">L'utilisateur sera cree avec le role "Membre". Vous pourrez le promouvoir admin apres creation.</p>
          </div>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard icon={Users} label="Total utilisateurs" value={users.length} color="bg-[#152a6b]/10 text-[#152a6b]" />
        <KpiCard icon={Crown} label="Administrateurs" value={admins} color="bg-amber-100 text-amber-600" />
        <KpiCard icon={Users} label="Membres" value={users.length - admins} color="bg-[#4a6fa5]/10 text-[#4a6fa5]" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email..." className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
        </div>
        <div className="flex gap-1">
          {["all", "admin", "user"].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${roleFilter === r ? "bg-[#152a6b] text-white" : "bg-white border text-muted-foreground hover:text-foreground"}`}>
              {r === "all" ? "Tous" : r === "admin" ? "Admins" : "Membres"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Utilisateur</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Role</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Inscription</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Derniere connexion</th>
              <th className="text-right text-[11px] font-semibold text-muted-foreground px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-[#152a6b]/10 text-[#152a6b]"}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">
                        {u.name}
                        {u.id === currentUserId && <span className="text-[9px] bg-[#152a6b]/10 text-[#152a6b] px-1.5 py-0.5 rounded ml-1.5">Vous</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((role) => <span key={role} className={`text-[10px] px-2 py-1 rounded-full font-semibold ${role === "admin" || role === "super_admin" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>{ROLE_LABELS[role]}</span>)}
                  </div>
                </td>
                <td className="px-5 py-3 text-[11px] text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-5 py-3 text-[11px] text-muted-foreground">{u.lastSignIn ? relativeTime(u.lastSignIn) : "Jamais"}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {assignableRoles.map((role) => <button
                      key={role}
                      onClick={() => handleRoleToggle(u, role)}
                      disabled={updatingRole === u.id || u.id === currentUserId || u.roles.includes("super_admin")}
                      className={`px-2 py-1.5 text-[10px] rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors font-medium ${u.roles.includes(role) ? "bg-[#152a6b] text-white" : ""}`}
                    >
                      {updatingRole === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : ROLE_LABELS[role]}
                    </button>)}
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={deletingUser === u.id || u.id === currentUserId}
                      className="w-8 h-8 rounded-lg border border-[#9b1b30]/20 hover:bg-[#9b1b30]/10 flex items-center justify-center disabled:opacity-30 transition-colors"
                    >
                      {deletingUser === u.id ? <Loader2 className="w-3 h-3 animate-spin text-[#9b1b30]" /> : <Trash2 className="w-3.5 h-3.5 text-[#9b1b30]" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Aucun utilisateur trouve</div>}
      </Card>
    </div>
  );
}

// ==================== CONTENT ====================
const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  audio: ["Predications", "Enseignements", "Louanges", "Temoignages"],
  video: ["Cultes", "Seminaires", "Formations", "Conferences"],
  text: ["Etudes bibliques", "Meditations", "Articles", "Notes de predication"],
};

const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  draft: "Brouillon",
  in_review: "En revue",
  scheduled: "Planifie",
  published: "Publie",
  archived: "Archive",
};

const EDITORIAL_STATUS_STYLES: Record<EditorialStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-zinc-200 text-zinc-700",
};

function ContentSection({ messages, series, setMessages, setSeries, accessToken, navigate }: any) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<"messages" | "series">("messages");
  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddSeries, setShowAddSeries] = useState(false);

  const replaceMessage = (updated: Message) => setMessages((previous: Message[]) => previous.map((item) => item.id === updated.id ? updated : item));
  const replaceSeries = (updated: Series) => setSeries((previous: Series[]) => previous.map((item) => item.id === updated.id ? updated : item));
  const transitionEntity = async (kind: "message" | "series", id: string, status: EditorialStatus) => {
    let scheduledAt: string | undefined;
    if (status === "scheduled") {
      const input = window.prompt("Date de publication (ex. 2026-08-22T09:00:00Z) :");
      if (!input) return;
      scheduledAt = input;
    }
    try {
      const updated = kind === "message"
        ? await transitionMessage(id, status, accessToken, scheduledAt)
        : await transitionSeries(id, status, accessToken, scheduledAt);
      if (kind === "message") replaceMessage(updated as Message);
      else replaceSeries(updated as Series);
      toast.success(`Statut mis a jour : ${EDITORIAL_STATUS_LABELS[status]}`);
    } catch (error: any) {
      toast.error(error.message || "Transition editoriale impossible");
    }
  };

  const availableTransitions = (status: EditorialStatus): EditorialStatus[] => {
    const transitions: Record<EditorialStatus, EditorialStatus[]> = {
    draft: ["in_review", "archived"],
    in_review: ["draft", "scheduled", "published", "archived"],
    scheduled: ["draft", "in_review", "published", "archived"],
    published: ["draft", "archived"],
    archived: ["draft"],
    };
    return transitions[status];
  };

  const filtered = messages.filter((m: Message) => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const toggleSelect = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((m: Message) => m.id))); };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Supprimer ${selected.size} message(s) ? Action irreversible.`)) return;
    setDeleting(true);
    try {
      await bulkDeleteMessages(Array.from(selected), accessToken);
      setMessages((prev: Message[]) => prev.filter(m => !selected.has(m.id)));
      toast.success(`${selected.size} message(s) supprime(s)`);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message); } finally { setDeleting(false); }
  };

  const typeIcon = (t: string) => t === "audio" ? <Mic className="w-3.5 h-3.5" /> : t === "video" ? <Video className="w-3.5 h-3.5" /> : <FileTextIcon className="w-3.5 h-3.5" />;
  const typeColor = (t: string) => t === "audio" ? "bg-[#152a6b]/10 text-[#152a6b]" : t === "video" ? "bg-[#9b1b30]/10 text-[#9b1b30]" : "bg-[#4a6fa5]/10 text-[#4a6fa5]";

  return (
    <div className="space-y-5">
      <SectionHeader icon={FileText} title="Gestion du contenu" actions={
        <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5">
          <button onClick={() => setView("messages")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${view === "messages" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>Messages ({messages.length})</button>
          <button onClick={() => setView("series")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${view === "series" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>Series ({series.length})</button>
        </div>
      } />

      {view === "messages" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un message..." className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
            <div className="flex gap-1">
              {["all", "audio", "video", "text"].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${typeFilter === t ? "bg-[#152a6b] text-white" : "bg-white border text-muted-foreground hover:text-foreground"}`}>
                  {t === "all" ? "Tous" : t === "audio" ? "Audio" : t === "video" ? "Video" : "Textes"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddMessage(!showAddMessage)} className={`px-3.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 active:scale-[0.98] ${showAddMessage ? "bg-muted text-foreground border border-border" : "bg-[#152a6b] text-white"}`}>
              {showAddMessage ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showAddMessage ? "Fermer" : "Nouveau message"}
            </button>
            {selected.size > 0 && (
              <button onClick={handleBulkDelete} disabled={deleting} className="px-3.5 py-2 bg-[#9b1b30] text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Supprimer ({selected.size})
              </button>
            )}
          </div>

          {/* Inline Add Message Form */}
          {showAddMessage && (
            <AddMessageForm accessToken={accessToken} onCreated={(msg: Message) => {
              setMessages((prev: Message[]) => [msg, ...prev]);
              setShowAddMessage(false);
            }} />
          )}

          <Card className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded" /></th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-3">Message</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-3">Type</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-3">Categorie</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-3">Statut</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground px-4 py-3">Date</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: Message) => (
                  <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${selected.has(m.id) ? "bg-[#152a6b]/5" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg ${typeColor(m.type)} flex items-center justify-center shrink-0`}>{typeIcon(m.type)}</div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate max-w-[280px]">{m.title}</p>
                          <p className="text-[10px] text-muted-foreground">{m.author}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColor(m.type)}`}>{m.type}</span></td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{m.category}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${EDITORIAL_STATUS_STYLES[m.status]}`}>{EDITORIAL_STATUS_LABELS[m.status]}</span></td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button onClick={() => navigate(`/message/${m.id}`)} className="w-7 h-7 rounded-lg border hover:bg-muted flex items-center justify-center"><Eye className="w-3 h-3" /></button>
                        <button onClick={async () => {
                          const updated = await updateMessage(m.id, { offlineDownloadable: !m.offlineDownloadable }, accessToken);
                          if (updated) setMessages((items: Message[]) => items.map((item) => item.id === m.id ? updated : item));
                        }} className={`px-2 py-1 rounded-lg border text-[10px] ${m.offlineDownloadable ? "text-emerald-700 border-emerald-200" : "text-muted-foreground"}`}>
                          {m.offlineDownloadable ? "Hors ligne autorise" : "Hors ligne bloque"}
                        </button>
                        {availableTransitions(m.status).map((status) => <button key={status} onClick={() => transitionEntity("message", m.id, status)} className="px-2 py-1 rounded-lg border text-[10px] hover:bg-muted">{EDITORIAL_STATUS_LABELS[status]}</button>)}
                        {m.status === "draft" && <button onClick={async () => { if (!confirm("Supprimer ce brouillon ?")) return; await deleteMessage(m.id, accessToken); setMessages((p: Message[]) => p.filter(x => x.id !== m.id)); toast.success("Brouillon supprime"); }} className="w-7 h-7 rounded-lg border border-[#9b1b30]/20 hover:bg-[#9b1b30]/10 flex items-center justify-center"><Trash2 className="w-3 h-3 text-[#9b1b30]" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Aucun message trouve</div>}
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddSeries(!showAddSeries)} className={`px-3.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 active:scale-[0.98] ${showAddSeries ? "bg-muted text-foreground border border-border" : "bg-[#152a6b] text-white"}`}>
              {showAddSeries ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showAddSeries ? "Fermer" : "Nouveau programme"}
            </button>
          </div>

          {/* Inline Create Series Form */}
          {showAddSeries && (
            <CreateSeriesForm accessToken={accessToken} messages={messages} onCreated={(s: Series) => {
              setSeries((prev: Series[]) => [s, ...prev]);
              setShowAddSeries(false);
            }} />
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {series.map((s: Series) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><Layers className="w-5 h-5 text-purple-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{s.author} · {s.totalModules} modules</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${EDITORIAL_STATUS_STYLES[s.status]}`}>{EDITORIAL_STATUS_LABELS[s.status]}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/series/${s.id}`)} className="flex-1 py-2 text-[11px] bg-muted rounded-lg text-center hover:bg-muted/80 font-medium">Voir</button>
                  {availableTransitions(s.status).map((status) => <button key={status} onClick={() => transitionEntity("series", s.id, status)} className="py-2 px-2 text-[10px] border rounded-lg hover:bg-muted">{EDITORIAL_STATUS_LABELS[status]}</button>)}
                  {s.status === "draft" && <button onClick={async () => { if (!confirm("Supprimer ce brouillon ?")) return; await deleteSeries(s.id, accessToken); setSeries((p: Series[]) => p.filter(x => x.id !== s.id)); toast.success("Brouillon supprime"); }} className="py-2 px-4 text-[11px] bg-[#9b1b30]/10 text-[#9b1b30] rounded-lg hover:bg-[#9b1b30]/20 font-medium">Supprimer</button>}
                </div>
              </Card>
            ))}
            {series.length === 0 && !showAddSeries && <p className="text-muted-foreground text-sm col-span-3 text-center py-12">Aucune serie</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== ADD MESSAGE FORM ====================
function AddMessageForm({ accessToken, onCreated }: { accessToken: string; onCreated: (msg: Message) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<"audio" | "video" | "text">("audio");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { setCategory(""); }, [type]);

  const canSubmit = title.trim() && author.trim() && category && (type === "text" ? description.trim() : true);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPublishing(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("title", title.trim());
      formData.append("author", author.trim());
      formData.append("category", category);
      if (description.trim()) formData.append("description", description.trim());
      if (duration.trim()) formData.append("duration", duration.trim());
      if (thumbnail.trim()) formData.append("thumbnail", thumbnail.trim());
      if (mediaFile) formData.append("media", mediaFile);

      const msg = await createMessage(formData, accessToken);
      if (msg) {
        toast.success(`Brouillon "${title.trim()}" cree avec succes !`);
        onCreated(msg);
      }
    } catch (e: any) { toast.error(`Erreur: ${e.message}`); } finally { setPublishing(false); }
  };

  const typeConfig = [
    { key: "audio" as const, icon: Mic, label: "Audio", color: "bg-[#152a6b]", ring: "ring-[#152a6b]/20" },
    { key: "video" as const, icon: Video, label: "Video", color: "bg-[#9b1b30]", ring: "ring-[#9b1b30]/20" },
    { key: "text" as const, icon: FileTextIcon, label: "Texte", color: "bg-[#4a6fa5]", ring: "ring-[#4a6fa5]/20" },
  ];

  return (
    <Card className="p-6 border-l-4 border-l-[#152a6b]">
      <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-5">
        <Plus className="w-4 h-4 text-[#152a6b]" /> Creer un brouillon de message
      </h3>

      {/* Type selector */}
      <div className="mb-5">
        <label className="text-[11px] font-semibold text-muted-foreground mb-2 block">Type de message</label>
        <div className="flex gap-2">
          {typeConfig.map(tc => (
            <button key={tc.key} onClick={() => setType(tc.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${type === tc.key ? `${tc.color} text-white shadow-md ring-2 ${tc.ring}` : "bg-white border border-border text-muted-foreground hover:text-foreground"}`}>
              <tc.icon className="w-4 h-4" /> {tc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Titre *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du message" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Auteur *</label>
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Nom de l'auteur" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-muted-foreground mb-2 block">Categorie *</label>
        <div className="flex flex-wrap gap-1.5">
          {(CATEGORIES_BY_TYPE[type] || []).map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${category === cat ? "bg-[#152a6b] text-white" : "bg-white border border-border text-muted-foreground hover:text-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {type !== "text" && (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1"><Clock className="w-3 h-3" /> Duree</label>
            <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="45:30" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
          </div>
        )}
        {type === "video" && (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1"><Image className="w-3 h-3" /> URL vignette</label>
            <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="https://..." className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">
          {type === "text" ? "Contenu du texte *" : "Description (optionnel)"}
        </label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={type === "text" ? "Redigez le contenu du message..." : "Description du message..."} rows={type === "text" ? 6 : 3} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none resize-none" />
      </div>

      {/* File upload (audio/video) */}
      {type !== "text" && (
        <div className="mb-5">
          <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1"><Upload className="w-3 h-3" /> Fichier media ({type})</label>
          <input ref={fileRef} type="file" accept={type === "audio" ? "audio/*" : "video/*"} onChange={e => setMediaFile(e.target.files?.[0] || null)} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl py-4 hover:border-[#152a6b]/40 hover:bg-[#152a6b]/5 transition-colors flex flex-col items-center gap-2">
            {mediaFile ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-[12px] text-foreground font-medium">{mediaFile.name}</span>
                <span className="text-[10px] text-muted-foreground">({(mediaFile.size / 1024 / 1024).toFixed(1)} Mo)</span>
                <button onClick={(e) => { e.stopPropagation(); setMediaFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="ml-2 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><X className="w-3 h-3 text-red-600" /></button>
              </div>
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted-foreground/50" />
                <span className="text-[11px] text-muted-foreground">Cliquez pour selectionner un fichier {type}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button onClick={handleSubmit} disabled={publishing || !canSubmit} className="px-5 py-2.5 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enregistrer le brouillon
        </button>
        {!canSubmit && <p className="text-[10px] text-muted-foreground">Remplissez les champs marques * pour publier</p>}
      </div>
    </Card>
  );
}

// ==================== CREATE SERIES FORM ====================
function CreateSeriesForm({ accessToken, messages, onCreated }: { accessToken: string; messages: Message[]; onCreated: (s: Series) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [msgSearch, setMsgSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const filteredMsgs = messages.filter((m: Message) =>
    m.title.toLowerCase().includes(msgSearch.toLowerCase()) || m.author.toLowerCase().includes(msgSearch.toLowerCase())
  );

  const toggleMsg = (id: string) => {
    setSelectedMsgIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const moveMsg = (id: string, dir: "up" | "down") => {
    const idx = selectedMsgIds.indexOf(id);
    if (idx < 0) return;
    const newIds = [...selectedMsgIds];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newIds.length) return;
    [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
    setSelectedMsgIds(newIds);
  };

  const selectedMessages = selectedMsgIds.map(id => messages.find((m: Message) => m.id === id)).filter(Boolean) as Message[];

  const canCreate = title.trim() && author.trim() && selectedMsgIds.length >= 2;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const s = await createSeries({
        title: title.trim(),
        description: description.trim(),
        author: author.trim(),
        category: category.trim() || "Formation",
        coverImage: coverImage.trim(),
        messageIds: selectedMsgIds,
      }, accessToken);
      if (s) {
        toast.success(`Brouillon de programme "${title.trim()}" cree avec ${selectedMsgIds.length} modules !`);
        onCreated(s);
      }
    } catch (e: any) { toast.error(`Erreur: ${e.message}`); } finally { setCreating(false); }
  };

  const typeIcon = (t: string) => t === "audio" ? <Mic className="w-3.5 h-3.5" /> : t === "video" ? <Video className="w-3.5 h-3.5" /> : <FileTextIcon className="w-3.5 h-3.5" />;
  const typeColor = (t: string) => t === "audio" ? "bg-[#152a6b]/10 text-[#152a6b]" : t === "video" ? "bg-[#9b1b30]/10 text-[#9b1b30]" : "bg-[#4a6fa5]/10 text-[#4a6fa5]";

  return (
    <Card className="p-6 border-l-4 border-l-purple-500">
      <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-purple-600" /> Creer un nouveau programme d'etudes
      </h3>
      <p className="text-[11px] text-muted-foreground mb-5">Assemblez des messages existants pour creer un parcours d'apprentissage structure.</p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: "Informations" },
          { n: 2, label: "Selection des modules" },
          { n: 3, label: "Organisation & Validation" },
        ].map(({ n, label }) => (
          <button key={n} onClick={() => setStep(n as 1 | 2 | 3)} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${step === n ? "bg-purple-600 text-white" : step > n ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {step > n ? <CheckCircle className="w-4 h-4" /> : n}
            </div>
            <span className={`text-[11px] font-medium hidden md:block ${step === n ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {n < 3 && <div className="flex-1 h-px bg-border" />}
          </button>
        ))}
      </div>

      {/* Step 1 — Infos */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Titre du programme *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Formation des leaders" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Auteur *</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Pasteur Jean" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Categorie</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Formation, Etude, Parcours..." className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1"><Image className="w-3 h-3" /> Image de couverture (URL)</label>
              <input value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Decrivez le programme, ses objectifs et ce que les participants vont apprendre..." rows={3} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!title.trim() || !author.trim()} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              Suivant — Selectionner les modules <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Select messages */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={msgSearch} onChange={e => setMsgSearch(e.target.value)} placeholder="Rechercher un message a ajouter..." className="w-full pl-10 pr-4 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-purple-500/20 focus:outline-none" />
            </div>
            <span className="text-[11px] font-semibold text-purple-600 bg-purple-100 px-3 py-1.5 rounded-full shrink-0">{selectedMsgIds.length} selectionne(s)</span>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {filteredMsgs.map((m: Message) => {
              const isSelected = selectedMsgIds.includes(m.id);
              const order = isSelected ? selectedMsgIds.indexOf(m.id) + 1 : null;
              return (
                <button key={m.id} onClick={() => toggleMsg(m.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${isSelected ? "bg-purple-50" : ""}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    {isSelected ? <span className="text-[11px] font-bold">{order}</span> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`w-7 h-7 rounded-lg ${typeColor(m.type)} flex items-center justify-center shrink-0`}>{typeIcon(m.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">{m.author} · {m.category} {m.duration ? `· ${m.duration}` : ""}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColor(m.type)}`}>{m.type}</span>
                </button>
              );
            })}
            {filteredMsgs.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Aucun message disponible</div>}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-border rounded-xl text-[12px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.98]">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Retour
            </button>
            <button onClick={() => setStep(3)} disabled={selectedMsgIds.length < 2} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              Suivant — Organiser <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Organize & validate */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="p-4 bg-purple-50/50 border-purple-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[18px] font-bold text-purple-600">{selectedMsgIds.length}</p>
                <p className="text-[10px] text-muted-foreground">Modules</p>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground truncate">{title}</p>
                <p className="text-[10px] text-muted-foreground">{author}</p>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">{category || "Formation"}</p>
                <p className="text-[10px] text-muted-foreground">Categorie</p>
              </div>
            </div>
          </Card>

          {/* Ordered list with reorder */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-2 block">Ordre des modules (glissez pour reorganiser)</label>
            <div className="space-y-1.5">
              {selectedMessages.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-border">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveMsg(m.id, "up")} disabled={i === 0} className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center disabled:opacity-20">
                      <ChevronRight className="w-3 h-3 -rotate-90" />
                    </button>
                    <button onClick={() => moveMsg(m.id, "down")} disabled={i === selectedMessages.length - 1} className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center disabled:opacity-20">
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-bold text-purple-600">{i + 1}</span>
                  </div>
                  <div className={`w-7 h-7 rounded-lg ${typeColor(m.type)} flex items-center justify-center shrink-0`}>{typeIcon(m.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">{m.author} · {m.type} {m.duration ? `· ${m.duration}` : ""}</p>
                  </div>
                  <button onClick={() => toggleMsg(m.id)} className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 border border-border rounded-xl text-[12px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.98]">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Modifier la selection
            </button>
            <button onClick={handleCreate} disabled={creating || !canCreate} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />} Creer le programme ({selectedMsgIds.length} modules)
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ==================== CONFIG ====================
function ConfigSection({ config, setConfig, accessToken }: { config: AppConfig | null; setConfig: any; accessToken: string }) {
  const [form, setForm] = useState<Partial<AppConfig>>(config || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (config) setForm(config); }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAppConfig(form, accessToken);
      if (updated) { setConfig(updated); setSaved(true); setTimeout(() => setSaved(false), 2000); toast.success("Configuration sauvegardee"); }
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!config) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader icon={Settings} title="Configuration de l'application" actions={
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Sauvegarde !" : "Sauvegarder"}
        </button>
      } />

      {/* General */}
      <Card className="p-6">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-5">
          <Info className="w-4 h-4 text-[#152a6b]" /> Informations generales
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: "appName", label: "Nom de l'application", type: "text" },
            { key: "appSubtitle", label: "Sous-titre", type: "text" },
            { key: "welcomeMessage", label: "Message d'accueil", type: "text" },
            { key: "welcomeVerse", label: "Reference biblique", type: "text" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">{f.label}</label>
              <input value={(form as any)[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Taille max upload (Mo)</label>
            <input type="number" value={form.maxUploadSizeMb || 100} onChange={e => setForm({ ...form, maxUploadSizeMb: parseInt(e.target.value) })} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Quota hors ligne par appareil (Mo)</label>
            <input type="number" min={50} max={2048} value={form.maxOfflineStorageMb || 1024} onChange={e => setForm({ ...form, maxOfflineStorageMb: parseInt(e.target.value) })} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Langue par defaut</label>
            <select value={form.defaultLanguage || "fr"} onChange={e => setForm({ ...form, defaultLanguage: e.target.value })} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none">
              <option value="fr">Francais</option>
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Feature toggles */}
      <Card className="p-6">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-[#152a6b]" /> Fonctionnalites
        </h3>
        <Toggle value={!!form.registrationEnabled} onChange={v => setForm({ ...form, registrationEnabled: v })} label="Inscriptions ouvertes" desc="Permettre aux nouveaux utilisateurs de creer un compte" />
        <Toggle value={!!form.commentsEnabled} onChange={v => setForm({ ...form, commentsEnabled: v })} label="Commentaires" desc="Activer les commentaires sur les messages" />
        <Toggle value={!!form.downloadsEnabled} onChange={v => setForm({ ...form, downloadsEnabled: v })} label="Telechargements hors-ligne" desc="Permettre le telechargement de medias pour ecoute hors-ligne" />
        <Toggle value={!!form.analyticsEnabled} onChange={v => setForm({ ...form, analyticsEnabled: v })} label="Analytics" desc="Collecter les statistiques d'utilisation" />
        <Toggle value={!!form.maintenanceMode} onChange={v => setForm({ ...form, maintenanceMode: v })} label="Mode maintenance" desc="Desactiver temporairement l'acces a l'application" />
      </Card>

      {config.updatedAt && (
        <p className="text-[10px] text-muted-foreground text-right">Derniere mise a jour : {formatDateFr(config.updatedAt)}</p>
      )}
    </div>
  );
}

// ==================== APPEARANCE ====================
function AppearanceSection({ config, setConfig, accessToken }: { config: AppConfig | null; setConfig: any; accessToken: string }) {
  const [form, setForm] = useState<Partial<AppConfig>>(config || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (config) setForm(config); }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAppConfig(form, accessToken);
      if (updated) { setConfig(updated); toast.success("Apparence sauvegardee"); }
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!config) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader icon={Palette} title="Apparence et personnalisation" actions={
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50 active:scale-[0.98]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Sauvegarder
        </button>
      } />

      <Card className="p-6">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-5">
          <Palette className="w-4 h-4 text-[#152a6b]" /> Couleurs du theme
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { key: "primaryColor", label: "Couleur principale", default: "#152a6b", desc: "Header, boutons, navigation" },
            { key: "accentColor", label: "Couleur accent", default: "#9b1b30", desc: "Alertes, favoris, video" },
          ].map(c => (
            <div key={c.key}>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">{c.label}</label>
              <p className="text-[10px] text-muted-foreground/70 mb-2">{c.desc}</p>
              <div className="flex items-center gap-3">
                <input type="color" value={(form as any)[c.key] || c.default} onChange={e => setForm({ ...form, [c.key]: e.target.value })} className="w-12 h-12 rounded-xl border border-border cursor-pointer" />
                <input value={(form as any)[c.key] || c.default} onChange={e => setForm({ ...form, [c.key]: e.target.value })} className="flex-1 px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border font-mono" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Preview */}
      <Card className="p-6">
        <h3 className="text-[14px] font-semibold text-foreground mb-4">Apercu des couleurs</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-16 h-16 rounded-2xl shadow-md" style={{ backgroundColor: form.primaryColor || "#152a6b" }} />
            <span className="text-[10px] text-muted-foreground">Principale</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-16 h-16 rounded-2xl shadow-md" style={{ backgroundColor: form.accentColor || "#9b1b30" }} />
            <span className="text-[10px] text-muted-foreground">Accent</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-16 h-16 rounded-2xl shadow-md bg-[#4a6fa5]" />
            <span className="text-[10px] text-muted-foreground">Textes</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-16 h-16 rounded-2xl shadow-md bg-[#f5f6fa] border" />
            <span className="text-[10px] text-muted-foreground">Fond</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="h-10 px-5 rounded-xl text-white text-[12px] font-semibold shadow-md active:scale-95 transition-transform" style={{ backgroundColor: form.primaryColor || "#152a6b" }}>Bouton primaire</button>
            <span className="text-[10px] text-muted-foreground">CTA</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button className="h-10 px-5 rounded-xl text-white text-[12px] font-semibold shadow-md active:scale-95 transition-transform" style={{ backgroundColor: form.accentColor || "#9b1b30" }}>Bouton accent</button>
            <span className="text-[10px] text-muted-foreground">Action</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ==================== CATEGORIES ====================
function CategoriesSection({ categories, setCategories, messages, accessToken }: { categories: string[]; setCategories: any; messages: Message[]; accessToken: string }) {
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m: Message) => { if (m.category) counts[m.category] = (counts[m.category] || 0) + 1; });
    return counts;
  }, [messages]);

  const handleAdd = async () => {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    const updated = [...categories, name].sort();
    setSaving(true);
    try {
      await updateCategories(updated, accessToken);
      setCategories(updated);
      setNewCat("");
      toast.success(`Categorie "${name}" ajoutee`);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleRemove = async (cat: string) => {
    if (catCounts[cat] && catCounts[cat] > 0) {
      toast.error(`Impossible de supprimer : ${catCounts[cat]} message(s) utilisent cette categorie`);
      return;
    }
    const updated = categories.filter(c => c !== cat);
    setSaving(true);
    try {
      await updateCategories(updated, accessToken);
      setCategories(updated);
      toast.success(`Categorie "${cat}" supprimee`);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader icon={Tag} title="Gestion des categories" />

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Nouvelle categorie..." className="w-full pl-10 pr-4 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
          </div>
          <button onClick={handleAdd} disabled={saving || !newCat.trim()} className="px-4 py-2.5 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        <div className="space-y-1">
          {categories.map(cat => (
            <div key={cat} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#152a6b]" />
                <span className="text-[13px] text-foreground font-medium">{cat}</span>
                <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{catCounts[cat] || 0} messages</span>
              </div>
              <button onClick={() => handleRemove(cat)} disabled={saving} className="w-7 h-7 rounded-lg hover:bg-[#9b1b30]/10 flex items-center justify-center transition-colors disabled:opacity-30">
                <X className="w-3.5 h-3.5 text-[#9b1b30]" />
              </button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune categorie</p>}
        </div>
      </Card>
    </div>
  );
}

// ==================== NOTIFICATIONS ====================
function NotificationsSection({ announcements, setAnnouncements, accessToken }: { announcements: Announcement[]; setAnnouncements: any; accessToken: string }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return;
    setCreating(true);
    try {
      const ann = await createAnnouncement({ title: title.trim(), message: message.trim(), type }, accessToken);
      if (ann) {
        setAnnouncements((prev: Announcement[]) => [ann, ...prev]);
        setTitle("");
        setMessage("");
        setShowForm(false);
        toast.success("Annonce creee");
      }
    } catch (e: any) { toast.error(e.message); } finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    await deleteAnnouncement(id, accessToken);
    setAnnouncements((prev: Announcement[]) => prev.filter(a => a.id !== id));
    toast.success("Annonce supprimee");
  };

  const typeColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-700 border-blue-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader icon={Bell} title="Annonces et notifications" actions={
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-1.5 active:scale-[0.98]">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Annuler" : "Nouvelle annonce"}
        </button>
      } />

      {showForm && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Titre</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'annonce" className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Contenu de l'annonce..." rows={3} className="w-full px-3 py-2.5 bg-muted/30 rounded-xl text-[13px] border border-border focus:ring-2 focus:ring-[#152a6b]/20 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Type</label>
              <div className="flex gap-2">
                {(["info", "warning", "success"] as const).map(t => (
                  <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${type === t ? typeColors[t] : "bg-white border-border text-muted-foreground"}`}>
                    {t === "info" ? "Information" : t === "warning" ? "Avertissement" : "Succes"}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleCreate} disabled={creating || !title.trim() || !message.trim()} className="px-5 py-2.5 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publier l'annonce
            </button>
          </div>
        </Card>
      )}

      {/* List */}
      <div className="space-y-3">
        {announcements.map(ann => (
          <Card key={ann.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${typeColors[ann.type]}`}>{ann.type}</span>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(ann.createdAt)}</span>
                </div>
                <p className="text-[13px] font-semibold text-foreground">{ann.title}</p>
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{ann.message}</p>
              </div>
              <button onClick={() => handleDelete(ann.id)} className="w-8 h-8 rounded-lg border border-[#9b1b30]/20 hover:bg-[#9b1b30]/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-[#9b1b30]" />
              </button>
            </div>
          </Card>
        ))}
        {announcements.length === 0 && !showForm && (
          <Card className="p-12">
            <div className="text-center">
              <Megaphone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune annonce publiee</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Creez une annonce pour informer les utilisateurs</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ==================== SECURITY ====================
function SecuritySection({ auditLogs, setAuditLogs, accessToken }: { auditLogs: AuditLog[]; setAuditLogs: any; accessToken: string }) {
  const [clearing, setClearing] = useState(false);
  const [filterAction, setFilterAction] = useState<string>("all");

  const actions = useMemo(() => Array.from(new Set(auditLogs.map(l => l.action))), [auditLogs]);
  const filtered = filterAction === "all" ? auditLogs : auditLogs.filter(l => l.action === filterAction);

  const handleClear = async () => {
    if (!confirm("Effacer tous les logs d'audit ? Action irreversible.")) return;
    setClearing(true);
    const ok = await clearAuditLogs(accessToken);
    if (ok) { setAuditLogs([]); toast.success("Logs effaces"); }
    setClearing(false);
  };

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      config_update: "bg-blue-100 text-blue-700",
      bulk_delete_messages: "bg-red-100 text-red-700",
      update_message: "bg-amber-100 text-amber-700",
      delete_user: "bg-red-100 text-red-700",
      role_change: "bg-purple-100 text-purple-700",
      data_export: "bg-emerald-100 text-emerald-700",
      categories_update: "bg-indigo-100 text-indigo-700",
      create_announcement: "bg-blue-100 text-blue-700",
      delete_announcement: "bg-red-100 text-red-700",
    };
    return map[action] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-5">
      <SectionHeader icon={Shield} title="Securite et journal d'audit" />

      {/* Security overview */}
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard icon={Lock} label="Evenements" value={auditLogs.length} color="bg-emerald-100 text-emerald-600" />
        <KpiCard icon={Shield} label="Types d'actions" value={actions.length} color="bg-[#152a6b]/10 text-[#152a6b]" />
        <KpiCard icon={Globe} label="Protocole" value="HTTPS" color="bg-amber-100 text-amber-600" />
        <KpiCard icon={Lock} label="Cle serveur" value="Protegee" color="bg-purple-100 text-purple-600" sub="SERVICE_ROLE_KEY cote serveur" />
      </div>

      {/* Security policies */}
      <Card className="p-6">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#152a6b]" /> Politiques de securite
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: "Authentification", value: "Supabase Auth + JWT", icon: Lock, ok: true },
            { label: "CORS", value: "Active (origin: *)", icon: Globe, ok: true },
            { label: "Chiffrement", value: "TLS 1.3 (HTTPS)", icon: Shield, ok: true },
            { label: "Roles utilisateurs", value: "Admin / Membre", icon: Users, ok: true },
            { label: "Stockage fichiers", value: "Bucket prive + URLs signees", icon: HardDrive, ok: true },
            { label: "Cle admin", value: "Serveur uniquement", icon: Lock, ok: true },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border"><p.icon className="w-4 h-4 text-[#152a6b]" /></div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.value}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">Filtrer :</span>
        <button onClick={() => setFilterAction("all")} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${filterAction === "all" ? "bg-[#152a6b] text-white" : "bg-white border text-muted-foreground"}`}>Tous ({auditLogs.length})</button>
        {actions.map(a => (
          <button key={a} onClick={() => setFilterAction(a)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${filterAction === a ? "bg-[#152a6b] text-white" : "bg-white border text-muted-foreground"}`}>{a}</button>
        ))}
        <div className="flex-1" />
        <button onClick={handleClear} disabled={clearing || auditLogs.length === 0} className="px-3 py-1.5 bg-[#9b1b30]/10 text-[#9b1b30] rounded-xl text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-30">
          {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Effacer
        </button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Date</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Action</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Description</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-3">Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(log => (
              <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap">{formatDateFr(log.createdAt)}</td>
                <td className="px-5 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionBadge(log.action)}`}>{log.action}</span></td>
                <td className="px-5 py-3 text-[11px] text-foreground max-w-[350px] truncate">{log.description}</td>
                <td className="px-5 py-3 text-[11px] text-muted-foreground">{log.userEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Aucun evenement</div>}
      </Card>
    </div>
  );
}

// ==================== STORAGE ====================
function StorageSection({ storage }: { storage: StorageStats | null }) {
  if (!storage) return <Card className="p-12"><p className="text-muted-foreground text-center">Aucune donnee de stockage</p></Card>;

  return (
    <div className="space-y-5">
      <SectionHeader icon={HardDrive} title="Stockage et fichiers media" />

      <div className="grid md:grid-cols-3 gap-3">
        <KpiCard icon={Database} label="Fichiers totaux" value={storage.totalFiles} color="bg-[#152a6b]/10 text-[#152a6b]" />
        <KpiCard icon={HardDrive} label="Espace utilise" value={formatBytes(storage.totalSize)} color="bg-[#9b1b30]/10 text-[#9b1b30]" />
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-[18px] font-bold text-[#152a6b]">{storage.audioFiles}</p>
              <p className="text-[10px] text-muted-foreground">Audio ({formatBytes(storage.audioSize)})</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-[#9b1b30]">{storage.videoFiles}</p>
              <p className="text-[10px] text-muted-foreground">Video ({formatBytes(storage.videoSize)})</p>
            </div>
          </div>
        </Card>
      </div>

      {storage.files.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#152a6b]" /> Fichiers ({storage.files.length})
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-2.5">Nom</th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-2.5">Type</th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-2.5">Taille</th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {storage.files.map((f, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-2.5 text-[11px] text-foreground font-mono truncate max-w-[300px]">{f.name}</td>
                  <td className="px-5 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full ${f.folder === "audio" ? "bg-[#152a6b]/10 text-[#152a6b]" : "bg-[#9b1b30]/10 text-[#9b1b30]"}`}>{f.folder}</span></td>
                  <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{formatBytes(f.size)}</td>
                  <td className="px-5 py-2.5 text-[11px] text-muted-foreground">{f.createdAt ? new Date(f.createdAt).toLocaleDateString("fr-FR") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ==================== STATS ====================
function StatsSection({ stats, navigate }: { stats: AdminStats | null; navigate: any }) {
  if (!stats) return <Card className="p-12"><p className="text-muted-foreground text-center">Aucune statistique</p></Card>;

  const pieData = [
    { name: "Audio", value: stats.messagesByType.audio || 0 },
    { name: "Video", value: stats.messagesByType.video || 0 },
    { name: "Texte", value: stats.messagesByType.text || 0 },
  ];

  const categoryData = Object.entries(stats.messagesByCategory)
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 12) + "..." : name, count }));

  return (
    <div className="space-y-6">
      <SectionHeader icon={BarChart3} title="Statistiques detaillees" />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie */}
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-foreground mb-4">Repartition par type</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {pieData.map((e, i) => (
                <div key={e.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                  <div className="flex-1"><p className="text-[12px] text-foreground">{e.name}</p><p className="text-[10px] text-muted-foreground">{e.value} messages</p></div>
                  <span className="text-[14px] font-semibold text-foreground">{stats.totals.messages > 0 ? Math.round((e.value / stats.totals.messages) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Bar */}
        {categoryData.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground mb-4">Par categorie</h3>
            <ResponsiveContainer width="100%" height={Math.max(categoryData.length * 35, 120)}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7194" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7194" }} width={100} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#152a6b" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Top lists */}
      <div className="grid lg:grid-cols-2 gap-6">
        {stats.topFavorited.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-3"><Heart className="w-4 h-4 text-[#9b1b30]" /> Les plus aimes</h3>
            {stats.topFavorited.slice(0, 5).map((item, i) => (
              <button key={item.messageId} onClick={() => navigate(`/message/${item.messageId}`)} className="w-full flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 text-left transition-colors">
                <span className="text-[12px] text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[12px] text-foreground truncate">{item.title}</p><p className="text-[10px] text-muted-foreground">{item.author}</p></div>
                <span className="text-[12px] text-[#9b1b30] font-bold">{item.favoriteCount}</span>
              </button>
            ))}
          </Card>
        )}
        {stats.topCommented.length > 0 && (
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4 text-[#152a6b]" /> Les plus commentes</h3>
            {stats.topCommented.slice(0, 5).map((item, i) => (
              <button key={item.messageId} onClick={() => navigate(`/message/${item.messageId}`)} className="w-full flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 text-left transition-colors">
                <span className="text-[12px] text-muted-foreground w-5 text-center font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-[12px] text-foreground truncate">{item.title}</p><p className="text-[10px] text-muted-foreground">{item.author}</p></div>
                <span className="text-[12px] text-[#152a6b] font-bold">{item.commentCount}</span>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Series stats */}
      {stats.seriesStats.length > 0 && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4"><Layers className="w-4 h-4 text-purple-600" /> Progression des series</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.seriesStats.map(s => {
              const pct = s.totalModules > 0 && s.enrolled > 0 ? Math.round((s.completed / s.enrolled) * 100) : 0;
              return (
                <div key={s.seriesId} className="p-3.5 border border-border rounded-xl">
                  <p className="text-[12px] font-semibold text-foreground truncate">{s.title}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-muted-foreground">{s.enrolled} inscrits</span>
                    <span className="text-[10px] text-emerald-600">{s.completed} termines</span>
                    <span className="text-[10px] text-muted-foreground">{s.totalModules} modules</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ==================== SYSTEM HEALTH ====================
function SystemSection({ health, onRefresh }: { health: SystemHealth | null; onRefresh: () => void }) {
  if (!health) return <Card className="p-12"><p className="text-muted-foreground text-center">Chargement...</p></Card>;

  const services = [
    { name: "Base de donnees (PostgreSQL)", ok: health.dbConnected, desc: `${health.kvEntries} entrees dans le KV Store`, icon: Database },
    { name: "Service d'authentification", ok: health.authServiceUp, desc: "Supabase Auth (JWT)", icon: Lock },
    { name: "Stockage de fichiers", ok: health.storageConnected, desc: "Supabase Storage (bucket prive)", icon: HardDrive },
    { name: "Serveur API", ok: true, desc: `Hono Edge Function v${health.serverVersion}`, icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader icon={Zap} title="Sante du systeme" actions={
        <button onClick={onRefresh} className="px-4 py-2 bg-[#152a6b] text-white rounded-xl text-[12px] font-semibold flex items-center gap-1.5 active:scale-[0.98]">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      } />

      {/* Status banner */}
      <Card className={`p-5 border-l-4 ${health.status === "healthy" ? "border-l-emerald-500" : health.status === "degraded" ? "border-l-amber-500" : "border-l-red-500"}`}>
        <div className="flex items-center gap-4">
          {health.status === "healthy" ? <CheckCircle2 className="w-8 h-8 text-emerald-500" /> : health.status === "degraded" ? <AlertTriangle className="w-8 h-8 text-amber-500" /> : <XCircle className="w-8 h-8 text-red-500" />}
          <div>
            <p className="text-[16px] font-bold text-foreground">
              {health.status === "healthy" ? "Tous les systemes sont operationnels" : health.status === "degraded" ? "Performances degradees" : "Systeme hors ligne"}
            </p>
            <p className="text-[12px] text-muted-foreground">Derniere verification : {formatDateFr(health.lastChecked)}</p>
          </div>
        </div>
      </Card>

      {/* Services grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {services.map(s => (
          <Card key={s.name} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.ok ? "bg-emerald-100" : "bg-red-100"}`}>
                <s.icon className={`w-5 h-5 ${s.ok ? "text-emerald-600" : "text-red-600"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-foreground">{s.name}</p>
                  <StatusDot ok={s.ok} />
                </div>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${s.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {s.ok ? "OK" : "Erreur"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card className="p-5">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2 mb-4"><Info className="w-4 h-4 text-[#152a6b]" /> Informations systeme</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { label: "Version serveur", value: health.serverVersion },
            { label: "Entrees KV", value: health.kvEntries.toString() },
            { label: "Framework frontend", value: "React 18.3 + Tailwind CSS 4" },
            { label: "Routage", value: "React Router 7 (Data mode)" },
            { label: "Backend", value: "Hono (Supabase Edge Function)" },
            { label: "Base de donnees", value: "PostgreSQL (Supabase KV)" },
          ].map(i => (
            <div key={i.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-[12px] text-muted-foreground">{i.label}</span>
              <span className="text-[12px] font-medium text-foreground">{i.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ==================== EXPORT ====================
function ExportSection({ accessToken, users, messages }: { accessToken: string; users: AppUser[]; messages: Message[] }) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: "users" | "messages" | "all") => {
    setExporting(type);
    try {
      const data = await exportDataAsJson(type, accessToken);
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ecodis-export-${type}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Export ${type} telecharge`);
      } else {
        toast.error("Erreur lors de l'export");
      }
    } catch (e: any) { toast.error(e.message); } finally { setExporting(null); }
  };

  const exportOptions = [
    { type: "all" as const, label: "Export complet", desc: "Toutes les donnees (utilisateurs, messages, series, commentaires, favoris, configuration)", icon: Database, color: "bg-[#152a6b]" },
    { type: "users" as const, label: "Utilisateurs", desc: "Liste de tous les utilisateurs avec roles et dates", icon: Users, color: "bg-[#4a6fa5]" },
    { type: "messages" as const, label: "Messages", desc: "Tous les messages audio, video et texte", icon: FileText, color: "bg-[#9b1b30]" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader icon={FileDown} title="Export et sauvegarde des donnees" />

      <Card className="p-6">
        <p className="text-[12px] text-muted-foreground mb-5 leading-relaxed">
          Exportez vos donnees au format JSON pour effectuer des sauvegardes, migrer vers un autre environnement, ou analyser les donnees hors-ligne. Les fichiers sont telecharges directement sur votre ordinateur.
        </p>

        <div className="space-y-3">
          {exportOptions.map(opt => (
            <div key={opt.type} className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors">
              <div className={`w-11 h-11 rounded-xl ${opt.color} flex items-center justify-center shrink-0`}>
                <opt.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-foreground">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{opt.desc}</p>
              </div>
              <button
                onClick={() => handleExport(opt.type)}
                disabled={exporting !== null}
                className="px-4 py-2 bg-[#152a6b] text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] shrink-0"
              >
                {exporting === opt.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Telecharger
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick stats */}
      <Card className="p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Resume des donnees exportables</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center py-3 bg-muted/30 rounded-xl">
            <p className="text-[18px] font-bold text-[#152a6b]">{users.length}</p>
            <p className="text-[10px] text-muted-foreground">Utilisateurs</p>
          </div>
          <div className="text-center py-3 bg-muted/30 rounded-xl">
            <p className="text-[18px] font-bold text-[#9b1b30]">{messages.length}</p>
            <p className="text-[10px] text-muted-foreground">Messages</p>
          </div>
          <div className="text-center py-3 bg-muted/30 rounded-xl">
            <p className="text-[18px] font-bold text-[#4a6fa5]">JSON</p>
            <p className="text-[10px] text-muted-foreground">Format</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
