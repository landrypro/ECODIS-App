import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, KeyRound, LoaderCircle, Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth-context";
import { canRemoveMfaFactor, getVerifiedMfaFactors, type MfaEnrollment } from "../../domain/mfa";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";

export function MfaSecurityPage() {
  const navigate = useNavigate();
  const {
    user,
    isAdmin,
    mfa,
    refreshMfa,
    startMfaEnrollment,
    verifyMfaEnrollment,
    unenrollMfaFactor,
  } = useAuth();
  const verifiedFactors = useMemo(() => getVerifiedMfaFactors(mfa.factors), [mfa.factors]);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => { void refreshMfa(); }, []);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <KeyRound className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h1 className="text-lg font-semibold">Sécurité MFA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour gérer la sécurité de votre compte.</p>
        <button onClick={() => navigate("/login")} className="mt-5 rounded-xl bg-[#152a6b] px-4 py-2 text-sm font-medium text-white">Se connecter</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <h1 className="text-lg font-semibold">Sécurité MFA</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette page est réservée aux comptes administrateurs ECODIS.</p>
        <button onClick={() => navigate("/profil")} className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-medium">Retour au profil</button>
      </div>
    );
  }

  const startEnrollment = async () => {
    setError("");
    setIsWorking(true);
    try {
      const label = verifiedFactors.length === 0 ? "ECODIS principal" : `ECODIS secours ${verifiedFactors.length + 1}`;
      setEnrollment(await startMfaEnrollment(label));
      setCode("");
    } catch (caught: any) {
      setError(caught?.message || "La configuration MFA n'a pas pu démarrer.");
    } finally {
      setIsWorking(false);
    }
  };

  const activateEnrollment = async () => {
    if (!enrollment) return;
    setError("");
    setIsWorking(true);
    try {
      await verifyMfaEnrollment(enrollment.factorId, code);
      setEnrollment(null);
      setCode("");
      toast.success("Facteur MFA activé. Votre session est maintenant sécurisée.");
    } catch (caught: any) {
      setError(caught?.message || "Le code est invalide ou expiré.");
    } finally {
      setIsWorking(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!canRemoveMfaFactor(mfa.factors, factorId)) return;
    if (!window.confirm("Retirer ce facteur MFA ? Gardez toujours un facteur de secours actif.")) return;
    setError("");
    setIsWorking(true);
    try {
      await unenrollMfaFactor(factorId);
      toast.success("Facteur MFA retiré.");
    } catch (caught: any) {
      setError(caught?.message || "Le facteur MFA n'a pas pu être retiré.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="bg-[#152a6b] px-4 py-5 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => navigate("/profil")} aria-label="Retour au profil" className="rounded-lg p-1 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-lg font-semibold">Sécurité MFA</h1>
            <p className="text-xs text-white/65">Protection renforcée de l'administration</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mfa.currentLevel === "aal2" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">État de la session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mfa.isLoading ? "Vérification de la session…" : mfa.currentLevel === "aal2" ? "MFA vérifiée — les actions sensibles sont autorisées." : "MFA non vérifiée — les actions sensibles restent bloquées."}
              </p>
            </div>
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {enrollment ? (
          <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Ajouter un facteur MFA</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Ouvrez Google Authenticator, Authy, 1Password ou une application compatible.</li>
              <li>Scannez ce QR code. Ne le partagez avec personne.</li>
              <li>Saisissez ensuite le code à six chiffres généré.</li>
            </ol>
            <img src={enrollment.qrCode} alt="QR code de configuration MFA" className="mx-auto my-5 h-52 w-52 rounded-xl border bg-white p-3" />
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="mb-3 text-sm font-medium">Code de vérification</p>
              <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" containerClassName="justify-center">
                <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
              </InputOTP>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" disabled={isWorking} onClick={() => { setEnrollment(null); setCode(""); setError(""); }} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Annuler</button>
              <button type="button" disabled={isWorking || code.length !== 6} onClick={() => void activateEnrollment()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#152a6b] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {isWorking && <LoaderCircle className="h-4 w-4 animate-spin" />} Activer
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Applications d'authentification</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ajoutez au moins un facteur de secours sur un autre appareil ou dans un coffre-fort sécurisé.</p>
              </div>
              <Smartphone className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              {verifiedFactors.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Aucun facteur MFA actif.</p> : verifiedFactors.map((factor, index) => (
                <div key={factor.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{factor.friendlyName || `Application ${index + 1}`}</p><p className="text-xs text-muted-foreground">TOTP vérifié</p></div>
                  <button type="button" disabled={isWorking || !canRemoveMfaFactor(mfa.factors, factor.id)} title={canRemoveMfaFactor(mfa.factors, factor.id) ? "Retirer ce facteur" : "Ajoutez un facteur de secours avant de retirer le dernier facteur"} onClick={() => void removeFactor(factor.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /><span className="sr-only">Retirer le facteur</span></button>
                </div>
              ))}
            </div>
            <button type="button" disabled={isWorking} onClick={() => void startEnrollment()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#152a6b]/20 bg-[#152a6b]/5 px-4 py-2.5 text-sm font-medium text-[#152a6b] disabled:opacity-50">
              {isWorking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {verifiedFactors.length === 0 ? "Activer MFA" : "Ajouter un facteur de secours"}
            </button>
          </section>
        )}

        <p className="px-2 text-center text-xs text-muted-foreground">ECODIS ne stocke pas votre QR code ni le secret TOTP. Conservez toujours un second facteur MFA vérifié.</p>
      </main>
    </div>
  );
}
