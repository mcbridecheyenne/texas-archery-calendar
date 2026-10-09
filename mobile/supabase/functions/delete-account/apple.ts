// Revoking "Sign in with Apple" when an account is deleted (Apple guideline 5.1.1(v)).
// The app sends a fresh authorization code from Apple; we trade it for a refresh token and
// revoke that token, which removes the app from the person's Apple ID.
// https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
import { importPKCS8, SignJWT } from "npm:jose@5";

export const APPLE_TEAM_ID = "75Y3S5CV88";
export const APPLE_CLIENT_ID = "com.cheyennemcbride.archeryintexas"; // the app's bundle id

/** The short-lived client secret Apple asks for: a JWT signed with the Sign in with Apple key (.p8). */
export async function appleClientSecret(privateKeyPem: string, keyId: string, now = new Date()): Promise<string> {
  const key = await importPKCS8(privateKeyPem.replace(/\\n/g, "\n").trim(), "ES256");
  const iat = Math.floor(now.getTime() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(APPLE_CLIENT_ID)
    .sign(key);
}

async function post(path: string, form: Record<string, string>): Promise<Response> {
  return await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(15000),
  });
}

/** Trades the code for a token and revokes it. Returns null when done, or what went wrong. */
export async function revokeApple(code: string, privateKeyPem: string, keyId: string): Promise<string | null> {
  const clientSecret = await appleClientSecret(privateKeyPem, keyId);
  const tokenRes = await post("token", {
    client_id: APPLE_CLIENT_ID,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });
  if (!tokenRes.ok) return `token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`;
  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) return "Apple returned no token";
  const revokeRes = await post("revoke", {
    client_id: APPLE_CLIENT_ID,
    client_secret: clientSecret,
    token,
    token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
  });
  return revokeRes.ok ? null : `revoke failed (${revokeRes.status})`;
}
