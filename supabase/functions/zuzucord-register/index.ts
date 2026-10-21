import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

// The URL and service-role key are automatically provided inside Supabase Edge Functions.
// Never put service-role credentials in the static website or Windows executable.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Cache-Control": "no-store",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return respond({ error: "POST is required" }, 405);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    return respond({ error: "Expected JSON" }, 415);

  const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || request.headers.get("cf-connecting-ip");
  if (!ip) return respond({ error: "Unable to verify request origin" }, 400);

  let body: { username?: unknown; password?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 1500) return respond({ error: "Request too large" }, 413);
    body = JSON.parse(raw);
  } catch { return respond({ error: "Invalid JSON" }, 400); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9_]{3,24}$/.test(username))
    return respond({ error: "Username must be 3–24 characters: lowercase letters, numbers or underscore." }, 400);
  if (password.length < 10 || password.length > 128)
    return respond({ error: "Password must be between 10 and 128 characters." }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return respond({ error: "Registration is temporarily unavailable" }, 503);
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const fingerprint = toHex(await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(ip + "|" + secret)));
    const { data: slot, error: slotError } = await supabase.rpc(
      "zuzucord_claim_signup_slot", { p_fingerprint: fingerprint });
    if (slotError) {
      console.error("Signup limiter unavailable:", slotError.message);
      return respond({ error: "Registration is temporarily unavailable." }, 503);
    }
    if (!slot) return respond({ error: "Too many account attempts from this connection. Please wait up to an hour before retrying.", code: "RATE_LIMITED" }, 429);

    // Supabase Auth uses an internal, non-deliverable email as a login identifier.
    // No user-owned email address is requested. Password recovery via email is unavailable.
    const email = username + "@users.zuzucord.invalid";
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, registration: "zuzucord" },
    });
    if (error || !data.user) {
      if (error) console.error("Supabase Auth registration failed:", { code: error.code, status: error.status, message: error.message });
      const duplicate = error?.code === "email_exists" || /already registered|already exists|duplicate/i.test(error?.message ?? "");
      if (duplicate) return respond({ error: "That username is already taken.", code: "USERNAME_TAKEN" }, 409);
      const weakPassword = error?.code === "weak_password";
      if (weakPassword) return respond({ error: "Choose a stronger password.", code: "WEAK_PASSWORD" }, 400);
      return respond({ error: "The account service is temporarily unavailable. Try again shortly.", code: "AUTH_UNAVAILABLE" }, 503);
    }
    const { error: insertError } = await supabase.from("zuzucord_accounts")
      .insert({ user_id: data.user.id, username });
    if (insertError) {
      console.error("ZuzuCord account link failed:", { code: insertError.code, message: insertError.message });
      const { error: rollbackError } = await supabase.auth.admin.deleteUser(data.user.id);
      if (rollbackError) console.error("Could not roll back incomplete signup:", rollbackError.message);
      if (insertError.code === "23505") return respond({ error: "That username is already taken.", code: "USERNAME_TAKEN" }, 409);
      return respond({ error: "Registration couldn't be completed because of a server issue. Your username is not the problem; retry later.", code: "ACCOUNT_LINK_FAILED" }, 503);
    }
    return respond({
      success: true,
      login: username + "@zuzucord.com",
      message: "Your account is ready. Open ZuzuCord for Windows and sign in with your username and password.",
    }, 201);
  } catch (error) {
    console.error("Unexpected registration error:", error instanceof Error ? error.message : "unknown");
    return respond({ error: "Registration temporarily unavailable." }, 503);
  }
});
