export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
    const corsOrigin = allowed.includes(origin) ? origin : "";
    const headers = {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };
    if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const json = (data, status=200) => new Response(JSON.stringify(data), {
      status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
    });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    if (!corsOrigin) return json({ error: "Origin not allowed" }, 403);
    if (!env.APP_SHARED_SECRET || request.headers.get("Authorization") !== "Bearer " + env.APP_SHARED_SECRET)
      return json({ error: "Unauthorized" }, 401);
    let input;
    try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { channel, bookingId, to, subject="", body="", waWindowOpen=false, templateName="", templateLanguage="en" } = input || {};
    if (!["gmail", "whatsapp"].includes(channel) || !bookingId || !to) return json({ error: "Missing channel, bookingId or recipient" }, 400);
    if (!body && channel === "gmail") return json({ error: "Missing email body" }, 400);
    if (channel === "whatsapp" && !waWindowOpen && !templateName)
      return json({ error: "Outside the 24-hour customer-service window: an approved WhatsApp template is required." }, 400);
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS send_log (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id TEXT NOT NULL, channel TEXT NOT NULL, recipient TEXT NOT NULL, status TEXT NOT NULL, provider_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(booking_id, channel))").run();
      const claim = await env.DB.prepare("INSERT INTO send_log (booking_id, channel, recipient, status) VALUES (?, ?, ?, 'pending') ON CONFLICT(booking_id, channel) DO NOTHING")
        .bind(String(bookingId), channel, String(to)).run();
      if (!claim.meta?.changes) return json({ error: "Already attempted for this booking and channel. Check the send log before retrying." }, 409);
      let providerId = "";
      if (channel === "whatsapp") {
        const version = env.GRAPH_API_VERSION || "v23.0";
        const payload = waWindowOpen
          ? { messaging_product: "whatsapp", recipient_type: "individual", to: String(to).replace(/\D/g, ""), type: "text", text: { preview_url: false, body: String(body) } }
          : { messaging_product: "whatsapp", to: String(to).replace(/\D/g, ""), type: "template", template: { name: String(templateName), language: { code: String(templateLanguage) } } };
        const res = await fetch("https://graph.facebook.com/" + version + "/" + env.WHATSAPP_PHONE_NUMBER_ID + "/messages", {
          method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_ACCESS_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "WhatsApp API error");
        providerId = data.messages?.[0]?.id || "";
      } else {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error_description || "Google OAuth refresh failed");
        const mime = [
          "To: " + to,
          "Subject: =?UTF-8?B?" + btoa(unescape(encodeURIComponent(subject))) + "?=",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: base64",
          "",
          btoa(unescape(encodeURIComponent(body)))
        ].join("\r\n");
        const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST", headers: { Authorization: "Bearer " + tokenData.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ raw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Gmail API error");
        providerId = data.id || "";
      }
      await env.DB.prepare("UPDATE send_log SET status='sent', provider_id=? WHERE booking_id=? AND channel=?")
        .bind(providerId, String(bookingId), channel).run();
      return json({ ok: true, status: "sent", channel, providerId });
    } catch (error) {
      await env.DB.prepare("UPDATE send_log SET status='failed' WHERE booking_id=? AND channel=?")
        .bind(String(bookingId), channel).run();
      return json({ error: String(error.message || error) }, 502);
    }
  }
};