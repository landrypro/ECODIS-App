import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { createMessage } from "../api";
import {
  ArrowLeft,
  Upload,
  Mic,
  Video,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Plus,
  ShieldOff,
} from "lucide-react";

const categoriesByType: Record<string, string[]> = {
  audio: ["Predications", "Enseignements", "Louanges", "Temoignages"],
  video: ["Cultes", "Seminaires", "Formations", "Conferences"],
  text: ["Etudes bibliques", "Meditations", "Articles", "Notes de predication"],
};

export function AdminPage() {
  const { user, accessToken, isAdmin } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<"audio" | "video" | "text">("audio");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
        <h2 className="text-foreground text-lg font-semibold">Acces restreint</h2>
        <p className="text-muted-foreground text-center text-sm">
          Seuls les administrateurs peuvent acceder a cette page. Contactez un administrateur pour obtenir les droits necessaires.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("title", title);
      formData.append("author", author);
      formData.append("category", category);
      formData.append("description", description);
      formData.append("duration", duration);
      formData.append("thumbnail", thumbnail);
      if (mediaFile) {
        formData.append("media", mediaFile);
      }

      await createMessage(formData, accessToken);
      setSuccess(true);
      // Reset
      setTitle("");
      setAuthor("");
      setCategory("");
      setDescription("");
      setDuration("");
      setThumbnail("");
      setMediaFile(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la creation du message");
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = [
    { value: "audio" as const, icon: Mic, label: "Audio", color: "bg-[#152a6b]" },
    { value: "video" as const, icon: Video, label: "Video", color: "bg-[#9b1b30]" },
    { value: "text" as const, icon: FileText, label: "Texte", color: "bg-[#4a6fa5]" },
  ];

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto lg:max-w-3xl lg:ml-[240px]">
      {/* Header */}
      <div className="sticky top-0 bg-white z-40 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-medium flex-1">Ajouter un message</h1>
          <Plus className="w-5 h-5 text-primary" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 pb-24 space-y-5">
        {/* Success */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-green-700 text-xs">
              Message cree avec succes !
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-red-700 text-xs">{error}</p>
            <button onClick={() => setError("")} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* Type selector */}
        <div>
          <label className="text-xs font-medium text-foreground mb-2 block">
            Type de message
          </label>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setType(opt.value);
                  setCategory("");
                }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  type === opt.value
                    ? `${opt.color} text-white border-transparent`
                    : "bg-white border-border text-foreground"
                }`}
              >
                <opt.icon className="w-5 h-5" />
                <span className="text-xs">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            Titre *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Titre du message"
            className="w-full px-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30"
          />
        </div>

        {/* Author */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            Auteur *
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
            placeholder="Nom de l'auteur"
            className="w-full px-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            Categorie *
          </label>
          <div className="flex flex-wrap gap-2">
            {categoriesByType[type].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                  category === cat
                    ? "bg-[#152a6b] text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Duration (for audio/video) */}
        {type !== "text" && (
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Duree
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 45:30 ou 1:25:30"
              className="w-full px-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30"
            />
          </div>
        )}

        {/* Thumbnail URL (for video) */}
        {type === "video" && (
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              URL de la vignette
            </label>
            <input
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30"
            />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">
            {type === "text" ? "Contenu du texte *" : "Description"}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required={type === "text"}
            placeholder={
              type === "text"
                ? "Ecrivez le contenu du message..."
                : "Description du message (optionnel)"
            }
            rows={type === "text" ? 8 : 3}
            className="w-full px-4 py-2.5 bg-white rounded-xl text-sm border border-border focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 resize-none"
          />
        </div>

        {/* Media file upload (for audio/video) */}
        {type !== "text" && (
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Fichier {type === "audio" ? "audio" : "video"}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={type === "audio" ? "audio/*" : "video/*"}
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">
                {mediaFile
                  ? mediaFile.name
                  : `Selectionner un fichier ${type}`}
              </span>
            </button>
            {mediaFile && (
              <div className="flex items-center justify-between mt-2 px-2">
                <span className="text-xs text-muted-foreground">
                  {(mediaFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => setMediaFile(null)}
                  className="text-xs text-red-500"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !title || !author || !category}
          className="w-full py-3 bg-[#152a6b] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Publier le message
            </>
          )}
        </button>
      </form>
    </div>
  );
}