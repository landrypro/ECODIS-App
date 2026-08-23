import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router";
import { useAuth } from "../auth-context";
import { LogIn, Eye, EyeOff, Mail, Lock } from "lucide-react";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#152a6b] flex flex-col items-center justify-center px-6 lg:pl-[240px]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={logoImg}
            alt="ECODIS"
            className="h-20 w-auto mx-auto mb-4 rounded-lg bg-white/90 p-2"
          />
          <h1 className="text-white text-2xl font-bold">
            ECO<span className="text-[#9b1b30]">DIS</span>
          </h1>
          <p className="text-white/60 text-sm">Ecole des Disciples</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-xl"
        >
          <h2 className="text-[#152a6b] text-lg font-semibold mb-1">
            Connexion
          </h2>
          <p className="text-gray-500 text-xs mb-6">
            Connectez-vous pour acceder a vos messages
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          {location.state?.passwordReset && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2 mb-4">
              Votre mot de passe a ete mis a jour. Connectez-vous avec votre nouveau mot de passe.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 focus:border-[#152a6b]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 focus:border-[#152a6b]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-[#152a6b] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Se connecter
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            <Link to="/forgot-password" className="text-[#152a6b] font-medium">
              Mot de passe oublie ?
            </Link>
          </p>

          <p className="text-center text-xs text-gray-500 mt-3">
            Pas encore de compte ?{" "}
            <Link to="/signup" className="text-[#152a6b] font-medium">
              S'inscrire
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
