import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth-context";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { queryKeys } from "../../hooks/query-keys";
import {
  fetchCommentModerationEvents,
  fetchModerationComments,
  fetchModerationReports,
  moderateComment,
  resolveCommentReport,
} from "../../services";
import type {
  CommentModerationEvent,
  CommentReport,
  ModerationComment,
  ModerationQueueComment,
} from "../../services";
import { ApiError } from "../../services/http";

const PAGE_SIZE = 25;

const reasonLabels: Record<CommentReport["reason"], string> = {
  spam: "Spam",
  harassment: "Harcèlement",
  inappropriate_content: "Contenu inapproprié",
  misinformation: "Désinformation",
  other: "Autre",
};

const reportStatusLabels: Record<CommentReport["status"], string> = {
  open: "Ouvert",
  resolved: "Traité",
  dismissed: "Écarté",
};

const commentStatusLabels: Record<ModerationComment["status"], string> = {
  visible: "Visible",
  hidden: "Masqué",
  deleted_by_author: "Supprimé par l'auteur",
  deleted_by_moderation: "Supprimé par la modération",
};

type ModerationView = "pending" | "hidden" | "processed";
type CommentDecisionAction = "hide" | "restore" | "delete";

type PendingDecision =
  | { kind: "comment"; comment: ModerationComment; action: CommentDecisionAction }
  | { kind: "report"; report: CommentReport; status: "resolved" | "dismissed" };

