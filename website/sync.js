/* Production website ↔ Windows theme sync. Tokens live in JavaScript memory only. */
(() => {
  "use strict";
  const URL = "https://wfqudstuncdldsvxqveu.supabase.co";
  const KEY = "sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar";
  const authSuffix = "@users.zuzucord.invalid";
  const publicSuffix = "@zuzucord.com";
  const $ = name => document.getElementById(name);
  let accessToken = null;
  let refreshToken = null;
  let accessExpiresAt = 0;
  let renewing = null;
  let accountId = null;
  let authId = null;
  let saving = false;
  const setStatus = (message, error = false) => {
    const el = $("sync-status");
    el.textContent = message;
    el.classList.toggle("sync-error", error);
  };
  const validTheme = value => ["oled", "graphite", "midnight"].includes(value) ? value : "oled";
  const validAccent = color => /^#[0-9a-fA-F]{6}$/.test(color || "") ? color.toLowerCase() : "#c9c9d2";
  const loginEmail = (value) => {
    const input = value.trim().toLowerCase();
    const username = input.endsWith(publicSuffix) ? input.slice(0, -publicSuffix.length) : input;
    if (/^[a-z0-9_]{3,24}$/.test(username)) return username + authSuffix;
    if (input.includes("@") && !input.endsWith(publicSuffix)) return input;
    throw new Error("Enter a valid ZuzuCord ID or existing account email.");
  };
  async function ensureSession() {
    if (!accessToken || !accountId) throw new Error("Sign in again to access website sync.");
    if (Date.now() < accessExpiresAt - 60000) return;
    if (!refreshToken) { signOut(); throw new Error("Session expired. Sign in again."); }
    if (!renewing) renewing = (async () => {
      const response = await fetch(URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "apikey": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "omit", cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token || !data.refresh_token)
        throw new Error("Your session expired. Sign in again.");
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      accessExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
    })().finally(() => { renewing = null; });
    try { await renewing; }
    catch (error) { signOut(); throw error; }
  }
  async function request(path, { method = "GET", body = undefined, authorized = false, prefer = undefined } = {}) {
    const headers = { "apikey": KEY, "Accept": "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authorized) {
      await ensureSession();
      headers["Authorization"] = "Bearer " + accessToken;
    }
    if (prefer) headers["Prefer"] = prefer;
    const response = await fetch(URL + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store", credentials: "omit"
    });
    const payload = await response.text();
    let data = null;
    try { data = payload ? JSON.parse(payload) : null; } catch { }
    if (!response.ok) {
      const message = typeof data?.msg === "string" ? data.msg
        : typeof data?.message === "string" ? data.message
        : typeof data?.error_description === "string" ? data.error_description
        : "Request failed (HTTP " + response.status + ")";
      throw new Error(message);
    }
    return data;
  }
  function setPreview() {
    const theme = validTheme($("theme-choice").value);
    const accent = validAccent($("accent-choice").value);
    const colors = {
      oled: ["#000000", "#101013", "#202025"],
      graphite: ["#151518", "#242428", "#333339"],
      midnight: ["#080d1d", "#161c30", "#222943"]
    };
    const card = $("theme-preview");
    const gradientOn = $("gradient-toggle").checked === true;
    const start = validAccent($("gradient-start").value);
    const end = validAccent($("gradient-end").value);
    card.style.setProperty("--demo-background", gradientOn
      ? "radial-gradient(ellipse at 15% 30%, " + start + ", transparent 78%), linear-gradient(140deg, " + end + ", #050509)"
      : colors[theme][0]);
    card.style.setProperty("--demo-glow", String(Math.max(0,Math.min(100,Number($("glass-strength").value)||0))/100));
    card.classList.toggle("motion-active", $("motion-toggle").checked === true);
    $("glass-value").textContent = String(Math.max(0,Math.min(100,Number($("glass-strength").value)||0))) + "%";
    card.style.setProperty("--demo-panel", colors[theme][1]);
    card.style.setProperty("--demo-input", colors[theme][2]);
    card.style.setProperty("--demo-accent", accent);
    $("accent-value").textContent = accent.toUpperCase();
  }
  function signOut() {
    accessToken = null;
    refreshToken = null;
    accessExpiresAt = 0;
    accountId = null;
    authId = null;
    $("login-secret").value = "";
    $("sync-panel").hidden = true;
    $("login-panel").hidden = false;
    $("signin-form").reset();
    setStatus("Signed out of the production website. Your Windows app login was not changed.");
  }
  async function refreshServers(selectId = null) {
    const servers = await request("/rest/v1/zuzucord_servers?select=id,name&order=name.asc",
      { authorized: true });
    const selector = $("active-server");
    const selected = selectId ?? selector.value;
    selector.replaceChildren(new Option("Public rooms (no server)", ""));
    for (const server of Array.isArray(servers) ? servers : []) {
      if (typeof server.id === "string" && typeof server.name === "string") {
        selector.add(new Option(server.name, server.id));
      }
    }
    selector.value = selected;
    if (selector.selectedIndex < 0) selector.value = "";
  }
  async function loadTheme() {
    await refreshServers();
    const selector = $("active-server");
    const data = await request("/rest/v1/zuzucord_user_sync?select=theme,accent,sync_enabled,last_server_id,gradient_enabled,gradient_start,gradient_end,glass_strength,motion_enabled&user_id=eq." +
      encodeURIComponent(accountId), { authorized: true });
    const record = Array.isArray(data) ? data[0] : null;
    $("theme-choice").value = validTheme(record?.theme);
    $("accent-choice").value = validAccent(record?.accent);
    $("sync-toggle").checked = record?.sync_enabled === true;
    $("gradient-toggle").checked = record?.gradient_enabled === true;
    $("gradient-start").value = validAccent(record?.gradient_start || "#25083f");
    $("gradient-end").value = validAccent(record?.gradient_end || "#09050f");
    $("glass-strength").value = String(Math.max(0,Math.min(100,Number(record?.glass_strength ?? 64))));
    $("motion-toggle").checked = record?.motion_enabled !== false;
    selector.value = record?.last_server_id || "";
    if (selector.selectedIndex < 0) selector.value = "";
    setPreview();
  }
  async function signIn(event) {
    event.preventDefault();
    const button = $("login-button");
    button.disabled = true;
    setStatus("Checking your account and beta authorization…");
    try {
      authId = $("login-id").value.trim().toLowerCase();
      const email = loginEmail(authId);
      const session = await request("/auth/v1/token?grant_type=password", {
        method: "POST", body: { email, password: $("login-secret").value }
      });
      $("login-secret").value = "";
      if (!session?.access_token || !session?.user?.id) throw new Error("Could not establish a secure session.");
      accessToken = session.access_token;
      refreshToken = session.refresh_token || null;
      accessExpiresAt = Date.now() + Math.max(60, Number(session.expires_in) || 3600) * 1000;
      accountId = session.user.id;
      await loadTheme();
      $("signed-in-id").textContent = "ZuzuCord account · " + authId;
      $("login-panel").hidden = true;
      $("sync-panel").hidden = false;
      setStatus("Signed in. Edit your colors or your home server, then save.");
    } catch (error) {
      accessToken = null; refreshToken = null; accessExpiresAt = 0; accountId = null;
      $("login-secret").value = "";
      setStatus(error instanceof Error ? error.message : "Could not verify your account.", true);
    } finally { button.disabled = false; }
  }
  async function serverAction(action) {
    if (saving || !accessToken || !accountId) return;
    const button = $(action === "create" ? "server-create" : "server-join");
    button.disabled = true;
    try {
      let path, body;
      if (action === "create") {
        const name = $("server-new-name").value.trim();
        if (name.length < 2 || name.length > 48) throw new Error("Server names must be 2–48 characters.");
        path = "/rest/v1/rpc/zuzucord_create_server";
        body = { p_name: name, p_description: "" };
      } else {
        const code = $("server-invite").value.trim().toLowerCase();
        if (!/^[0-9a-f]{16}$/.test(code)) throw new Error("Enter a valid 16-character invite code.");
        path = "/rest/v1/rpc/zuzucord_join_server";
        body = { p_invite: code };
      }
      const id = await request(path, { method: "POST", body, authorized: true });
      if (typeof id !== "string") throw new Error("The server request did not return a server ID.");
      await refreshServers(id);
      $("server-new-name").value = "";
      $("server-invite").value = "";
      setStatus(action === "create"
        ? "Server created. Select Save to sync it as your default server on Windows."
        : "Server joined. Select Save to sync it as your default server on Windows.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Server action failed.", true);
    } finally { button.disabled = false; }
  }
  async function showServerInvite() {
    const id = $("active-server").value;
    if (!id) { setStatus("Choose a server first.", true); return; }
    try {
      const code = await request("/rest/v1/rpc/zuzucord_server_invite", {
        method: "POST", body: { p_server: id }, authorized: true
      });
      if (typeof code !== "string" || !code) throw new Error("Only the server owner can view the invitation code.");
      setStatus("Invite code: " + code + " — share it privately with someone you want to invite.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Invite unavailable.", true); }
  }

  async function saveTheme() {
    if (saving || !accessToken || !accountId) return;
    const button = $("sync-save");
    saving = true;
    button.disabled = true;
    try {
      // The database enforces access again for every write via RLS.
      await request("/rest/v1/zuzucord_user_sync?on_conflict=user_id", {
        method: "POST", authorized: true,
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          user_id: accountId,
          theme: validTheme($("theme-choice").value),
          accent: validAccent($("accent-choice").value),
          sync_enabled: $("sync-toggle").checked,
          gradient_enabled: $("gradient-toggle").checked,
          gradient_start: validAccent($("gradient-start").value),
          gradient_end: validAccent($("gradient-end").value),
          glass_strength: Math.max(0,Math.min(100,Number($("glass-strength").value)||0)),
          motion_enabled: $("motion-toggle").checked,
          last_server_id: $("active-server").value || null,
          updated_at: new Date().toISOString()
        }
      });
      setStatus("Saved. The Windows app will pull your theme and selected server when sync is enabled.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed. Sign in again if your session expired.", true);
    } finally { saving = false; button.disabled = false; }
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("signin-form").addEventListener("submit", signIn);
    $("sync-save").addEventListener("click", saveTheme);
    $("server-create").addEventListener("click", () => serverAction("create"));
    $("server-join").addEventListener("click", () => serverAction("join"));
    $("server-share").addEventListener("click", showServerInvite);
    $("sync-reload").addEventListener("click", async () => {
      try { await loadTheme(); setStatus("Latest app and website preferences loaded."); }
      catch (error) { setStatus(error instanceof Error ? error.message : "Unable to refresh.", true); }
    });
    $("sync-signout").addEventListener("click", signOut);
    $("theme-choice").addEventListener("change", setPreview);
    $("accent-choice").addEventListener("input", setPreview);
    $("reset-choice").addEventListener("click", () => {
      $("theme-choice").value = "oled";
      $("accent-choice").value = "#a978ff";
      $("gradient-toggle").checked = true;
      $("gradient-start").value = "#25083f";
      $("gradient-end").value = "#09050f";
      $("glass-strength").value = "64";
      $("motion-toggle").checked = true;
      setPreview();
    });
    for (const id of ["gradient-toggle", "gradient-start", "gradient-end", "glass-strength", "motion-toggle"]) {
      $(id).addEventListener(id === "gradient-toggle" || id === "motion-toggle" ? "change" : "input", setPreview);
    }
    setPreview();
  });
})();