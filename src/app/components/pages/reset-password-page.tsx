import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth-context";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  if (password !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

export function ResetPasswordPage() {
  const { isLoading, session, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPassword(password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (resetError: any) {
      console.error("Password reset error:", resetError);
      setError("Le lien est invalide ou expire. Demandez un nouveau lien de reinitialisation.");
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
          <h2 className="text-[#152a6b] text-lg font-semibold mb-1">Choisir un nouveau mot de passe</h2>
          <p className="text-gray-500 text-xs mb-6">Utilisez au moins 8 caracteres, dont une lettre et un chiffre.</p>

          {isLoading ? (
            <div className="text-center text-sm text-gray-500 py-4">Verification du lien securise...</div>
          ) : !session ? (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-3">
              Ce lien est invalide ou expire. Demandez un nouveau lien de reinitialisation.
            </div>
          ) : (
            <>
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
              <div className="space-y-4">
                <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                <PasswordField label="Confirmer le mot de passe" value={confirmation} onChange={setConfirmation} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
              <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-[#152a6b] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-colors disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Mettre a jour le mot de passe</>}
              </button>
            </>
          )}
          <p className="text-center text-xs text-gray-500 mt-4"><Link to="/forgot-password" className="text-[#152a6b] font-medium">Demander un nouveau lien</Link></p>
        </form>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void }) {
  return <div>
    <label className="text-xs text-gray-600 mb-1 block">{label}</label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" required className="w-full pl-10 pr-10 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 focus:border-[#152a6b]" />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
    </div>
  </div>;
}
