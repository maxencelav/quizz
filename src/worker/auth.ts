import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Admin authentication via Cloudflare Access.
 *
 * Access protects /admin*, /api/admin/* and /host/* at the edge, but the Worker
 * always re-verifies the JWT: that is what protects the API if the Access app is
 * misconfigured, as well as the host WebSocket (/parties/*, which must stay
 * public for players).
 */

/** Internal header set by the Worker after verification. Always stripped from incoming requests. */
export const VERIFIED_ADMIN_HEADER = "x-quizz-admin";

export interface AdminIdentity {
  email: string;
  /** true in dev (DEV_AUTH_BYPASS): no Access session, so logging out isn't possible */
  devBypass?: boolean;
}

let jwks: { url: string; get: JWTVerifyGetKey } | null = null;

function getJwks(teamDomain: string) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  // Cached per isolate (jose handles key rotation)
  if (jwks?.url !== url) jwks = { url, get: createRemoteJWKSet(new URL(url)) };
  return jwks.get;
}

function readToken(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  // The host WebSocket doesn't get the header (route not behind Access), but the cookie is sent
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function verifyAdmin(request: Request, env: Env): Promise<AdminIdentity | null> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, "");

  if (!teamDomain || !env.ACCESS_AUD) {
    // No Access locally: explicit bypass through .dev.vars only
    if (env.DEV_AUTH_BYPASS === "true") return { email: "dev@localhost", devBypass: true };
    console.error("ACCESS_TEAM_DOMAIN / ACCESS_AUD not configured: admin access denied");
    return null;
  }

  const token = readToken(request);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience: env.ACCESS_AUD,
    });
    return { email: String(payload.email ?? payload.sub ?? "admin") };
  } catch {
    return null;
  }
}
