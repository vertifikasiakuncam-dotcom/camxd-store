import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("CAMXD_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("CAMXD_VAPID_PRIVATE_KEY")!;
const FIREBASE_PROJECT_ID = "camxd-store";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

webpush.setVapidDetails(
  "https://vertifikasiakuncam-dotcom.github.io/camxd-store/",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

let cachedFcmAccessToken = "";
let cachedFcmTokenExpiry = 0;

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function utf8b64url(value: string) {
  return b64url(new TextEncoder().encode(value));
}
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
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  );
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

async function sendFcm(token: string, title: string, body: string, tag: string, orderId: string, customerWa: string) {
  const accessToken = await getFcmAccessToken();
  const response = await fetch(
    "https://fcm.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/messages:send",
    {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          data: {
            title,
            body,
            tag,
            image: "https://vertifikasiakuncam-dotcom.github.io/camxd-store/banner-notifikasi-camxd.png",
            url: "https://vertifikasiakuncam-dotcom.github.io/camxd-store/?order_id=" + encodeURIComponent(orderId) + "&customer_wa=" + encodeURIComponent(customerWa) + "#cek-pesanan",
            order_id: orderId,
            customer_wa: customerWa
          },
          android: { priority: "HIGH" }
        }
      })
    }
  );
  const responseBody = await response.text();
  if (!response.ok) throw Object.assign(new Error("FCM HTTP " + response.status + ": " + responseBody.slice(0, 300)), {
    status: response.status, responseBody
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { data: webhookSecret, error: secretError } = await supabase.rpc("camxd_get_webhook_secret");
  if (secretError || !webhookSecret) return new Response("Webhook authentication unavailable", { status: 500 });
  if (req.headers.get("x-camxd-webhook-secret") !== webhookSecret) return new Response("Unauthorized", { status: 401 });

  try {
    const payload = await req.json();
    const order = payload.record || payload;
    const oldRecord = payload.old_record || payload.oldRecord || null;
    if (!order?.id || !order?.order_id) return new Response("No order record", { status: 400 });
    const oldStatus = String(oldRecord?.status || payload.old_status || "");
    const status = String(order.status || "");
    if (oldStatus && oldStatus === status) return new Response(JSON.stringify({ skipped: "status unchanged" }), { status: 200 });

    const lower = status.toLowerCase();
    let body = "";
    if (lower.includes("selesai")) body = "Pesanan selesai! Buka CAMXD Store untuk melihat detail pesanan.";
    else if (lower.includes("batal")) body = "Pesanan dibatalkan. Hubungi admin CAMXD Store jika membutuhkan bantuan.";
    else if (lower.includes("verifikasi")) body = "Bukti pembayaran diterima. Pesanan menunggu verifikasi admin.";
    else if (lower.includes("sudah dibayar") || lower.includes("lunas")) body = "Pembayaran berhasil diverifikasi. Pesanan siap diproses.";
    else if (lower.includes("diproses") || lower.includes("proses")) body = "Pesananmu sedang diproses oleh admin CAMXD Store.";
    if (!body) return new Response(JSON.stringify({ skipped: "status not notified", status }), { status: 200, headers: { "Content-Type": "application/json" } });

    const title = "CAMXD STORE • " + status;
    const tag = "camxd-customer-order-" + String(order.id) + "-" + status.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const { data: rows, error } = await supabase.from("customer_push_subscriptions")
      .select("id,subscription").eq("order_row_id", order.id);
    if (error) return new Response("Subscription lookup failed", { status: 500 });

    let sent = 0, failed = 0, removed = 0;
    for (const row of rows || []) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title, body, tag, url: "./index.html?order_id=" + encodeURIComponent(String(order.order_id || "")) + "&customer_wa=" + encodeURIComponent(String(order.customer_wa || "")) + "#cek-pesanan"
        }), { TTL: 86400, urgency: "high" });
        sent++;
      } catch (err: any) {
        failed++;
        const code = err?.statusCode ?? null;
        if (code === 404 || code === 410) {
          await supabase.from("customer_push_subscriptions").delete().eq("id", row.id);
          removed++;
        } else {
          console.error("Customer push failed", row.id, code, String(err?.body || err?.message || "Unknown").slice(0, 200));
        }
      }
    }

    const { data: fcmRows, error: fcmLookupError } = await supabase.from("customer_fcm_tokens")
      .select("id,token").eq("order_row_id", order.id);
    if (fcmLookupError) {
      console.error("FCM token lookup failed", fcmLookupError.message);
      return new Response(JSON.stringify({ status, webpush: { subscriptions: (rows || []).length, sent, failed, removed }, fcmError: "token lookup failed" }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }

    let fcmSent = 0, fcmFailed = 0, fcmRemoved = 0;
    for (const row of fcmRows || []) {
      try {
        await sendFcm(row.token, title, body, tag, String(order.order_id || ""), String(order.customer_wa || ""));
        fcmSent++;
      } catch (err: any) {
        fcmFailed++;
        const text = String(err?.responseBody || err?.message || "");
        if (text.includes("UNREGISTERED") || text.includes("registration-token-not-registered") || text.includes("INVALID_ARGUMENT")) {
          await supabase.from("customer_fcm_tokens").delete().eq("id", row.id);
          fcmRemoved++;
        } else {
          console.error("Customer FCM failed", row.id, String(err?.message || err).slice(0, 300));
        }
      }
    }

    return new Response(JSON.stringify({
      status,
      webpush: { subscriptions: (rows || []).length, sent, failed, removed },
      fcm: { tokens: (fcmRows || []).length, sent: fcmSent, failed: fcmFailed, removed: fcmRemoved }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-customer-order-push error", String(error));
    return new Response("Invalid payload", { status: 400 });
  }
});