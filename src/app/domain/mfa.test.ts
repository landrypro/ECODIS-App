import { describe, expect, it } from "vitest";
import { canRemoveMfaFactor, getVerifiedMfaFactors, requiresMfaStepUp, shouldBlockMfaChallenge, type MfaFactor, type MfaState } from "./mfa";

const verified: MfaFactor = { id: "factor-1", factorType: "totp", friendlyName: "Principal", status: "verified", createdAt: null };
const backup: MfaFactor = { id: "factor-2", factorType: "totp", friendlyName: "Secours", status: "verified", createdAt: null };
const pending: MfaFactor = { id: "factor-3", factorType: "totp", friendlyName: null, status: "unverified", createdAt: null };

const aal1: MfaState = { isLoading: false, currentLevel: "aal1", nextLevel: "aal2", factors: [verified] };

describe("MFA domain", () => {
  it("identifie les facteurs vérifiés et la nécessité d'une élévation AAL2", () => {
    expect(getVerifiedMfaFactors([verified, pending])).toEqual([verified]);
    expect(requiresMfaStepUp(true, aal1)).toBe(true);
    expect(requiresMfaStepUp(false, aal1)).toBe(false);
    expect(requiresMfaStepUp(true, { ...aal1, currentLevel: "aal2" })).toBe(false);
    expect(shouldBlockMfaChallenge(true, aal1, "/admin/users")).toBe(true);
    expect(shouldBlockMfaChallenge(true, aal1, "/security/mfa")).toBe(false);
    expect(shouldBlockMfaChallenge(true, { ...aal1, factors: [] }, "/admin/users")).toBe(false);
  });

  it("protège le dernier facteur MFA vérifié", () => {
    expect(canRemoveMfaFactor([verified], verified.id)).toBe(false);
    expect(canRemoveMfaFactor([verified, backup], verified.id)).toBe(true);
    expect(canRemoveMfaFactor([verified, pending], pending.id)).toBe(false);
  });
});