function formatDate(value: string | null): string {
  if (!value) return "Non renseignée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date invalide";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isoStartOfDay(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function isoEndOfDay(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}

function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function decisionLabel(decision: PendingDecision): string {
  if (decision.kind === "report") return decision.status === "resolved" ? "Traiter le signalement" : "Écarter le signalement";
  return { hide: "Masquer le commentaire", restore: "Restaurer le commentaire", delete: "Supprimer le commentaire" }[decision.action];
}

function eventLabel(event: CommentModerationEvent): string {
  const labels: Record<string, string> = {
    hide: "Commentaire masqué",
    restore: "Commentaire restauré",
    delete: "Commentaire supprimé par la modération",
    report_created: "Signalement créé",
    report_resolved: "Signalement traité",
    report_dismissed: "Signalement écarté",
    author_deleted: "Commentaire supprimé par son auteur",
  };
  return labels[event.action] ?? event.action;
}

function CommentContext({ comment }: { comment: ModerationComment | ModerationQueueComment }) {
  return (
    <div className="min-w-0">
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{comment.text}</p>
      <dl className="mt-3 grid gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div><dt className="inline font-medium text-foreground">Auteur : </dt><dd className="inline">{comment.userName} · {comment.userEmail}</dd></div>
        <div><dt className="inline font-medium text-foreground">Contenu lié : </dt><dd className="inline break-all">{comment.messageId}</dd></div>
        <div><dt className="inline font-medium text-foreground">Créé le : </dt><dd className="inline">{formatDate(comment.createdAt)}</dd></div>
        <div><dt className="inline font-medium text-foreground">État : </dt><dd className="inline">{commentStatusLabels[comment.status]}</dd></div>
      </dl>
    </div>
  );
}

function CursorPagination({
  cursors,
  hasMore,
  onPrevious,
  onNext,
}: {
  cursors: Array<string | undefined>;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav aria-label="Pagination de la modération" className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
      <button type="button" onClick={onPrevious} disabled={cursors.length === 1} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45">
        <ChevronLeft className="h-3.5 w-3.5" /> Précédent
      </button>
      <span className="text-xs text-muted-foreground">Page {cursors.length}</span>
      <button type="button" onClick={onNext} disabled={!hasMore} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45">
        Suivant <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

export function ModerationPage() {
  const { accessToken, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModerate = roles.some((role) => ["moderator", "admin", "super_admin"].includes(role));
  const [view, setView] = useState<ModerationView>("pending");
  const [processedStatus, setProcessedStatus] = useState<"resolved" | "dismissed">("resolved");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportCursors, setReportCursors] = useState<Array<string | undefined>>([undefined]);
  const [commentCursors, setCommentCursors] = useState<Array<string | undefined>>([undefined]);
  const [selectedComment, setSelectedComment] = useState<ModerationComment | ModerationQueueComment | null>(null);
  const [eventCursors, setEventCursors] = useState<Array<string | undefined>>([undefined]);
  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");
  const sessionScope = `${accessToken ?? "anonymous"}:${canModerate}`;
  const previousSessionScope = useRef(sessionScope);

  const reportStatus = view === "processed" ? processedStatus : "open";
  const reportCursor = reportCursors.at(-1);
  const commentCursor = commentCursors.at(-1);
  const eventCursor = eventCursors.at(-1);
  const filters = useMemo(() => ({
    search: appliedSearch.trim() || undefined,
    from: isoStartOfDay(fromDate),
    to: isoEndOfDay(toDate),
    limit: PAGE_SIZE,
  }), [appliedSearch, fromDate, toDate]);

  const reportsQuery = useQuery({
    queryKey: ["moderation", "reports", reportStatus, reportCursor, filters],
    queryFn: () => fetchModerationReports(accessToken!, { ...filters, reportStatus, cursor: reportCursor }),
    enabled: Boolean(accessToken && canModerate && (view === "pending" || view === "processed")),
  });
  const commentsQuery = useQuery({
    queryKey: ["moderation", "comments", "hidden", commentCursor, filters],
    queryFn: () => fetchModerationComments(accessToken!, { ...filters, commentStatus: "hidden", cursor: commentCursor }),
    enabled: Boolean(accessToken && canModerate && view === "hidden"),
  });
  const historyQuery = useQuery({
    queryKey: ["moderation", "events", selectedComment?.id, eventCursor],
    queryFn: () => fetchCommentModerationEvents(selectedComment!.id, accessToken!, `limit=${PAGE_SIZE}${eventCursor ? `&cursor=${encodeURIComponent(eventCursor)}` : ""}`),
    enabled: Boolean(accessToken && canModerate && selectedComment),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["moderation"] }),
      queryClient.invalidateQueries({ queryKey: ["comments"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.commentCounts() }),
    ]);
  };

  // Une file ou un historique de modération appartient à la session courante.
  // Les retirer évite toute rémanence lors d'un changement de compte ou de rôle.
  useEffect(() => {
    if (previousSessionScope.current === sessionScope) return;
    queryClient.removeQueries({ queryKey: ["moderation"] });
    previousSessionScope.current = sessionScope;
    setSelectedComment(null);
    setConflictMessage("");
  }, [queryClient, sessionScope]);

  const moderateMutation = useMutation({
    mutationFn: ({ commentId, action, reason, expectedVersion }: { commentId: string; action: CommentDecisionAction; reason: string; expectedVersion: number }) =>
      moderateComment(commentId, action, reason, expectedVersion, accessToken!),
  });
  const resolveMutation = useMutation({
    mutationFn: ({ reportId, status, note, expectedVersion }: { reportId: string; status: "resolved" | "dismissed"; note: string; expectedVersion: number }) =>
      resolveCommentReport(reportId, status, note, expectedVersion, accessToken!),
  });

  const resetPagination = () => {
    setReportCursors([undefined]);
    setCommentCursors([undefined]);
  };

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("La date de début doit précéder la date de fin.");
      return;
    }
    setAppliedSearch(search);
    resetPagination();
  };

  const resetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setFromDate("");
    setToDate("");
    resetPagination();
  };

  const openDecision = (nextDecision: PendingDecision) => {
    setDecision(nextDecision);
    setDecisionNote("");
    setDecisionError("");
  };

  const closeDecision = () => {
    // Fermer le dialogue ne déclenche aucune mutation réseau.
    setDecision(null);
    setDecisionNote("");
    setDecisionError("");
  };

  const showConflict = async () => {
    setConflictMessage("Cette décision n'a pas été appliquée : le commentaire ou le signalement a changé entre-temps. Les données et l'historique ont été rechargés ; vérifiez-les puis confirmez une nouvelle décision si nécessaire.");
    await refresh();
  };

  const submitDecision = async () => {
    if (!decision) return;
    const note = decisionNote.trim();
    if (note.length > 500) {
      setDecisionError("Le motif ou la note ne peut pas dépasser 500 caractères.");
      return;
    }
    if (decision.kind === "comment" && (decision.action === "hide" || decision.action === "delete") && !note) {
      setDecisionError("Un motif est obligatoire pour masquer ou supprimer un commentaire.");
      return;
    }
    setDecisionError("");
    try {
      if (decision.kind === "comment") {
        await moderateMutation.mutateAsync({
          commentId: decision.comment.id,
          action: decision.action,
          reason: note,
          expectedVersion: decision.comment.version,
        });
        toast.success(decision.action === "hide" ? "Commentaire masqué." : decision.action === "restore" ? "Commentaire restauré." : "Commentaire supprimé.");
      } else {
        await resolveMutation.mutateAsync({
          reportId: decision.report.id,
          status: decision.status,
          note,
          expectedVersion: decision.report.version,
        });
        toast.success(decision.status === "resolved" ? "Signalement traité." : "Signalement écarté.");
      }
      closeDecision();
      await refresh();
    } catch (error) {
      closeDecision();
      if (isConflict(error)) {
        await showConflict();
      } else {
        toast.error(error instanceof Error ? error.message : "La décision n'a pas pu être appliquée.");
      }
    }
  };

  const selectComment = (comment: ModerationComment | ModerationQueueComment) => {
    setSelectedComment(comment);
    setEventCursors([undefined]);
  };

  if (!canModerate) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Accès non autorisé</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre rôle ne permet pas de modérer les commentaires.</p>
        <button type="button" onClick={() => navigate("/profil")} className="mt-5 text-sm font-medium text-primary">Retour au profil</button>
      </div>
    );
  }

  const reports = reportsQuery.data?.items ?? [];
  const comments = commentsQuery.data?.items ?? [];
  const activeQuery = view === "hidden" ? commentsQuery : reportsQuery;
  const activeItems = view === "hidden" ? comments : reports;
  const activeHasMore = view === "hidden" ? Boolean(commentsQuery.data?.hasMore) : Boolean(reportsQuery.data?.hasMore);
  const activeCursors = view === "hidden" ? commentCursors : reportCursors;

  const previousPage = () => {
    if (view === "hidden") setCommentCursors((current) => current.slice(0, -1));
    else setReportCursors((current) => current.slice(0, -1));
  };
  const nextPage = () => {
    const nextCursor = view === "hidden" ? commentsQuery.data?.nextCursor : reportsQuery.data?.nextCursor;
    if (!nextCursor) return;
    if (view === "hidden") setCommentCursors((current) => [...current, nextCursor]);
    else setReportCursors((current) => [...current, nextCursor]);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <button type="button" onClick={() => navigate("/profil")} className="mb-5 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au profil
      </button>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10"><ShieldAlert className="h-5 w-5 text-amber-600" /></div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Modération des commentaires</h1>
          <p className="text-sm text-muted-foreground">Les actions restent soumises aux contrôles de version et aux transitions du serveur.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div role="tablist" aria-label="Vues de modération" className="flex flex-wrap gap-2">
          {([
            ["pending", "À traiter"],
            ["hidden", "Masqués"],
            ["processed", "Traités"],
          ] as const).map(([nextView, label]) => (
            <button key={nextView} type="button" role="tab" aria-selected={view === nextView} onClick={() => { setView(nextView); setConflictMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === nextView ? "bg-[#152a6b] text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={applyFilters} className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Rechercher un auteur ou un contenu</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un auteur ou un contenu" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">Du
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">Au
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-lg bg-[#152a6b] px-3 py-2 text-sm font-semibold text-white">Filtrer</button>
            <button type="button" onClick={resetFilters} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Réinitialiser</button>
          </div>
        </form>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> La période filtre la création des signalements ; pour les commentaires masqués, elle filtre la dernière décision.</p>
      </div>

      {view === "processed" && (
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">Afficher les signalements
          <select value={processedStatus} onChange={(event) => { setProcessedStatus(event.target.value as "resolved" | "dismissed"); setReportCursors([undefined]); }} className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground">
            <option value="resolved">Traités</option>
            <option value="dismissed">Écartés</option>
          </select>
        </label>
      )}

      {conflictMessage && (
        <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1"><p>{conflictMessage}</p><button type="button" onClick={() => void refresh()} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3.5 w-3.5" /> Actualiser</button></div>
        </div>
      )}

      <section className="mt-4" aria-live="polite">
        {activeQuery.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : activeQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">La vue de modération est inaccessible. Vérifiez vos droits puis réessayez.</div>
        ) : activeItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Check className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <p className="font-medium">{view === "pending" ? "Aucun signalement à traiter" : "Aucun élément dans cette vue"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Modifiez les filtres ou revenez plus tard.</p>
          </div>
        ) : view === "hidden" ? (
          <div className="space-y-4">
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><span className="inline-flex rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700">Masqué · {comment.openReportCount} ouvert{comment.openReportCount > 1 ? "s" : ""} / {comment.reportCount} signalement{comment.reportCount > 1 ? "s" : ""}</span><div className="mt-3"><CommentContext comment={comment} /></div></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => selectComment(comment)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><History className="h-3.5 w-3.5" /> Historique</button>
                    <button type="button" onClick={() => openDecision({ kind: "comment", comment, action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10"><RotateCcw className="h-3.5 w-3.5" /> Restaurer</button>
                    <button type="button" onClick={() => openDecision({ kind: "comment", comment, action: "delete" })} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> {reasonLabels[report.reason]}</span><span className="text-xs text-muted-foreground">{reportStatusLabels[report.status]} · {formatDate(report.createdAt)}</span></div>
                    {report.comment ? <div className="mt-3"><CommentContext comment={report.comment} /></div> : <p className="mt-3 text-sm text-muted-foreground">Commentaire indisponible.</p>}
                    {report.detail && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Signalement : {report.detail}</p>}
                    {report.resolutionNote && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Note de traitement : {report.resolutionNote}</p>}
                  </div>
                  {report.comment && <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => selectComment(report.comment!)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><History className="h-3.5 w-3.5" /> Historique</button>
                    {view === "pending" && report.comment.status === "visible" && <><button type="button" onClick={() => openDecision({ kind: "comment", comment: report.comment!, action: "hide" })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/30 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10"><EyeOff className="h-3.5 w-3.5" /> Masquer</button><button type="button" onClick={() => openDecision({ kind: "comment", comment: report.comment!, action: "delete" })} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></>}
                    {view === "pending" && report.comment.status === "hidden" && <><button type="button" onClick={() => openDecision({ kind: "comment", comment: report.comment!, action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10"><RotateCcw className="h-3.5 w-3.5" /> Restaurer</button><button type="button" onClick={() => openDecision({ kind: "comment", comment: report.comment!, action: "delete" })} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button></>}
                    {view === "pending" && <><button type="button" onClick={() => openDecision({ kind: "report", report, status: "resolved" })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /> Traiter</button><button type="button" onClick={() => openDecision({ kind: "report", report, status: "dismissed" })} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /> Écarter</button></>}
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
        {!activeQuery.isLoading && !activeQuery.isError && activeItems.length > 0 && <CursorPagination cursors={activeCursors} hasMore={activeHasMore} onPrevious={previousPage} onNext={nextPage} />}
      </section>

      {selectedComment && (
        <section aria-labelledby="history-title" className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="history-title" className="flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4" /> Historique protégé</h2><p className="mt-1 text-xs text-muted-foreground">Le registre est append-only ; il n'est pas le journal général effaçable.</p></div><button type="button" onClick={() => setSelectedComment(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Fermer</button></div>
          <div className="mt-4 rounded-xl bg-muted/40 p-3"><CommentContext comment={selectedComment} /></div>
          {historyQuery.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : historyQuery.isError ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">L'historique est inaccessible. Réessayez.</p> : (historyQuery.data?.items ?? []).length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Aucun événement P4.3 disponible pour ce commentaire.</p> : <ol className="mt-4 space-y-3">{historyQuery.data!.items.map((event) => <li key={event.id} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-medium">{eventLabel(event)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)} · version {event.previousVersion ?? "—"} → {event.nextVersion}</p>{event.reason && <p className="mt-1 text-xs text-muted-foreground">Motif : {event.reason}</p>}</li>)}</ol>}
          {!historyQuery.isLoading && !historyQuery.isError && (historyQuery.data?.items.length ?? 0) > 0 && <CursorPagination cursors={eventCursors} hasMore={Boolean(historyQuery.data?.hasMore)} onPrevious={() => setEventCursors((current) => current.slice(0, -1))} onNext={() => historyQuery.data?.nextCursor && setEventCursors((current) => [...current, historyQuery.data!.nextCursor!])} />}
        </section>
      )}

      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) closeDecision(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decision ? decisionLabel(decision) : "Décision de modération"}</DialogTitle><DialogDescription>{decision?.kind === "comment" && (decision.action === "hide" || decision.action === "delete") ? "Un motif est obligatoire. La décision sera vérifiée avec la version actuellement affichée." : "Vous pouvez ajouter une note facultative. Fermer ou annuler ne transmet aucune décision."}</DialogDescription></DialogHeader>
          <div>
            <label htmlFor="moderation-decision-note" className="block text-sm font-medium text-foreground">{decision?.kind === "comment" ? "Motif" : "Note de traitement"}</label>
            <textarea id="moderation-decision-note" autoFocus value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} maxLength={500} rows={4} aria-describedby="moderation-decision-note-count" placeholder={decision?.kind === "comment" && decision.action !== "restore" ? "Motif obligatoire…" : "Note facultative…"} className="mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm" />
            <span id="moderation-decision-note-count" className="mt-1 block text-right text-xs text-muted-foreground">{decisionNote.length}/500</span>
          </div>
          {decisionError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{decisionError}</p>}
          <DialogFooter><button type="button" onClick={closeDecision} disabled={moderateMutation.isPending || resolveMutation.isPending} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">Annuler</button><button type="button" onClick={() => void submitDecision()} disabled={moderateMutation.isPending || resolveMutation.isPending} className="rounded-xl bg-[#152a6b] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{moderateMutation.isPending || resolveMutation.isPending ? "Enregistrement…" : "Confirmer la décision"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
