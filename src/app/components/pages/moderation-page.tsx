import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, EyeOff, Loader2, ShieldAlert, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth-context";
import { fetchModerationReports, moderateComment, resolveCommentReport } from "../../services";
import type { CommentReport } from "../../services";

const reasonLabels: Record<CommentReport["reason"], string> = {
  spam: "Spam",
  harassment: "Harcèlement",
  inappropriate_content: "Contenu inapproprié",
  misinformation: "Désinformation",
  other: "Autre",
};

export function ModerationPage() {
  const { accessToken, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canModerate = roles.some((role) => ["moderator", "admin", "super_admin"].includes(role));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });

  const reportsQuery = useQuery({
    queryKey: ["moderation", "reports"],
    queryFn: () => fetchModerationReports(accessToken!),
    enabled: Boolean(accessToken && canModerate),
  });
  const moderateMutation = useMutation({
    mutationFn: ({ commentId, action, reason }: { commentId: string; action: "hide" | "delete"; reason: string }) =>
      moderateComment(commentId, action, reason, accessToken!),
    onSuccess: refresh,
  });
  const resolveMutation = useMutation({
    mutationFn: ({ reportId, status, note }: { reportId: string; status: "resolved" | "dismissed"; note: string }) =>
      resolveCommentReport(reportId, status, note, accessToken!),
    onSuccess: refresh,
  });

  const handleModerate = async (report: CommentReport, action: "hide" | "delete") => {
    if (!report.comment) return;
    const reason = window.prompt("Motif de la décision de modération", report.reason)?.trim();
    if (!reason) return;
    try {
      await moderateMutation.mutateAsync({ commentId: report.comment.id, action, reason });
      toast.success(action === "hide" ? "Commentaire masqué" : "Commentaire supprimé");
    } catch (error: any) {
      toast.error(error.message || "La décision n'a pas pu être appliquée");
    }
  };

  const handleDismiss = async (report: CommentReport) => {
    const note = window.prompt("Note de traitement facultative", "")?.trim() ?? "";
    try {
      await resolveMutation.mutateAsync({ reportId: report.id, status: "dismissed", note });
      toast.success("Signalement écarté");
    } catch (error: any) {
      toast.error(error.message || "Le signalement n'a pas pu être traité");
    }
  };

  if (!canModerate) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h1 className="text-lg font-semibold">Accès non autorisé</h1>
        <p className="text-sm text-muted-foreground mt-1">Votre rôle ne permet pas de modérer les commentaires.</p>
        <button onClick={() => navigate("/profil")} className="mt-5 text-sm text-primary font-medium">Retour au profil</button>
      </div>
    );
  }

  const reports = reportsQuery.data ?? [];
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <button onClick={() => navigate("/profil")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="w-4 h-4" /> Retour au profil
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-amber-600" /></div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Modération des commentaires</h1>
          <p className="text-sm text-muted-foreground">{reports.length} signalement{reports.length > 1 ? "s" : ""} ouvert{reports.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      {reportsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reportsQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">La file de modération est inaccessible. Réessayez dans quelques instants.</div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Check className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <p className="font-medium">Aucun signalement à traiter</p>
          <p className="text-sm text-muted-foreground mt-1">La file de modération est à jour.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="w-3 h-3" /> {reasonLabels[report.reason]}</span>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{report.comment?.text ?? "Commentaire indisponible"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Auteur : {report.comment?.userName ?? "inconnu"}</p>
                </div>
              </div>
              {report.detail && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Signalement : {report.detail}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => handleModerate(report, "hide")} disabled={moderateMutation.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/30 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50"><EyeOff className="w-3.5 h-3.5" /> Masquer</button>
                <button onClick={() => handleModerate(report, "delete")} disabled={moderateMutation.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Supprimer</button>
                <button onClick={() => handleDismiss(report)} disabled={resolveMutation.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"><X className="w-3.5 h-3.5" /> Écarter</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
