import { useState } from "react";
import { Link } from "react-router";
import { Mail, Send } from "lucide-react";
import { useAuth } from "../auth-context";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (requestError: any) {
      console.error("Password reset request error:", requestError);
      setError("Impossible d'envoyer le lien pour le moment. Reessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#152a6b] flex flex-col items-center justify-center px-6 lg:pl-[240px]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoImg} alt="ECODIS" className="h-20 w-auto mx-auto mb-4 rounded-lg bg-white/90 p-2" />
          <h1 className="text-white text-2xl font-bold">ECO<span className="text-[#9b1b30]">DIS</span></h1>
          <p className="text-white/60 text-sm">Ecole des Disciples</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl">
          <h2 className="text-[#152a6b] text-lg font-semibold mb-1">Mot de passe oublie</h2>
          <p className="text-gray-500 text-xs mb-6">Recevez un lien securise pour choisir un nouveau mot de passe.</p>

          {sent ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-3">
              Si cette adresse correspond a un compte ECODIS, un lien de reinitialisation vient d'etre envoye.
            </div>
          ) : (
            <>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
              <label className="text-xs text-gray-600 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 focus:border-[#152a6b]"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-[#152a6b] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-colors disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer le lien</>}
              </button>
            </>
          )}

          <p className="text-center text-xs text-gray-500 mt-4"><Link to="/login" className="text-[#152a6b] font-medium">Retour a la connexion</Link></p>
        </form>
      </div>
    </div>
  );
}
