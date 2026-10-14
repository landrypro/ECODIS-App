import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  X,
  ArrowLeft,
  Mic,
  Video,
  FileText,
  Clock,
  ChevronRight,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Message } from "./api";

const HISTORY_KEY = "ecodis-search-history";
const MAX_HISTORY = 8;

type TabType = "all" | "audio" | "video" | "text";

interface SearchOverlayProps {
  open: boolean;
  messages: Message[];
  onOpenChange: (open: boolean) => void;
}

function getHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addToHistory(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const history = getHistory().filter(
    (h) => h.toLowerCase() !== trimmed.toLowerCase()
  );
  history.unshift(trimmed);
  saveHistory(history.slice(0, MAX_HISTORY));
}

function removeFromHistory(query: string) {
  const history = getHistory().filter((h) => h !== query);
  saveHistory(history);
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-200/80 text-foreground rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function SearchOverlay({ open, messages, onOpenChange }: SearchOverlayProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [history, setHistory] = useState<string[]>(getHistory());

  useEffect(() => {
    if (!open) return;

    // Auto-focus & lock scroll
    setTimeout(() => inputRef.current?.focus(), 50);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [query, messages]);

  const audioResults = results.filter((m) => m.type === "audio");
  const videoResults = results.filter((m) => m.type === "video");
  const textResults = results.filter((m) => m.type === "text");

  const filteredResults =
    activeTab === "all"
      ? results
      : activeTab === "audio"
      ? audioResults
      : activeTab === "video"
      ? videoResults
      : textResults;

  const handleSelectResult = (msg: Message) => {
    addToHistory(query);
    setHistory(getHistory());
    onOpenChange(false);
    navigate(`/message/${msg.id}`);
  };

  const handleSelectHistory = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const handleRemoveHistory = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromHistory(term);
    setHistory(getHistory());
  };

  const handleClearHistory = () => {
    saveHistory([]);
    setHistory([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addToHistory(query);
      setHistory(getHistory());
    }
  };

  const hasQuery = query.trim().length > 0;

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: results.length },
    { key: "audio", label: "Audio", count: audioResults.length },
    { key: "video", label: "Vidéo", count: videoResults.length },
    { key: "text", label: "Textes", count: textResults.length },
  ];

  const typeIcon = (type: string) => {
    switch (type) {
      case "audio":
        return <Mic className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const typeStyle = (type: string) => {
    switch (type) {
      case "audio":
        return "bg-[#152a6b]/10 text-[#152a6b]";
      case "video":
        return "bg-[#9b1b30]/10 text-[#9b1b30]";
      default:
        return "bg-[#4a6fa5]/10 text-[#4a6fa5]";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="max-w-lg mx-auto w-full flex flex-col h-full">
        {/* Search Header */}
        <div className="bg-white border-b border-border px-3 pt-2 pb-2 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Rechercher un message, auteur..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveTab("all");
                }}
                className="w-full pl-9 pr-9 py-2.5 bg-[#f5f6fa] rounded-xl text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#152a6b]/20 transition-shadow"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </form>

          {/* Tabs — only show when there are results */}
          {hasQuery && results.length > 0 && (
            <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-[#152a6b] text-white"
                      : "bg-[#f5f6fa] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key
                        ? "bg-white/20"
                        : "bg-muted-foreground/10"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* No query: show history */}
          {!hasQuery && (
            <div className="px-4 pt-4">
              {history.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Recherches recentes
                    </h3>
                    <button
                      onClick={handleClearHistory}
                      className="text-[11px] text-[#9b1b30] hover:underline"
                    >
                      Tout effacer
                    </button>
                  </div>
                  <div className="space-y-1">
                    {history.map((term) => (
                      <div
                        key={term}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectHistory(term)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectHistory(term);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left group"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-[13px] text-foreground truncate">
                          {term}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveHistory(term, e)}
                          className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10 transition-opacity shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-[13px] text-muted-foreground text-center max-w-[240px]">
                    Recherchez par titre, auteur, categorie ou contenu
                  </p>
                </div>
              )}

              {/* Suggestions */}
              {messages.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[13px] font-medium text-foreground flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Suggestions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(
                      new Set(messages.map((m) => m.category))
                    )
                      .slice(0, 6)
                      .map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setQuery(cat);
                            setActiveTab("all");
                          }}
                          className="px-3 py-1.5 bg-[#f5f6fa] rounded-full text-[11px] text-foreground hover:bg-[#152a6b]/10 transition-colors"
                        >
                          {cat}
                        </button>
                      ))}
                    {Array.from(new Set(messages.map((m) => m.author)))
                      .slice(0, 4)
                      .map((author) => (
                        <button
                          key={author}
                          onClick={() => {
                            setQuery(author);
                            setActiveTab("all");
                          }}
                          className="px-3 py-1.5 bg-[#152a6b]/5 rounded-full text-[11px] text-[#152a6b] hover:bg-[#152a6b]/10 transition-colors"
                        >
                          {author}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Query with no results */}
          {hasQuery && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-[14px] font-medium text-foreground mb-1">
                Aucun resultat
              </p>
              <p className="text-[12px] text-muted-foreground text-center max-w-[260px]">
                Aucun message ne correspond a "{query}". Essayez d'autres
                mots-cles.
              </p>
            </div>
          )}

          {/* Results */}
          {hasQuery && filteredResults.length > 0 && (
            <div className="px-4 pt-3 pb-6">
              {activeTab === "all" ? (
                // Grouped by type
                <>
                  {audioResults.length > 0 && (
                    <ResultSection
                      label="Audio"
                      icon={<Mic className="w-3.5 h-3.5" />}
                      color="text-[#152a6b]"
                      results={audioResults}
                      query={query}
                      typeIcon={typeIcon}
                      typeStyle={typeStyle}
                      onSelect={handleSelectResult}
                    />
                  )}
                  {videoResults.length > 0 && (
                    <ResultSection
                      label="Vidéo"
                      icon={<Video className="w-3.5 h-3.5" />}
                      color="text-[#9b1b30]"
                      results={videoResults}
                      query={query}
                      typeIcon={typeIcon}
                      typeStyle={typeStyle}
                      onSelect={handleSelectResult}
                    />
                  )}
                  {textResults.length > 0 && (
                    <ResultSection
                      label="Textes"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      color="text-[#4a6fa5]"
                      results={textResults}
                      query={query}
                      typeIcon={typeIcon}
                      typeStyle={typeStyle}
                      onSelect={handleSelectResult}
                    />
                  )}
                </>
              ) : (
                // Flat list for specific tab
                <div className="space-y-2">
                  {filteredResults.map((msg) => (
                    <ResultItem
                      key={msg.id}
                      msg={msg}
                      query={query}
                      typeIcon={typeIcon}
                      typeStyle={typeStyle}
                      onSelect={handleSelectResult}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function ResultSection({
  label,
  icon,
  color,
  results,
  query,
  typeIcon,
  typeStyle,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  results: Message[];
  query: string;
  typeIcon: (type: string) => React.ReactNode;
  typeStyle: (type: string) => string;
  onSelect: (msg: Message) => void;
}) {
  return (
    <div className="mb-4">
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label} ({results.length})
        </span>
      </div>
      <div className="space-y-2">
        {results.map((msg) => (
          <ResultItem
            key={msg.id}
            msg={msg}
            query={query}
            typeIcon={typeIcon}
            typeStyle={typeStyle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ResultItem({
  msg,
  query,
  typeIcon,
  typeStyle,
  onSelect,
}: {
  msg: Message;
  query: string;
  typeIcon: (type: string) => React.ReactNode;
  typeStyle: (type: string) => string;
  onSelect: (msg: Message) => void;
}) {
  return (
    <button
      onClick={() => onSelect(msg)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-sm hover:bg-muted active:scale-[0.99] transition-all text-left"
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeStyle(
          msg.type
        )}`}
      >
        {typeIcon(msg.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-card-foreground truncate">
          {highlightMatch(msg.title, query)}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-primary truncate">
            {highlightMatch(msg.author, query)}
          </span>
          <span className="text-[9px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground truncate">
            {msg.category}
          </span>
          {msg.duration && msg.type !== "text" && (
            <>
              <span className="text-[9px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">
                {msg.duration}
              </span>
            </>
          )}
        </div>
        {msg.description && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {highlightMatch(
              msg.description.length > 80
                ? msg.description.slice(0, 80) + "..."
                : msg.description,
              query
            )}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
