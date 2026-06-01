// KADE system bot (@aiKADE_Bot) — the "BotFather" for KADE.
// Lets owners control everything from Telegram, and lets users link their account
// and check status. Uses KADE_SYSTEM_BOT_TOKEN. No per-user API key needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function send(token: string, chatId: number, text: string, replyTo?: number) {
  return tg(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown",
    reply_to_message_id: replyTo,
    disable_web_page_preview: true,
  });
}

const HELP = `*KADE — system bot*

Anyone:
/start — say hi
/link <code> — link your KADE account (get the code in your dashboard → Settings)
/status — your account & bots health
/mybots — list your bots
/help — this menu

Owner only:
/users — recent users
/allbots — every bot in the system
/activate <bot name> — turn a bot on
/pause <bot name> — pause a bot
/stats — system-wide counters
/broadcast <message> — send to every linked Telegram user`;

async function findUserByTelegram(supabase: any, tgUserId: number) {
  const { data } = await supabase
    .from("profiles")
    .select("id,email,display_name,telegram_user_id,telegram_username")
    .eq("telegram_user_id", tgUserId)
    .maybeSingle();
  return data;
}

async function isOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
  return !!data;
}

async function handleCommand(supabase: any, token: string, msg: any) {
  const chatId = msg.chat.id;
  const tgUserId = msg.from?.id as number;
  const tgUsername = msg.from?.username || null;
  const raw = (msg.text || "").trim();
  const [cmdRaw, ...rest] = raw.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const args = rest.join(" ").trim();

  const profile = tgUserId ? await findUserByTelegram(supabase, tgUserId) : null;
  const owner = profile ? await isOwner(supabase, profile.id) : false;

  if (cmd === "/start") {
    if (profile) {
      return send(token, chatId,
        `👋 Welcome back, *${profile.display_name || profile.email}*.\n\nYou're linked${owner ? " as *owner*" : ""}. Try /mybots or /status.\n\n${HELP}`);
    }
    return send(token, chatId,
      `👋 *KADE — Knowledge Acquisition & Dynamic Engagement*\n\nI'm the system bot for KADE. To control your KADE workspace from Telegram:\n\n1. Open your dashboard at https://kade-ai.vercel.app\n2. Go to *Settings → Telegram*\n3. Generate a link code and send it here:\n   \`/link YOUR_CODE\`\n\nNo account yet? Sign up first, then come back.`);
  }

  if (cmd === "/help") {
    return send(token, chatId, HELP);
  }

  if (cmd === "/link") {
    if (!args) return send(token, chatId, "Usage: `/link YOUR_CODE` — get a code from the web dashboard.");
    const code = args.trim().toUpperCase();
    const { data: row } = await supabase
      .from("telegram_link_codes")
      .select("*")
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!row) return send(token, chatId, "❌ That code is invalid or expired. Generate a new one in your dashboard.");

    // Link
    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ telegram_user_id: tgUserId, telegram_username: tgUsername })
      .eq("id", row.user_id);
    if (linkErr) return send(token, chatId, `❌ Linking failed: ${linkErr.message}`);

    await supabase.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
    return send(token, chatId, "✅ Account linked! Try /status or /mybots.");
  }

  if (!profile) {
    return send(token, chatId, "🔒 You're not linked yet. Send `/link YOUR_CODE` after generating one in your dashboard.");
  }

  if (cmd === "/status") {
    const { count: botCount } = await supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", profile.id);
    const { count: msgCount } = await supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", profile.id);
    return send(token, chatId,
      `*Status — ${profile.display_name || profile.email}*\n\n• Account: 🟢 linked${owner ? " (owner)" : ""}\n• Bots: ${botCount ?? 0}\n• Messages logged: ${msgCount ?? 0}\n• AI: 🟢 Lovable AI Gateway\n• Time: ${new Date().toUTCString()}`);
  }

  if (cmd === "/mybots") {
    const { data: bots } = await supabase.from("bots").select("name,status").eq("owner_id", profile.id).order("created_at", { ascending: false });
    if (!bots || bots.length === 0) return send(token, chatId, "You have no bots yet. Create one at https://kade-ai.vercel.app/dashboard/bots");
    const list = bots.map((b: any) => `• *${b.name}* — ${b.status === "active" ? "🟢" : "🟡"} ${b.status}`).join("\n");
    return send(token, chatId, `*Your bots*\n\n${list}`);
  }

  // --- Owner-only commands ---
  if (!owner) {
    return send(token, chatId, "🔒 That command is owner-only. Try /help to see what you can do.");
  }

  if (cmd === "/users") {
    const { data: users } = await supabase.from("profiles").select("display_name,email,created_at,telegram_username").order("created_at", { ascending: false }).limit(15);
    const list = (users || []).map((u: any) =>
      `• ${u.display_name || u.email} ${u.telegram_username ? `(@${u.telegram_username})` : ""} — ${new Date(u.created_at).toLocaleDateString()}`
    ).join("\n");
    return send(token, chatId, `*Recent users (${users?.length ?? 0})*\n\n${list || "—"}`);
  }

  if (cmd === "/allbots") {
    const { data: bots } = await supabase.from("bots").select("name,status,owner_id").order("created_at", { ascending: false }).limit(25);
    const list = (bots || []).map((b: any) => `• *${b.name}* — ${b.status === "active" ? "🟢" : "🟡"} ${b.status}`).join("\n");
    return send(token, chatId, `*All bots (${bots?.length ?? 0})*\n\n${list || "—"}`);
  }

  if (cmd === "/stats") {
    const [u, b, m, s] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "free"),
    ]);
    return send(token, chatId,
      `*KADE — system stats*\n\n• Users: ${u.count ?? 0}\n• Bots: ${b.count ?? 0}\n• Messages: ${m.count ?? 0}\n• Paying: ${s.count ?? 0}`);
  }

  if (cmd === "/activate" || cmd === "/pause") {
    if (!args) return send(token, chatId, `Usage: \`${cmd} <bot name>\``);
    const next = cmd === "/activate" ? "active" : "paused";
    const { data: hits } = await supabase.from("bots").select("id,name").ilike("name", args);
    if (!hits || hits.length === 0) return send(token, chatId, `No bot found named "${args}".`);
    if (hits.length > 1) return send(token, chatId, `Multiple matches — be more specific.`);
    await supabase.from("bots").update({ status: next }).eq("id", hits[0].id);
    return send(token, chatId, `✅ *${hits[0].name}* is now ${next === "active" ? "🟢 active" : "🟡 paused"}.`);
  }

  if (cmd === "/broadcast") {
    if (!args) return send(token, chatId, "Usage: `/broadcast Your message here`");
    const { data: targets } = await supabase.from("profiles").select("telegram_user_id").not("telegram_user_id", "is", null);
    let sent = 0;
    for (const t of targets || []) {
      try {
        await send(token, t.telegram_user_id, `📣 *Announcement from KADE*\n\n${args}`);
        sent++;
      } catch { /* ignore individual failures */ }
    }
    return send(token, chatId, `✅ Broadcast sent to ${sent} user(s).`);
  }

  return send(token, chatId, "Unknown command. Try /help.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("KADE_SYSTEM_BOT_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "KADE_SYSTEM_BOT_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Read offset
  const { data: state } = await supabase.from("system_bot_state").select("update_offset").eq("id", 1).maybeSingle();
  let offset = state?.update_offset || 0;
  const deadline = Date.now() + MAX_RUNTIME_MS;
  let processed = 0;

  while (Date.now() < deadline - 3000) {
    const remainingSec = Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 2);
    const timeout = Math.min(25, remainingSec);
    const updatesRes = await tg(token, "getUpdates", { offset, timeout, allowed_updates: ["message"] });
    if (!updatesRes.ok) {
      return new Response(JSON.stringify({ error: updatesRes.description }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const updates: any[] = updatesRes.result || [];
    if (updates.length === 0) break;

    for (const upd of updates) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg || !msg.text) continue;
      // System bot is command-only. Ignore any non-command text silently —
      // no chatbot/AI replies in DMs or groups. Use /help to see options.
      const text = msg.text.trim();
      if (!text.startsWith("/")) continue;
      try {
        await handleCommand(supabase, token, msg);
      } catch (e) {
        console.error("system bot error:", (e as Error).message);
      }
      processed++;
    }

    await supabase.from("system_bot_state").update({ update_offset: offset, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  return new Response(JSON.stringify({ ok: true, processed, offset }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
