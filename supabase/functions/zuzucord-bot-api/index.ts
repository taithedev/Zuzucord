// ZuzuCord bot API: issue one-time tokens, revoke, and post approved server bot messages.
// Never handles Discord tokens. Only ZuzuCord tokens are accepted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publishable = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar";
const admin = createClient(url, service, { auth: { persistSession: false } });
const headers = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,apikey,content-type,x-zuzucord-bot-token",
  "access-control-allow-methods": "POST,OPTIONS",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
async function developer(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer (.+)$/i.exec(authorization);
  if (!match) throw Error("Sign in to the ZuzuCord developer portal first.");
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) throw Error("Your sign-in session is invalid.");
  const { data: role, error: roleError } = await admin.from("zuzucord_user_roles")
    .select("role").eq("user_id", data.user.id).eq("role", "developer").maybeSingle();
  if (roleError || !role) throw Error("Developer access is required.");
  return data.user.id;
}
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "POST only" }, 405);
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return respond({ error: "Invalid JSON" }, 400); }
  try {
    const action = body.action;
    if (action === "issue" || action === "revoke") {
      const owner = await developer(request);
      const botId = body.bot_id;
      if (typeof botId !== "string" || !/^[0-9a-f-]{36}$/i.test(botId))
        return respond({ error: "Valid bot application ID required" }, 400);
      const { data: app, error } = await admin.from("zuzucord_bot_apps")
        .select("id,disabled").eq("id", botId).eq("owner_id", owner).maybeSingle();
      if (error || !app || app.disabled) return respond({ error: "Bot application unavailable" }, 404);
      const { error: revokeError } = await admin.from("zuzucord_bot_keys")
        .update({ revoked_at: new Date().toISOString() }).eq("bot_id", botId).is("revoked_at", null);
      if (revokeError) throw Error("Token rotation failed.");
      if (action === "revoke") return respond({ success: true, message: "Tokens revoked" });
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = "zcb_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
      const { error: insertError } = await admin.from("zuzucord_bot_keys")
        .insert({ bot_id: botId, token_hash: await hash(token) });
      if (insertError) throw Error("Token could not be issued.");
      return respond({ success: true, token, message: "Copy this token now. It will not be shown again." }, 201);
    }
    if (action === "send") {
      const token = request.headers.get("x-zuzucord-bot-token") || "";
      if (!/^zcb_[a-f0-9]{64}$/.test(token))
        return respond({ error: "Missing or invalid ZuzuCord bot token" }, 401);
      const { data: key, error } = await admin.from("zuzucord_bot_keys")
        .select("bot_id").eq("token_hash", await hash(token)).is("revoked_at", null).maybeSingle();
      if (error || !key) return respond({ error: "Invalid or revoked bot token" }, 401);
      const channel = body.channel_id, content = body.content;
      if (typeof channel !== "string" || !/^[a-f0-9-]{36}$/i.test(channel)
          || typeof content !== "string" || content.trim().length < 1 || content.length > 1500)
        return respond({ error: "Channel and message (1-1500 characters) required" }, 400);
      const { data, error: postError } = await admin.rpc("zuzucord_post_external_bot_message",
        { p_bot: key.bot_id, p_channel: channel, p_content: content });
      if (postError) return respond({ error: postError.message }, 403);
      return respond({ success: true, message_id: data }, 201);
    }
    return respond({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return respond({ error: message }, /access|sign.in|invalid session/i.test(message) ? 403 : 500);
  }
});
