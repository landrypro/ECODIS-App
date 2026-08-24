import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "./auth-context";
import { getVerifiedMfaFactors, shouldBlockMfaChallenge } from "../domain/mfa";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";

export function MfaChallengeDialog() {
  const { user, isAdmin, mfa, verifyMfaChallenge } = useAuth();
  const verifiedFactors = useMemo(() => getVerifiedMfaFactors(mfa.factors), [mfa.factors]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shouldOpen = Boolean(user && shouldBlockMfaChallenge(isAdmin, mfa, window.location.pathname));

  useEffect(() => {
    setCode("");
    setError("");
  }, [user?.id]);

  useEffect(() => {
    if (!factorId && verifiedFactors[0]) setFactorId(verifiedFactors[0].id);
    if (factorId && !verifiedFactors.some((factor) => factor.id === factorId)) setFactorId(verifiedFactors[0]?.id ?? "");
  }, [factorId, verifiedFactors]);

  const verify = async () => {
    if (!factorId) return;
    setError("");
    setIsSubmitting(true);
    try {
      await verifyMfaChallenge(factorId, code);
      setCode("");
    } catch (caught: any) {
      setError(caught?.message || "Le code MFA est invalide ou expiré.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSecurityPage = () => {
    window.location.assign("/security/mfa");
  };

  return (
    <Dialog open={shouldOpen} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">Vérification MFA obligatoire</DialogTitle>
          <DialogDescription className="text-center">
            Confirmez votre identité avec votre application d'authentification pour poursuivre dans l'espace administrateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {verifiedFactors.length > 1 && (
            <label className="block text-sm font-medium text-foreground">
              Facteur à utiliser
              <select value={factorId} onChange={(event) => setFactorId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {verifiedFactors.map((factor, index) => (
                  <option key={factor.id} value={factor.id}>{factor.friendlyName || `Application ${index + 1}`}</option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
            <Smartphone className="mx-auto mb-2 h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Saisissez le code à six chiffres affiché par votre application.</p>
            <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" className="mt-3" containerClassName="justify-center">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <DialogFooter>
          <button type="button" onClick={openSecurityPage} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground">Gérer MFA</button>
          <button type="button" disabled={code.length !== 6 || isSubmitting} onClick={() => void verify()} className="rounded-xl bg-[#152a6b] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {isSubmitting ? "Vérification…" : "Vérifier"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
