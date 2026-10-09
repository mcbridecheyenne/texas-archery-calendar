// delete-account: deletes the signed-in person's account completely.
//  1. If they use Sign in with Apple, revokes the app's access to their Apple ID (the app
//     sends a fresh Apple authorization code; Apple asks apps to do this on deletion).
//  2. Deletes their photos (listing photos and tournament flyers) from storage, so nothing
//     they posted stays public. If that fails, the account is NOT deleted, so they can retry.
//  3. Deletes the account through delete_my_account(), which also keeps the ban list.
//
// Secrets (Supabase → Edge Functions → Secrets): APPLE_PRIVATE_KEY (the whole .p8 file from
// Apple Developer → Keys, with Sign in with Apple enabled) and APPLE_KEY_ID (that key's id).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { revokeApple } from "./apple.ts";

const BUCKET = "listing-photos";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Every file under <user id>/ (folders are one or two levels deep: <listing id>/n.jpg, tournaments/x.jpg).
async function userFiles(admin: ReturnType<typeof createClient>, userId: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (prefix: string, depth: number) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${prefix}/${item.name}`;
        if (item.id) out.push(path); // a file
        else if (depth < 3) await walk(path, depth + 1); // a folder
      }
      if (!data || data.length < 1000) break;
    }
  };
  await walk(userId, 1);
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, message: "Use POST." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: who } = await asUser.auth.getUser(token);
  const user = who?.user;
  if (!user) return json(401, { ok: false, message: "Sign in first." });

  const body = (await req.json().catch(() => ({}))) as { appleAuthorizationCode?: unknown };
  const code = typeof body.appleAuthorizationCode === "string" ? body.appleAuthorizationCode.trim() : "";
  const usesApple = (user.identities ?? []).some((i) => i.provider === "apple") || user.app_metadata?.provider === "apple";

  // 1. Apple. A failure here is logged but doesn't stop the deletion: the person asked to
  //    delete, and their data must go either way.
  let apple = "not used";
  if (usesApple) {
    const keyPem = Deno.env.get("APPLE_PRIVATE_KEY");
    const keyId = Deno.env.get("APPLE_KEY_ID");
    if (!code) apple = "no code from the app";
    else if (!keyPem || !keyId) apple = "Apple key not set up";
    else {
      try {
        apple = (await revokeApple(code, keyPem, keyId)) ?? "revoked";
      } catch (e) {
        apple = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (apple !== "revoked") console.error(`delete-account ${user.id}: Apple revoke ${apple}`);
  }

  // 2. Photos.
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const files = await userFiles(admin, user.id);
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
      if (error) throw error;
    }
  } catch (e) {
    console.error(`delete-account ${user.id}: photos`, e);
    return json(500, { ok: false, message: "Couldn't delete your photos. Nothing was deleted; please try again." });
  }

  // 3. The account (cascades to everything else; keeps the ban list for banned accounts).
  const { error } = await asUser.rpc("delete_my_account");
  if (error) {
    console.error(`delete-account ${user.id}: delete_my_account`, error);
    return json(500, { ok: false, message: "Couldn't delete your account. Please try again." });
  }
  return json(200, { ok: true, apple });
});
