import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CAMXD_ORDER_WEBHOOK_SECRET")!;
const FIREBASE_PROJECT_ID = "camxd-store";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

let cachedFcmAccessToken = "";
let cachedFcmTokenExpiry = 0;
function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function utf8b64url(value: string) { return b64url(new TextEncoder().encode(value)); }
function pemToBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function getFcmAccessToken(): Promise<string> {
  if (cachedFcmAccessToken && Date.now() < cachedFcmTokenExpiry - 60000) return cachedFcmAccessToken;
  const raw = Deno.env.get("CAMXD_FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("CAMXD_FIREBASE_SERVICE_ACCOUNT_JSON secret is not configured");
  const account = JSON.parse(raw);
  if (!account.client_email || !account.private_key) throw new Error("Firebase service account JSON is incomplete");
  const now = Math.floor(Date.now() / 1000);
  const header = utf8b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = utf8b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Google OAuth token request failed: " + response.status);
  cachedFcmAccessToken = result.access_token;
  cachedFcmTokenExpiry = Date.now() + Number(result.expires_in || 3600) * 1000;
  return cachedFcmAccessToken;
}
async function sendFcm(token: string, title: string, body: string, order: any) {
  const accessToken = await getFcmAccessToken();
  const response = await fetch("https://fcm.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/messages:send", {
    method: "POST",
    headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        data: {
          title,
          body,
          tag: "camxd-admin-order-" + String(order.id),
          order_id: String(order.order_id || ""),
          customer_wa: String(order.customer_wa || ""),
          url: "https://vertifikasiakuncam-dotcom.github.io/camxd-store/admin.html?app=camxd-admin&order_id=" + encodeURIComponent(String(order.order_id || ""))
        },
        android: { priority: "HIGH" }
      }
    })
  });
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error("FCM HTTP " + response.status + ": " + text.slice(0, 300)), { status: response.status, responseBody: text });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-camxd-webhook-secret") !== WEBHOOK_SECRET)
    return new Response("Unauthorized", { status: 401 });

  try {
    const payload = await req.json();
    const order = payload.record || payload;
    const oldRecord = payload.old_record || payload.oldRecord || null;
    const eventType = String(payload.type || "INSERT").toUpperCase();
    if (!order?.id) return new Response("No order record", { status: 400 });

    const isPaymentReport = eventType === "UPDATE" &&
      Boolean(order.payment_proof_path) &&
      order.payment_proof_path !== oldRecord?.payment_proof_path;
    if (eventType === "UPDATE" && !isPaymentReport) {
      return Response.json({ ok: true, skipped: "not a new payment report" });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const productText = items.slice(0, 2).map((x: any) => x.name || "Produk").join(", ");
    const total = Number(order.total || 0).toLocaleString("id-ID");
    const title = isPaymentReport ? "CAMXD STORE • Laporan Pembayaran" : "CAMXD STORE • Pesanan Baru";
    const body = isPaymentReport
      ? "💳 Pelanggan " + (order.customer_name || "Pelanggan") + " melaporkan pembayaran • " + (order.order_id || "Order")
      : "🛒 " + (order.order_id || "Order") + " • " +
        (order.customer_name || "Pelanggan") + " • " + (productText || "Produk") + " • Rp " + total;
    const message = {
      title: isPaymentReport ? "CAMXD STORE • Laporan Pembayaran" : "CAMXD STORE",
      body: isPaymentReport
        ? body
        : "🛒 Pesanan Baru • " + (order.order_id || "Order") + "\n" +
          (order.customer_name || "Pelanggan") + " • " + productText + " • Rp " + total,
      tag: "camxd-order-" + String(order.id) + (isPaymentReport ? "-payment" : ""),
      url: "https://vertifikasiakuncam-dotcom.github.io/camxd-store/admin.html?app=camxd-admin&order_id=" + encodeURIComponent(String(order.order_id || ""))
    };

    // Admin notifications are intentionally APK-only. Keep in-page web dashboard alerts
    // handled by admin.js, but do not send OS Web Push when the admin tab is closed.
    const webpushResult = { disabled: true, reason: "APK-only notifications requested" };

    // Add native Firebase notifications for CAMXD Admin APK.
    const { data: tokens, error: tokenError } = await supabase.from("admin_fcm_tokens").select("id,token");
    if (tokenError) return Response.json({ ok: false, webpush: webpushResult, fcmError: "token lookup failed" }, { status: 500 });
    let fcmSent = 0, fcmFailed = 0, fcmRemoved = 0;
    for (const row of tokens || []) {
      try {
        await sendFcm(row.token, title, body, order);
        fcmSent++;
      } catch (err: any) {
        fcmFailed++;
        const responseBody = String(err?.responseBody || "");
        if (responseBody.includes("UNREGISTERED") || responseBody.includes("registration-token-not-registered")) {
          await supabase.from("admin_fcm_tokens").delete().eq("id", row.id);
          fcmRemoved++;
        } else {
          console.error("Admin FCM failed", row.id, String(err?.message || err).slice(0, 300));
        }
      }
    }
    return Response.json({
      ok: true,
      webpush: webpushResult,
      fcm: { tokens: (tokens || []).length, sent: fcmSent, failed: fcmFailed, removed: fcmRemoved }
    });
  } catch (error) {
    console.error("send-admin-order-push error", String(error));
    return new Response("Invalid payload", { status: 400 });
  }
});