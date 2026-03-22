import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { fetchAdminStats, AdminStats } from "../api";
import {
  ArrowLeft,
  BarChart3,
  Users,
  MessageSquare,
  Heart,
  Mic,
  Video,
  FileText,
  Layers,
  TrendingUp,
  Crown,
  Loader2,
  ShieldAlert,
  RefreshCw,
  ChevronRight,
  Trophy,
  UserCheck,
  Percent,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type TimeRange = "7d" | "14d" | "30d";

export function AdminStatsPage() {
  const navigate = useNavigate();
  const { accessToken, isAdmin, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("14d");
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async (showRefresh = false) => {
    if (!accessToken) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const data = await fetchAdminStats(accessToken);
    if (data) {
      setStats(data);
      setError("");
    } else {
      setError("Impossible de charger les statistiques");
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (accessToken && isAdmin) loadStats();
  }, [accessToken, isAdmin]);

  // Filter timeline by time range
  const filteredTimeline = useMemo(() => {
    if (!stats?.activityTimeline) return [];
    const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
    return stats.activityTimeline.slice(-days);
  }, [stats, timeRange]);

  // Pie chart data for message types
  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Audio", value: stats.messagesByType.audio || 0 },
      { name: "Video", value: stats.messagesByType.video || 0 },
      { name: "Texte", value: stats.messagesByType.text || 0 },
    ];
  }, [stats]);

  const PIE_COLORS = ["#152a6b", "#9b1b30", "#4a6fa5"];

  // Category bar chart data
  const categoryData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.messagesByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 12) + "..." : name, count }));
  }, [stats]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 bg-[#152a6b] text-white z-40">
          <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <h1 className="text-[15px] text-white">Acces restreint</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 px-6">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-[15px] font-medium text-foreground mb-1">Acces reserve aux administrateurs</p>
          <p className="text-[12px] text-muted-foreground text-center">
            Vous devez avoir le role administrateur pour acceder au tableau de bord.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-5 py-2.5 bg-[#152a6b] text-white text-[13px] rounded-xl"
          >
            Retour a l'accueil
          </button>
        </div>
      </div>
    );
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "audio": return <Mic className="w-3.5 h-3.5" />;
      case "video": return <Video className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "audio": return "bg-[#152a6b]/10 text-[#152a6b]";
      case "video": return "bg-[#9b1b30]/10 text-[#9b1b30]";
      default: return "bg-[#4a6fa5]/10 text-[#4a6fa5]";
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-border rounded-lg shadow-lg p-2.5 text-[11px]">
          <p className="font-medium text-foreground mb-1">{formatDate(label)}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-[#152a6b] text-white z-40">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <h1 className="text-[15px] text-white">Tableau de bord</h1>
          </div>
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-[13px] text-muted-foreground">Chargement des statistiques...</p>
          </div>
        ) : error ? (
          <div className="px-4 pt-8">
            <div className="bg-[#9b1b30]/10 border border-[#9b1b30]/20 rounded-xl p-4 text-center">
              <p className="text-[13px] text-[#9b1b30]">{error}</p>
              <button
                onClick={() => loadStats()}
                className="mt-3 px-4 py-2 bg-[#152a6b] text-white text-[12px] rounded-lg"
              >
                Reessayer
              </button>
            </div>
          </div>
        ) : stats ? (
          <>
            {/* ===== KPI Cards ===== */}
            <div className="px-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Utilisateurs",
                    value: stats.totals.users,
                    icon: Users,
                    color: "bg-[#152a6b]",
                    iconBg: "bg-[#152a6b]/10 text-[#152a6b]",
                  },
                  {
                    label: "Messages",
                    value: stats.totals.messages,
                    icon: MessageSquare,
                    color: "bg-[#4a6fa5]",
                    iconBg: "bg-[#4a6fa5]/10 text-[#4a6fa5]",
                  },
                  {
                    label: "Favoris",
                    value: stats.totals.favorites,
                    icon: Heart,
                    color: "bg-[#9b1b30]",
                    iconBg: "bg-[#9b1b30]/10 text-[#9b1b30]",
                  },
                  {
                    label: "Commentaires",
                    value: stats.totals.comments,
                    icon: MessageSquare,
                    color: "bg-emerald-600",
                    iconBg: "bg-emerald-600/10 text-emerald-600",
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-card rounded-xl border border-border p-3.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                        <kpi.icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
                    </div>
                    <p className="text-[24px] text-card-foreground leading-none">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Engagement + Series row */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-card rounded-xl border border-border p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Percent className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">Engagement</span>
                  </div>
                  <p className="text-[24px] text-card-foreground leading-none">
                    {stats.engagementRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {stats.uniqueCommenters} commenteur{stats.uniqueCommenters !== 1 ? "s" : ""} · {stats.uniqueFavoriters} likers
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">Series</span>
                  </div>
                  <p className="text-[24px] text-card-foreground leading-none">
                    {stats.totals.series}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {stats.seriesStats.reduce((a, s) => a + s.enrolled, 0)} inscrits
                  </p>
                </div>
              </div>
            </div>

            {/* ===== Activity Timeline ===== */}
            <div className="px-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Activite
                </h3>
                <div className="flex gap-1">
                  {(["7d", "14d", "30d"] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                        timeRange === range
                          ? "bg-[#152a6b] text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {range === "7d" ? "7j" : range === "14d" ? "14j" : "30j"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={filteredTimeline} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#152a6b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#152a6b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradFavorites" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9b1b30" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#9b1b30" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(21,42,107,0.06)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => {
                        const date = new Date(d);
                        return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      }}
                      tick={{ fontSize: 9, fill: "#6b7194" }}
                      interval={timeRange === "7d" ? 0 : timeRange === "14d" ? 1 : 4}
                    />
                    <YAxis tick={{ fontSize: 9, fill: "#6b7194" }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="comments"
                      name="Commentaires"
                      stroke="#152a6b"
                      fill="url(#gradComments)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="favorites"
                      name="Favoris"
                      stroke="#9b1b30"
                      fill="url(#gradFavorites)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      name="Inscriptions"
                      stroke="#059669"
                      fill="url(#gradSignups)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {[
                    { label: "Commentaires", color: "#152a6b" },
                    { label: "Favoris", color: "#9b1b30" },
                    { label: "Inscriptions", color: "#059669" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ===== Messages by Type (Pie) ===== */}
            <div className="px-4 mt-6">
              <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                Repartition par type
              </h3>
              <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
                <div className="flex items-center">
                  <ResponsiveContainer width="50%" height={150}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5">
                    {pieData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground">{entry.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {entry.value} message{entry.value !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-[14px] text-foreground tabular-nums">
                          {stats.totals.messages > 0
                            ? Math.round((entry.value / stats.totals.messages) * 100)
                            : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Messages by Category (Bar) ===== */}
            {categoryData.length > 0 && (
              <div className="px-4 mt-6">
                <h3 className="text-[14px] text-foreground mb-3">
                  Messages par categorie
                </h3>
                <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
                  <ResponsiveContainer width="100%" height={Math.max(categoryData.length * 32, 120)}>
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7194" }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7194" }}
                        width={95}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} message${value !== 1 ? "s" : ""}`, "Total"]}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="count" fill="#152a6b" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ===== Top Favorited Messages ===== */}
            {stats.topFavorited.length > 0 && (
              <div className="px-4 mt-6">
                <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-[#9b1b30]" />
                  Messages les plus aimes
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {stats.topFavorited.slice(0, 5).map((item, i) => (
                    <button
                      key={item.messageId}
                      onClick={() => navigate(`/message/${item.messageId}`)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors ${
                        i !== Math.min(stats.topFavorited.length, 5) - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <span className="text-[12px] text-muted-foreground w-5 text-center shrink-0 font-medium">
                        {i + 1}
                      </span>
                      <div className={`w-8 h-8 rounded-lg ${typeColor(item.type)} flex items-center justify-center shrink-0`}>
                        {typeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-card-foreground truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">{item.author}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Heart className="w-3 h-3 text-[#9b1b30]" />
                        <span className="text-[12px] text-[#9b1b30] font-medium">{item.favoriteCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== Top Commented Messages ===== */}
            {stats.topCommented.length > 0 && (
              <div className="px-4 mt-6">
                <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-[#152a6b]" />
                  Messages les plus commentes
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {stats.topCommented.slice(0, 5).map((item, i) => (
                    <button
                      key={item.messageId}
                      onClick={() => navigate(`/message/${item.messageId}`)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors ${
                        i !== Math.min(stats.topCommented.length, 5) - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <span className="text-[12px] text-muted-foreground w-5 text-center shrink-0 font-medium">
                        {i + 1}
                      </span>
                      <div className={`w-8 h-8 rounded-lg ${typeColor(item.type)} flex items-center justify-center shrink-0`}>
                        {typeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-card-foreground truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">{item.author}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <MessageSquare className="w-3 h-3 text-[#152a6b]" />
                        <span className="text-[12px] text-[#152a6b] font-medium">{item.commentCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== Top Authors ===== */}
            {stats.topAuthors.length > 0 && (
              <div className="px-4 mt-6">
                <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Auteurs les plus actifs
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {stats.topAuthors.map((item, i) => {
                    const maxCount = stats.topAuthors[0]?.messageCount || 1;
                    const widthPercent = Math.round((item.messageCount / maxCount) * 100);
                    return (
                      <div
                        key={item.author}
                        className={`px-4 py-3 ${
                          i !== stats.topAuthors.length - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-card-foreground font-medium">{item.author}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {item.messageCount} message{item.messageCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== Top Commenters ===== */}
            {stats.topCommenters.length > 0 && (
              <div className="px-4 mt-6">
                <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Membres les plus actifs
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {stats.topCommenters.map((item, i) => (
                    <div
                      key={item.userId}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        i !== stats.topCommenters.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-600/10 flex items-center justify-center shrink-0">
                        <span className="text-emerald-600 text-[10px] font-medium">
                          {item.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-card-foreground">{item.name}</p>
                      </div>
                      <span className="text-[12px] text-emerald-600 font-medium">
                        {item.commentCount} com.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== Series Progress Stats ===== */}
            {stats.seriesStats.length > 0 && (
              <div className="px-4 mt-6 mb-4">
                <h3 className="text-[14px] text-foreground flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Progression des series
                </h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {stats.seriesStats.map((s, i) => (
                    <button
                      key={s.seriesId}
                      onClick={() => navigate(`/series/${s.seriesId}`)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted transition-colors ${
                        i !== stats.seriesStats.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-card-foreground truncate font-medium">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {s.totalModules} modules
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-[#152a6b]">
                            {s.enrolled} inscrit{s.enrolled !== 1 ? "s" : ""}
                          </span>
                          {s.completed > 0 && (
                            <>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                <Trophy className="w-2.5 h-2.5" />
                                {s.completed} termine{s.completed !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
