// Telegram webhook receiver with per-bot signature verification + per-chat
// rate limiting. Verified updates are queued in `telegram_update_queue` for
// the worker to process. Invalid/abusive traffic is rejected with 401/429.
//
// Register per bot with Telegram:
//   POST https://api.telegram.org/bot<TOKEN>/setWebhook
//     url=https://<project>.functions.supabase.co/telegram-webhook?bot_id=<UUID>
//     secret_token=<bots.webhook_secret>
//     allowed_updates=["message","edited_message","callback_query"]

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

// In-memory sliding-window rate limiters. Survives within a warm instance;
// cold starts reset the windows — that's fine, Telegram retries on 5xx only.
type Bucket = { times: number[] };
const buckets = new Map<string, Bucket>();

// Hard caps. Telegram itself caps groups at ~20 msg/min from a bot, so these
// only fire on clearly abusive replay/spoofing attempts.
const LIMITS = {
  perChatWindowMs: 10_000, perChatMax: 30,   // 30 updates / 10s / chat
  perBotWindowMs:  60_000, perBotMax: 600,   // 600 updates / minute / bot
  globalWindowMs:  10_000, globalMax: 2000,  // safety net for the function
};

function hit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { times: [] };
  // drop expired
  while (b.times.length && b.times[0] <= now - windowMs) b.times.shift();
  if (b.times.length >= max) {
    buckets.set(key, b);
    return false;
  }
  b.times.push(now);
  buckets.set(key, b);
  return true;
}

// Constant-time string compare to defeat timing attacks on the secret header.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  // 0) Global safety net (per warm instance)
  if (!hit("global", LIMITS.globalWindowMs, LIMITS.globalMax)) {
    return json({ error: "rate limited" }, 429);
  }

  // 1) Identify the target bot via ?bot_id=
  const url = new URL(req.url);
  const botId = url.searchParams.get("bot_id");
  if (!botId || !/^[0-9a-f-]{36}$/i.test(botId)) {
    return json({ error: "invalid bot_id" }, 400);
  }

  // 2) Pull the expected secret from the DB (service role)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: bot, error: botErr } = await supabase
    .from("bots")
    .select("id, status, webhook_secret")
    .eq("id", botId)
    .maybeSingle();
  if (botErr || !bot) return json({ error: "unknown bot" }, 404);

  // 3) Verify Telegram's secret header (constant-time)
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!bot.webhook_secret || !safeEqual(provided, bot.webhook_secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  // 4) Per-bot rate limit (after auth so unauthenticated traffic can't poison it)
  if (!hit(`bot:${bot.id}`, LIMITS.perBotWindowMs, LIMITS.perBotMax)) {
    return json({ error: "rate limited" }, 429);
  }

  // 5) Parse + minimally validate update shape
  let update: any;
  try {
    update = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const updateId = Number(update?.update_id);
  if (!Number.isFinite(updateId)) return json({ error: "missing update_id" }, 400);

  const msg = update.message ?? update.edited_message ?? update.callback_query?.message;
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;

  // 6) Per-chat rate limit
  if (chatId && !hit(`chat:${bot.id}:${chatId}`, LIMITS.perChatWindowMs, LIMITS.perChatMax)) {
    // Acknowledge to Telegram so it stops retrying; just don't queue.
    return json({ ok: true, dropped: "chat_rate_limit" });
  }

  // 7) Paused bots: acknowledge but skip queueing
  if (bot.status !== "active") {
    return json({ ok: true, dropped: "bot_paused" });
  }

  // 8) Enqueue (idempotent on (bot_id, telegram_update_id))
  const { error: insErr } = await supabase
    .from("telegram_update_queue")
    .insert({
      bot_id: bot.id,
      telegram_update_id: updateId,
      chat_id: chatId,
      raw_update: update,
    });

  // Duplicate is fine (Telegram retried) — swallow unique violations.
  if (insErr && !/duplicate key|unique/i.test(insErr.message)) {
    console.error("queue insert failed:", insErr.message);
    return json({ error: "queue failed" }, 500);
  }

  return json({ ok: true });
});
