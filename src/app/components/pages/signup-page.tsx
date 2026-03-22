import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../auth-context";
import { signupUser } from "../api";
import { UserPlus, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import logoImg from "@/assets/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

export function SignupPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"generic" | "duplicate">("generic");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorType("generic");
    if (!email.includes("@")) {
      setError("Veuillez entrer une adresse email valide");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres, avec au moins une lettre et un chiffre");
      return;
    }
    setLoading(true);
    try {
      await signupUser(email, password, name);
      // Auto sign in after signup
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      console.error("Signup error:", err);
      const msg = err.message || "";
      if (msg.toLowerCase().includes("already been registered") || msg.toLowerCase().includes("already exists")) {
        setErrorType("duplicate");
        setError("Un compte avec cet email existe deja.");
      } else {
        setError(msg || "Erreur lors de l'inscription");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#152a6b] flex flex-col items-center justify-center px-6 lg:pl-[240px]">
      <div className="w-full max-w-sm">
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

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-xl"
        >
          <h2 className="text-[#152a6b] text-lg font-semibold mb-1">
            Inscription
          </h2>
          <p className="text-gray-500 text-xs mb-6">
            Creez votre compte pour acceder aux messages
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2 mb-4">
              {error}
              {errorType === "duplicate" && (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="block mt-2 w-full py-2 bg-[#152a6b] text-white rounded-lg text-xs font-medium text-center hover:bg-[#1e3a8a] transition-colors"
                >
                  Se connecter a la place
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#152a6b]/30 focus:border-[#152a6b]"
                />
              </div>
            </div>

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
                  placeholder="Au moins 6 caracteres"
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
                <UserPlus className="w-4 h-4" />
                S'inscrire
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Deja un compte ?{" "}
            <Link to="/login" className="text-[#152a6b] font-medium">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}