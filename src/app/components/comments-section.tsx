import { useState } from "react";
import { useAuth } from "./auth-context";
import { useCommentMutations, useComments } from "../hooks/use-comments";
import { Flag, MessageCircle, Send, Trash2, Loader2, LogIn } from "lucide-react";
import type { CommentReportReason } from "../services";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface CommentsSectionProps {
  messageId: string;
}

export function CommentsSection({ messageId }: CommentsSectionProps) {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const { data: comments = [], isLoading } = useComments(messageId);
  const { addMutation, deleteMutation, reportMutation } = useCommentMutations(messageId, accessToken);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !text.trim()) return;
    if (!navigator.onLine) {
      toast.error("Les commentaires ne sont pas disponibles hors ligne. Votre texte reste dans le formulaire.");
      return;
    }

    try {
      await addMutation.mutateAsync(text.trim());
      setText("");
      toast.success("Commentaire ajoute !");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi du commentaire");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!accessToken) return;
    if (!navigator.onLine) { toast.error("La suppression d'un commentaire necessite une connexion."); return; }
    try {
      await deleteMutation.mutateAsync(commentId);
      toast.success("Commentaire supprime");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  const handleReport = async (commentId: string) => {
    if (!accessToken) return;
    if (!navigator.onLine) { toast.error("Le signalement necessite une connexion."); return; }
    const reason = window.prompt(
      "Motif : spam, harassment, inappropriate_content, misinformation ou other",
      "other",
    )?.trim() as CommentReportReason | undefined;
    if (!reason) return;
    const detail = window.prompt("Précision facultative", "")?.trim() ?? "";
    try {
      await reportMutation.mutateAsync({ commentId, reason, detail });
      toast.success("Signalement transmis à la modération");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du signalement");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHour < 24) return `Il y a ${diffHour}h`;
    if (diffDay < 7) return `Il y a ${diffDay}j`;
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const avatarColors = [
    "bg-[#152a6b]",
    "bg-[#9b1b30]",
    "bg-[#4a6fa5]",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-purple-600",
    "bg-rose-600",
    "bg-teal-600",
  ];

  const getAvatarColor = (userId: string) => {
    let hash = 0;
    for (let index = 0; index < userId.length; index += 1) {
      hash = userId.charCodeAt(index) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  return (
    <div className="mt-5 pt-5 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Commentaires</h3>
        <span className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full font-medium">
          {comments.length}
        </span>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex gap-2">
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(user.id)} flex items-center justify-center shrink-0 mt-0.5`}>
              <span className="text-white text-[10px] font-medium">
                {getInitials(user.user_metadata?.name || user.email?.split("@")[0] || "U")}
              </span>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ecrire un commentaire..."
                rows={2}
                className="w-full px-3 py-2 pr-12 bg-muted/50 rounded-xl text-[13px] border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={addMutation.isPending || !text.trim()}
                className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#152a6b] flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => navigate("/login")}
          className="w-full mb-5 flex items-center justify-center gap-2 py-3 bg-muted/50 rounded-xl border border-border text-muted-foreground text-xs hover:bg-muted transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Connectez-vous pour commenter
        </button>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6">
          <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-xs">Aucun commentaire pour le moment.</p>
          <p className="text-muted-foreground/60 text-[11px] mt-0.5">Soyez le premier a reagir !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const canDelete = Boolean(user && comment.userId === user.id);
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === comment.id;
            const isReporting = reportMutation.isPending && reportMutation.variables?.commentId === comment.id;
            return (
              <div key={comment.id} className="flex gap-2.5">
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(comment.userId)} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-[10px] font-medium">{getInitials(comment.userName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/40 rounded-xl px-3 py-2 border border-border/50">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-medium text-foreground">{comment.userName}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-card-foreground leading-relaxed whitespace-pre-wrap break-words">{comment.text}</p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={isDeleting}
                      className="flex items-center gap-1 mt-1 ml-2 text-[11px] text-muted-foreground hover:text-[#9b1b30] transition-colors"
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Supprimer
                    </button>
                  )}
                  {user && !canDelete && (
                    <button
                      onClick={() => handleReport(comment.id)}
                      disabled={isReporting}
                      className="flex items-center gap-1 mt-1 ml-2 text-[11px] text-muted-foreground hover:text-amber-700 transition-colors"
                    >
                      {isReporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                      Signaler
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
