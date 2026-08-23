export type MfaLevel = "aal1" | "aal2" | null;

export interface MfaFactor {
  id: string;
  factorType: "totp" | "phone";
  friendlyName: string | null;
  status: string;
  createdAt: string | null;
}

export interface MfaState {
  isLoading: boolean;
  currentLevel: MfaLevel;
  nextLevel: MfaLevel;
  factors: MfaFactor[];
}

export interface MfaEnrollment {
  factorId: string;
  qrCode: string;
}

export const INITIAL_MFA_STATE: MfaState = {
  isLoading: false,
  currentLevel: null,
  nextLevel: null,
  factors: [],
};

export function isVerifiedMfaFactor(factor: MfaFactor): boolean {
  return factor.status === "verified";
}

export function getVerifiedMfaFactors(factors: MfaFactor[]): MfaFactor[] {
  return factors.filter(isVerifiedMfaFactor);
}

export function requiresMfaStepUp(isAdmin: boolean, state: MfaState): boolean {
  return isAdmin && !state.isLoading && state.currentLevel !== "aal2";
}

export function canRemoveMfaFactor(factors: MfaFactor[], factorId: string): boolean {
  const factor = factors.find((item) => item.id === factorId);
  return Boolean(factor && isVerifiedMfaFactor(factor) && getVerifiedMfaFactors(factors).length > 1);
}
