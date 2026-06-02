// Verifies Telegram WebApp initData and links the Telegram identity to the
// currently signed-in LaPoe user. Called from the Auth/Settings page when LaPoe
// is opened inside Telegram as a Mini App.
//
// Uses HMAC verification per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key as any, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyInitData(initData: string, botToken: string): Promise<{ valid: boolean; user?: any; auth_date?: number }> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { valid: false };
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const computed = toHex(await hmacSha256(secretKey, dataCheckString));
  if (computed !== hash) return { valid: false };
  const auth_date = Number(params.get("auth_date") || 0);
  if (!auth_date || Date.now() / 1000 - auth_date > 86400) return { valid: false };
  const userJson = params.get("user");
  if (!userJson) return { valid: false };
  return { valid: true, user: JSON.parse(userJson), auth_date };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { initData } = await req.json();
    if (!initData || typeof initData !== "string") {
      return new Response(JSON.stringify({ error: "initData required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("KADE_SYSTEM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "system bot not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const v = await verifyInitData(initData, botToken);
    if (!v.valid || !v.user) {
      return new Response(JSON.stringify({ error: "invalid Telegram signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("profiles").update({
      telegram_user_id: v.user.id,
      telegram_username: v.user.username || null,
      telegram_first_name: v.user.first_name || null,
      telegram_photo_url: v.user.photo_url || null,
    }).eq("id", u.user.id);

    return new Response(JSON.stringify({ ok: true, telegram: v.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
