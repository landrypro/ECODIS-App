export type RateLimitProfile = "public" | "auth" | "admin";

export type RateLimitSettings = {
  windowSeconds: number;
  publicMax: number;
  authMax: number;
  adminMax: number;
};

export function profileFor(pathname: string): RateLimitProfile {
  if (pathname.includes("/auth/") || pathname.includes("/users/me/role")) return "auth";
  if (pathname.includes("/admin/") || pathname.includes("/users/")) return "admin";
  return "public";
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

export function maxForProfile(profile: RateLimitProfile, settings: RateLimitSettings): number {
  return profile === "auth" ? settings.authMax : profile === "admin" ? settings.adminMax : settings.publicMax;
}
