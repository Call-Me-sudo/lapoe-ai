// LaPoe system bot (@LaPoe_bot) — a general-purpose group bot (Rose-style)
// AND the control center for LaPoe accounts.
//
// Anyone can add @LaPoe_bot to their group and use it for moderation, welcomes,
// rules, filters, notes, warns, bans, etc. Linked LaPoe users can also manage
// their own bots from Telegram.
//
// Uses LAPOE_SYSTEM_BOT_TOKEN. No per-user API key required.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;
const FLOOD_WINDOW_SEC = 10;

// ---------- AI ----------
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3.5-flash";
const LAPOE_USERNAME = "lapoe_bot"; // for mention detection in groups
const aiBackoffUntil = { t: 0 };

const TONES: Record<string, string> = {
  friendly: "Warm, casual, like a helpful community member. Contractions OK. Short sentences.",
  professional: "Clear, courteous, business-appropriate. No emoji unless the user uses them first.",
  witty: "Dry, clever, a little playful. Keep it short.",
  strict: "Direct and rule-focused. Short. No padding.",
  hype: "High-energy community vibe. Some emoji OK. Never spammy.",
};

// Hidden self-knowledge injected into every system-bot prompt so it always
// knows what LaPoe is and never answers "I don't know" about itself.
const LAPOE_SELF_KB = `LaPoe is a no-code platform for running AI Telegram bots — it powers this assistant.
- Website: https://lapoe-ai.vercel.app
- Dashboard: https://lapoe-ai.vercel.app/dashboard
- Assistant dashboard: https://lapoe-ai.vercel.app/dashboard/assistant
- Bots dashboard: https://lapoe-ai.vercel.app/dashboard/bots
- Docs: https://lapoe-ai.vercel.app/docs
- Pricing: https://lapoe-ai.vercel.app/pricing
- Free plan: 1 group, 30 AI replies/month via this shared assistant @LaPoe_bot.
- Paid plans: connect your own Telegram bot tokens, more groups, higher quotas.
- Owners add knowledge (URLs, FAQs, pasted text) in the dashboard.
- Owners shape name, tone, personality, welcome and house rules in the dashboard.
- AI never runs in DMs — only in groups. DMs only handle /start /help /link /unlink /status /mybots /createbot /feedback /id /info.`;

function buildSystemBotPrompt(persona: any, knowledge: string, knowledgeExists: boolean, ownerName: string): string {
  const tone = TONES[persona?.tone] || TONES.friendly;
  const name = persona?.display_name || ownerName || "LaPoe";
  const character = persona?.personality ? `Character: ${persona.personality}\n` : "";
  const house = persona?.house_rules ? `\nHouse rules:\n${persona.house_rules}` : "";
  let kb = "";
  if (knowledge) {
    kb = `\n\n=== KNOWLEDGE BASE (authoritative) ===\n${knowledge}\n=== END ===\n\nGround factual answers in the knowledge above. If the question is outside it, say so honestly.`;
  } else if (knowledgeExists) {
    kb = `\n\nThe owner has a knowledge base but nothing matches. Say briefly that this isn't in your notes, offer what you can help with.`;
  }
  return `You are *${name}*, a personal assistant powered by LaPoe.

Tone: ${tone}
${character}${house}${kb}

=== ABOUT THE PLATFORM POWERING YOU (always available) ===
${LAPOE_SELF_KB}
=== END PLATFORM INFO ===
If asked "what are you", "who built you", "what platform", "how do I get one like you", or any meta question about yourself/the platform, answer from the PLATFORM INFO above. Never say "I don't know" about yourself.

RULES:
- Reply in the same language the user wrote in.
- Sound like a real person. Never say "as an AI".
- Keep replies under 4 short sentences unless asked for detail.
- NEVER invent URLs, prices, statistics, dates, or facts. If not in the knowledge or PLATFORM INFO above, omit it.
- The URLs inside PLATFORM INFO are pre-approved. When pointing users to the website, dashboard, assistant dashboard, bot setup, docs, or pricing, ALWAYS write the full URL as bare text (no markdown link, no trailing punctuation inside the URL). Never end a sentence with "at", "see the docs at", or "go to the website at" without the URL — either include the full URL or rewrite the sentence.
- Politely decline general-knowledge questions (politics, trivia, coding) unless covered above.
- Never apologize unprompted.

SIGNAL — for owner learning:
- If the user asked a substantive factual question that DESERVED a real answer, but you cannot answer it from the KNOWLEDGE BASE / house rules / PLATFORM INFO, append the EXACT token [NEEDS_KNOWLEDGE] on its own final line. Do NOT include it for greetings, small talk, or off-topic refusals.`;
}

async function askAI(system: string, userText: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  if (aiBackoffUntil.t > Date.now()) throw new Error("AI backoff");
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: userText }],
    }),
  });
  if (res.status === 429) { aiBackoffUntil.t = Date.now() + 30_000; throw new Error("rate limit"); }
  if (res.status === 402) { aiBackoffUntil.t = Date.now() + 60_000; throw new Error("credits exhausted"); }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "AI error");
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function ragForOwner(sb: any, ownerId: string, query: string, k = 5): Promise<{ text: string; exists: boolean }> {
  const { count } = await sb.from("knowledge_chunks").select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId).eq("scope", "system_bot");
  const exists = (count || 0) > 0;
  if (!exists) return { text: "", exists: false };
  const { data } = await sb.rpc("match_system_knowledge_text", {
    _owner_id: ownerId, _query: query, _match_count: k,
  });
  const text = (data || []).map((c: any, i: number) => `[${i + 1}] ${c.content}`).join("\n\n");
  return { text, exists };
}

async function ownerAiAllowed(sb: any, ownerId: string): Promise<{ allowed: boolean; used: number; cap: number; plan: string }> {
  const { data } = await sb.rpc("system_bot_usage", { _owner_id: ownerId });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!row?.allowed,
    used: row?.monthly_messages ?? 0,
    cap: row?.max_monthly_messages ?? 0,
    plan: row?.plan ?? "free",
  };
}

// ---------- Telegram helpers ----------
async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function send(token: string, chatId: number | string, text: string, replyTo?: number) {
  const res = await tg(token, "sendMessage", {
    chat_id: chatId, text, parse_mode: "Markdown",
    reply_to_message_id: replyTo,
    disable_web_page_preview: true,
  });
  // Telegram rejects messages with unmatched Markdown entities (common with
  // underscores in bot/user names). Fall back to plain text so commands like
  // /mybots, /status still produce a visible reply instead of silently failing.
  if (res && res.ok === false) {
    return tg(token, "sendMessage", {
      chat_id: chatId, text,
      reply_to_message_id: replyTo,
      disable_web_page_preview: true,
    });
  }
  return res;
}
async function isChatAdmin(token: string, chatId: number, userId: number): Promise<boolean> {
  const r = await tg(token, "getChatMember", { chat_id: chatId, user_id: userId });
  if (!r.ok) return false;
  const status = r.result?.status;
  return status === "creator" || status === "administrator";
}
function nameOf(user: any) {
  if (!user) return "user";
  return user.username ? `@${user.username}` : (user.first_name || `id:${user.id}`);
}
function mention(user: any) {
  if (!user) return "user";
  const name = (user.first_name || user.username || "user").replace(/[\[\]_*`]/g, "");
  return `[${name}](tg://user?id=${user.id})`;
}

// ---------- Constants ----------
const HELP_PUBLIC = `*LaPoe — your all-in-one group bot* 🛡️

*Add me to your group, promote me as admin*, and I'll handle moderation, welcomes, rules, filters, and more.

*Anyone:*
/start · /help · /rules · /id · /info · /report

*Account & your own bots:*
/link \`<code>\` — link your LaPoe account
/unlink — unlink
/status · /mybots · /createbot

*Group admins (in a group):*
/setrules · /setwelcome · /setgoodbye · /setlang
/warn · /unwarn · /warns · /resetwarns · /setwarnlimit \`<n>\`
/ban · /unban · /kick · /mute · /unmute
/promote · /demote · /pin · /unpin · /purge
/lock · /unlock · /antiflood on|off · /moderation on|off
/filter \`<word>\` \`<reply>\` · /stop \`<word>\` · /filters
/addnote \`<name>\` \`<text>\` · /clearnote \`<name>\` · /notes · /get \`<name>\` · #name
/banword \`<word>\` · /unbanword \`<word>\` · /banwords

Hosted at https://lapoe-ai.vercel.app`;

const HELP_OWNER = `\n*LaPoe owners (you):*
/users · /allbots · /allgroups · /stats · /broadcast \`<msg>\`
/activate \`<bot>\` · /pause \`<bot>\``;

// ---------- DB helpers ----------
async function getProfile(sb: any, tgUserId: number) {
  const { data } = await sb.from("profiles")
    .select("id,email,display_name,telegram_username")
    .eq("telegram_user_id", tgUserId).maybeSingle();
  return data;
}
async function isOwner(sb: any, userId: string) {
  const { data } = await sb.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "owner").maybeSingle();
  return !!data;
}
async function ensureGroup(sb: any, chat: any, addedBy?: number) {
  await sb.from("system_bot_groups").upsert({
    chat_id: chat.id,
    title: chat.title || chat.username || `chat:${chat.id}`,
    type: chat.type,
    added_by_tg: addedBy ?? null,
    is_active: true,
  }, { onConflict: "chat_id" });
  if (addedBy) {
    const profile = await getProfile(sb, addedBy);
    if (profile?.id) {
      await sb.from("system_bot_groups")
        .update({ linked_owner_id: profile.id, updated_at: new Date().toISOString() })
        .eq("chat_id", chat.id)
        .is("linked_owner_id", null);
    }
  }
}
async function getGroup(sb: any, chatId: number) {
  const { data } = await sb.from("system_bot_groups").select("*").eq("chat_id", chatId).maybeSingle();
  return data;
}
async function modLog(sb: any, chatId: number, action: string, target: any, by: number, reason?: string) {
  await sb.from("system_bot_mod_log").insert({
    chat_id: chatId, action,
    target_user_id: target?.id ?? null,
    target_username: target?.username || target?.first_name || null,
    performed_by: by, reason: reason ?? null,
  });
}

// ---------- Anti-flood / moderation passes (non-command messages) ----------
async function runGroupChecks(sb: any, token: string, msg: any) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return false;

  // Skip admins
  const isAdmin = await isChatAdmin(token, chatId, userId);
  if (isAdmin) return false;

  const group = await getGroup(sb, chatId);
  if (!group) return false;

  const text: string = (msg.text || msg.caption || "").toLowerCase();

  // Banned word check
  if (group.moderation_enabled && Array.isArray(group.banned_words) && group.banned_words.length > 0) {
    const hit = group.banned_words.find((w: string) => w && text.includes(w.toLowerCase()));
    if (hit) {
      await tg(token, "deleteMessage", { chat_id: chatId, message_id: msg.message_id });
      await send(token, chatId, `🚫 ${mention(msg.from)} — message removed (banned word).`);
      await modLog(sb, chatId, "delete_banned_word", msg.from, 0, hit);
      return true;
    }
  }

  // Anti-flood
  if (group.anti_flood_enabled) {
    const limit = group.flood_limit || 8;
    const { data: row } = await sb.from("system_bot_flood")
      .select("count,window_start")
      .eq("chat_id", chatId).eq("user_id", userId).maybeSingle();
    const now = new Date();
    if (!row || (now.getTime() - new Date(row.window_start).getTime()) / 1000 > FLOOD_WINDOW_SEC) {
      await sb.from("system_bot_flood").upsert({
        chat_id: chatId, user_id: userId, window_start: now.toISOString(), count: 1,
      }, { onConflict: "chat_id,user_id" });
    } else {
      const nextCount = (row.count || 0) + 1;
      await sb.from("system_bot_flood").update({ count: nextCount })
        .eq("chat_id", chatId).eq("user_id", userId);
      if (nextCount > limit) {
        await tg(token, "restrictChatMember", {
          chat_id: chatId, user_id: userId,
          permissions: { can_send_messages: false },
          until_date: Math.floor(Date.now() / 1000) + 60,
        });
        await send(token, chatId, `🌊 ${mention(msg.from)} muted for 60s — flooding.`);
        await modLog(sb, chatId, "mute_flood", msg.from, 0, `${nextCount} msgs in ${FLOOD_WINDOW_SEC}s`);
        return true;
      }
    }
  }

  // Filter triggers
  const { data: filters } = await sb.from("system_bot_filters")
    .select("keyword,reply").eq("chat_id", chatId);
  if (filters && filters.length) {
    for (const f of filters) {
      if (text.includes(f.keyword.toLowerCase())) {
        await send(token, chatId, f.reply, msg.message_id);
        break;
      }
    }
  }

  // #note recall
  if (msg.text && msg.text.startsWith("#")) {
    const name = msg.text.slice(1).trim().split(/\s+/)[0].toLowerCase();
    if (name) {
      const { data: note } = await sb.from("system_bot_notes")
        .select("content").eq("chat_id", chatId).eq("name", name).maybeSingle();
      if (note) await send(token, chatId, note.content, msg.message_id);
    }
  }
  return false;
}

// ---------- Command router ----------
async function handleCommand(sb: any, token: string, msg: any) {
  const chat = msg.chat;
  const chatId = chat.id;
  const isGroup = chat.type === "group" || chat.type === "supergroup";
  const fromId = msg.from?.id as number;
  const raw = (msg.text || "").trim();
  const [cmdRaw, ...rest] = raw.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const args = rest.join(" ").trim();
  const reply = msg.reply_to_message;
  const target = reply?.from;

  if (isGroup) await ensureGroup(sb, chat, fromId);

  const profile = fromId ? await getProfile(sb, fromId) : null;
  const owner = profile ? await isOwner(sb, profile.id) : false;
  const chatAdmin = isGroup ? await isChatAdmin(token, chatId, fromId) : true;

  // Auto-claim unclaimed group for the linked user who interacts with the bot.
  if (isGroup && profile) {
    const { data: g } = await sb.from("system_bot_groups").select("linked_owner_id").eq("chat_id", chatId).maybeSingle();
    if (g && !g.linked_owner_id) {
      await sb.from("system_bot_groups").update({ linked_owner_id: profile.id }).eq("chat_id", chatId);
    }
  }

  const need = (cond: boolean, m: string) => cond ? null : send(token, chatId, m, msg.message_id);

  // ===== Universal =====
  if (cmd === "/start" || cmd === "/help") {
    const help = HELP_PUBLIC + (owner ? HELP_OWNER : "");
    if (!isGroup && !profile) {
      return send(token, chatId,
        `👋 *Welcome to LaPoe!*\n\nI'm a general-purpose group bot (moderation, welcomes, rules, filters, notes) *and* the control center for your own LaPoe bots.\n\n*Add me to your group* and promote me as admin, then use /help inside the group.\n\n*To link your LaPoe account:*\n1. Open https://lapoe-ai.vercel.app\n2. Sign up / sign in → *Settings → Telegram*\n3. Generate a code and send: \`/link YOUR_CODE\`\n\n${help}`);
    }
    return send(token, chatId, help);
  }

  if (cmd === "/id") {
    const u = reply?.from || msg.from;
    return send(token, chatId, `🆔 user: \`${u.id}\`\n💬 chat: \`${chatId}\``, msg.message_id);
  }

  if (cmd === "/info") {
    const u = reply?.from || msg.from;
    return send(token, chatId,
      `*User info*\n• Name: ${nameOf(u)}\n• ID: \`${u.id}\`\n• Username: ${u.username ? "@" + u.username : "—"}\n• Bot: ${u.is_bot ? "yes" : "no"}`, msg.message_id);
  }

  if (cmd === "/createbot") {
    return send(token, chatId,
      `🤖 *Create your own bot in LaPoe*\n\n1. Talk to @BotFather and create a Telegram bot → copy the token\n2. Open https://lapoe-ai.vercel.app/dashboard/bots\n3. Click *New bot*, paste the token, add knowledge\n4. Your bot will reply in any group it's added to\n\nNeed to link this Telegram account first? Use /link.`);
  }

  // ===== Account linking =====
  if (cmd === "/link") {
    if (!args) return send(token, chatId, "Usage: `/link YOUR_CODE` — generate one in your dashboard → Settings.", msg.message_id);
    const code = args.trim().toUpperCase();
    const { data: row } = await sb.from("telegram_link_codes")
      .select("*").eq("code", code).is("used_at", null)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!row) return send(token, chatId, "❌ That code is invalid or expired.", msg.message_id);
    const { error } = await sb.from("profiles").update({
      telegram_user_id: fromId,
      telegram_username: msg.from?.username || null,
      telegram_first_name: msg.from?.first_name || null,
    }).eq("id", row.user_id);
    if (error) return send(token, chatId, `❌ ${error.message}`, msg.message_id);
    await sb.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);

    // Auto-claim this group for the linked user (so AI replies use their persona/knowledge).
    if (isGroup) {
      await sb.from("system_bot_groups").update({ linked_owner_id: row.user_id }).eq("chat_id", chatId);
    }

    // One-time welcome DM with onboarding instructions. We DM the linking
    // Telegram user directly (fromId == their telegram_user_id) regardless of
    // where /link was issued. Plain static text — no AI in DMs.
    const welcome = `🎉 *Connected!* You're now linked to LaPoe.\n\nI'm @LaPoe_bot — your free AI assistant in *your group*. Here's how to make me yours:\n\n*1. Set my voice*\n→ https://lapoe-ai.vercel.app/dashboard/assistant\n   Pick a name, tone, personality and house rules.\n\n*2. Feed me knowledge*\n→ https://lapoe-ai.vercel.app/dashboard/knowledge\n   Add docs, FAQs, links. I'll ground every answer in them.\n\n*3. Add me to your group*\n   Promote me as admin, then chat normally — I'll reply using your persona & knowledge (30 AI replies/month on Free).\n\nNote: I don't chat in DMs. Use /help here for commands, or talk to me in your group.`;
    try { await send(token, fromId, welcome); } catch {}

    return send(token, chatId, isGroup
      ? "✅ Account linked — this group is now powered by *your* AI persona. Just chat normally and I'll reply using your knowledge. (Check your DM for setup steps.)"
      : "✅ Account linked! Check the welcome message above for next steps.",
      msg.message_id);
  }


  if (cmd === "/unlink") {
    if (!profile) return send(token, chatId, "You're not linked.", msg.message_id);
    await sb.from("profiles").update({ telegram_user_id: null, telegram_username: null }).eq("id", profile.id);
    return send(token, chatId, "✅ Unlinked.", msg.message_id);
  }

  if (cmd === "/status") {
    if (!profile) return send(token, chatId, "🔒 Not linked. Send `/link YOUR_CODE` first.", msg.message_id);
    const { count: botCount } = await sb.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", profile.id);
    const { count: msgCount } = await sb.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", profile.id);
    return send(token, chatId,
      `*Status — ${profile.display_name || profile.email}*\n• Account: 🟢 linked${owner ? " (owner)" : ""}\n• Bots: ${botCount ?? 0}\n• Messages: ${msgCount ?? 0}`, msg.message_id);
  }

  if (cmd === "/mybots") {
    if (!profile) return send(token, chatId, "🔒 Not linked. Use `/link YOUR_CODE`.", msg.message_id);
    const { data: bots } = await sb.from("bots").select("name,status,bot_username").eq("owner_id", profile.id);
    if (!bots?.length) return send(token, chatId, "No bots yet. /createbot to start.", msg.message_id);
    return send(token, chatId, "*Your bots*\n\n" + bots.map((b: any) =>
      `• *${b.name}*${b.bot_username ? " (@" + b.bot_username + ")" : ""} — ${b.status === "active" ? "🟢" : "🟡"} ${b.status}`).join("\n"), msg.message_id);
  }

  // ===== Group-only =====
  if (!isGroup) {
    if (cmd === "/rules" || cmd === "/setrules" || cmd === "/setwelcome" || cmd === "/setgoodbye" ||
        cmd === "/warn" || cmd === "/ban" || cmd === "/kick" || cmd === "/mute" || cmd === "/unmute" ||
        cmd === "/filter" || cmd === "/stop" || cmd === "/notes" || cmd === "/filters" ||
        cmd === "/banword" || cmd === "/unbanword" || cmd === "/banwords" ||
        cmd === "/promote" || cmd === "/demote" || cmd === "/pin" || cmd === "/unpin" || cmd === "/purge" ||
        cmd === "/lock" || cmd === "/unlock" || cmd === "/antiflood" || cmd === "/moderation" ||
        cmd === "/setwarnlimit" || cmd === "/resetwarns" || cmd === "/warns" ||
        cmd === "/addnote" || cmd === "/clearnote" || cmd === "/get" || cmd === "/setlang") {
      return send(token, chatId, "That command works inside a group. Add me to your group and promote me as admin.");
    }
  }

  if (isGroup) {
    const group = await getGroup(sb, chatId);

    if (cmd === "/rules") {
      return send(token, chatId, group?.rules ? `📜 *Rules*\n\n${group.rules}` : "No rules set. An admin can use /setrules.", msg.message_id);
    }

    if (cmd === "/report") {
      const r = await tg(token, "getChatAdministrators", { chat_id: chatId });
      const admins = (r.result || []).filter((a: any) => !a.user.is_bot).map((a: any) => mention(a.user)).join(" ");
      return send(token, chatId, `🚨 Report sent to: ${admins || "admins"}`, reply?.message_id || msg.message_id);
    }

    if (cmd === "/get") {
      const name = args.trim().toLowerCase();
      if (!name) return send(token, chatId, "Usage: `/get name`", msg.message_id);
      const { data: note } = await sb.from("system_bot_notes").select("content").eq("chat_id", chatId).eq("name", name).maybeSingle();
      return send(token, chatId, note ? note.content : `No note named \`${name}\`.`, msg.message_id);
    }
    if (cmd === "/notes") {
      const { data: notes } = await sb.from("system_bot_notes").select("name").eq("chat_id", chatId);
      return send(token, chatId, notes?.length ? "*Notes:*\n" + notes.map((n: any) => `• #${n.name}`).join("\n") : "No notes yet.", msg.message_id);
    }
    if (cmd === "/filters") {
      const { data: f } = await sb.from("system_bot_filters").select("keyword").eq("chat_id", chatId);
      return send(token, chatId, f?.length ? "*Filters:*\n" + f.map((x: any) => `• ${x.keyword}`).join("\n") : "No filters set.", msg.message_id);
    }
    if (cmd === "/banwords") {
      return send(token, chatId, group?.banned_words?.length ? "*Banned words:*\n" + group.banned_words.map((w: string) => `• ${w}`).join("\n") : "No banned words.", msg.message_id);
    }
    if (cmd === "/warns") {
      const uid = (reply?.from?.id) || fromId;
      const { data } = await sb.from("system_bot_warnings").select("reason,created_at").eq("chat_id", chatId).eq("user_id", uid).order("created_at", { ascending: false });
      const cnt = data?.length || 0;
      const limit = group?.warn_limit || 3;
      return send(token, chatId, `⚠️ ${mention(reply?.from || msg.from)} — ${cnt}/${limit} warnings.${data?.length ? "\n\nRecent: " + data.slice(0, 3).map((w: any) => w.reason || "—").join("; ") : ""}`, msg.message_id);
    }

    // --- Admin-only commands below ---
    const adminOnly = ["/setrules","/setwelcome","/setgoodbye","/setlang","/setwarnlimit","/resetwarns",
      "/warn","/unwarn","/ban","/unban","/kick","/mute","/unmute","/promote","/demote",
      "/pin","/unpin","/purge","/lock","/unlock","/antiflood","/moderation",
      "/filter","/stop","/addnote","/clearnote","/banword","/unbanword"];
    if (adminOnly.includes(cmd)) {
      if (!chatAdmin) return send(token, chatId, "🔒 That command is for group admins only.", msg.message_id);
    }

    if (cmd === "/setrules") {
      await sb.from("system_bot_groups").update({ rules: args || null }).eq("chat_id", chatId);
      return send(token, chatId, args ? "✅ Rules saved." : "✅ Rules cleared.", msg.message_id);
    }
    if (cmd === "/setwelcome") {
      await sb.from("system_bot_groups").update({ welcome_message: args || null }).eq("chat_id", chatId);
      return send(token, chatId, args ? "✅ Welcome message saved. Use {name} for the new member's name." : "✅ Welcome cleared.", msg.message_id);
    }
    if (cmd === "/setgoodbye") {
      await sb.from("system_bot_groups").update({ goodbye_message: args || null }).eq("chat_id", chatId);
      return send(token, chatId, "✅ Goodbye saved.", msg.message_id);
    }
    if (cmd === "/setlang") {
      await sb.from("system_bot_groups").update({ language: (args || "en").toLowerCase().slice(0, 8) }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Language set to ${args || "en"}.`, msg.message_id);
    }
    if (cmd === "/setwarnlimit") {
      const n = parseInt(args, 10);
      if (!n || n < 1) return send(token, chatId, "Usage: `/setwarnlimit 3`", msg.message_id);
      await sb.from("system_bot_groups").update({ warn_limit: n }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Warn limit set to ${n}.`, msg.message_id);
    }
    if (cmd === "/antiflood") {
      const on = args.toLowerCase() === "on";
      await sb.from("system_bot_groups").update({ anti_flood_enabled: on }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Anti-flood ${on ? "enabled" : "disabled"}.`, msg.message_id);
    }
    if (cmd === "/moderation") {
      const on = args.toLowerCase() === "on";
      await sb.from("system_bot_groups").update({ moderation_enabled: on }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Moderation ${on ? "enabled" : "disabled"}.`, msg.message_id);
    }

    if (cmd === "/banword") {
      const w = args.trim().toLowerCase();
      if (!w) return send(token, chatId, "Usage: `/banword word`", msg.message_id);
      const next = Array.from(new Set([...(group?.banned_words || []), w]));
      await sb.from("system_bot_groups").update({ banned_words: next }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Added \`${w}\``, msg.message_id);
    }
    if (cmd === "/unbanword") {
      const w = args.trim().toLowerCase();
      const next = (group?.banned_words || []).filter((x: string) => x !== w);
      await sb.from("system_bot_groups").update({ banned_words: next }).eq("chat_id", chatId);
      return send(token, chatId, `✅ Removed \`${w}\``, msg.message_id);
    }

    if (cmd === "/filter") {
      const [kw, ...rep] = args.split(/\s+/);
      const replyText = rep.join(" ").trim();
      if (!kw || !replyText) return send(token, chatId, "Usage: `/filter keyword reply text`", msg.message_id);
      await sb.from("system_bot_filters").upsert({
        chat_id: chatId, keyword: kw.toLowerCase(), reply: replyText, created_by: fromId,
      }, { onConflict: "chat_id,keyword" });
      return send(token, chatId, `✅ Filter \`${kw}\` saved.`, msg.message_id);
    }
    if (cmd === "/stop") {
      await sb.from("system_bot_filters").delete().eq("chat_id", chatId).eq("keyword", args.trim().toLowerCase());
      return send(token, chatId, "✅ Filter removed.", msg.message_id);
    }
    if (cmd === "/addnote") {
      const [nm, ...nrest] = args.split(/\s+/);
      const content = nrest.join(" ").trim() || reply?.text || "";
      if (!nm || !content) return send(token, chatId, "Usage: `/addnote name text` (or reply with text)", msg.message_id);
      await sb.from("system_bot_notes").upsert({
        chat_id: chatId, name: nm.toLowerCase(), content, created_by: fromId,
      }, { onConflict: "chat_id,name" });
      return send(token, chatId, `✅ Note #${nm} saved.`, msg.message_id);
    }
    if (cmd === "/clearnote") {
      await sb.from("system_bot_notes").delete().eq("chat_id", chatId).eq("name", args.trim().toLowerCase());
      return send(token, chatId, "✅ Note cleared.", msg.message_id);
    }

    // --- Member actions ---
    if (cmd === "/warn") {
      if (!target) return send(token, chatId, "Reply to a user to warn them.", msg.message_id);
      await sb.from("system_bot_warnings").insert({
        chat_id: chatId, user_id: target.id, username: target.username, reason: args || null, issued_by: fromId,
      });
      const { count } = await sb.from("system_bot_warnings").select("id", { count: "exact", head: true }).eq("chat_id", chatId).eq("user_id", target.id);
      const limit = group?.warn_limit || 3;
      await modLog(sb, chatId, "warn", target, fromId, args);
      if ((count || 0) >= limit) {
        await tg(token, "banChatMember", { chat_id: chatId, user_id: target.id });
        await modLog(sb, chatId, "auto_ban_warn_limit", target, fromId);
        return send(token, chatId, `🔨 ${mention(target)} hit ${limit} warnings — banned.`, msg.message_id);
      }
      return send(token, chatId, `⚠️ ${mention(target)} warned (${count}/${limit}).${args ? " Reason: " + args : ""}`, msg.message_id);
    }
    if (cmd === "/unwarn") {
      if (!target) return send(token, chatId, "Reply to a user.", msg.message_id);
      const { data: last } = await sb.from("system_bot_warnings").select("id").eq("chat_id", chatId).eq("user_id", target.id).order("created_at", { ascending: false }).limit(1);
      if (last?.[0]) await sb.from("system_bot_warnings").delete().eq("id", last[0].id);
      return send(token, chatId, `✅ Removed one warning from ${mention(target)}.`, msg.message_id);
    }
    if (cmd === "/resetwarns") {
      if (!target) return send(token, chatId, "Reply to a user.", msg.message_id);
      await sb.from("system_bot_warnings").delete().eq("chat_id", chatId).eq("user_id", target.id);
      return send(token, chatId, `✅ Warnings reset for ${mention(target)}.`, msg.message_id);
    }

    if (cmd === "/ban") {
      if (!target) return send(token, chatId, "Reply to the user you want to ban.", msg.message_id);
      const r = await tg(token, "banChatMember", { chat_id: chatId, user_id: target.id });
      await modLog(sb, chatId, "ban", target, fromId, args);
      return send(token, chatId, r.ok ? `🔨 Banned ${mention(target)}.` : `❌ ${r.description}`, msg.message_id);
    }
    if (cmd === "/unban") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      await tg(token, "unbanChatMember", { chat_id: chatId, user_id: target.id, only_if_banned: true });
      return send(token, chatId, `✅ Unbanned ${mention(target)}.`, msg.message_id);
    }
    if (cmd === "/kick") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      await tg(token, "banChatMember", { chat_id: chatId, user_id: target.id });
      await tg(token, "unbanChatMember", { chat_id: chatId, user_id: target.id });
      await modLog(sb, chatId, "kick", target, fromId, args);
      return send(token, chatId, `👢 Kicked ${mention(target)}.`, msg.message_id);
    }
    if (cmd === "/mute") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: target.id,
        permissions: { can_send_messages: false },
      });
      await modLog(sb, chatId, "mute", target, fromId, args);
      return send(token, chatId, `🔇 Muted ${mention(target)}.`, msg.message_id);
    }
    if (cmd === "/unmute") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: target.id,
        permissions: { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true },
      });
      return send(token, chatId, `🔈 Unmuted ${mention(target)}.`, msg.message_id);
    }
    if (cmd === "/promote") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      const r = await tg(token, "promoteChatMember", {
        chat_id: chatId, user_id: target.id,
        can_manage_chat: true, can_delete_messages: true, can_restrict_members: true,
        can_pin_messages: true, can_invite_users: true,
      });
      return send(token, chatId, r.ok ? `⬆️ Promoted ${mention(target)}.` : `❌ ${r.description}`, msg.message_id);
    }
    if (cmd === "/demote") {
      if (!target) return send(token, chatId, "Reply to the user.", msg.message_id);
      const r = await tg(token, "promoteChatMember", {
        chat_id: chatId, user_id: target.id,
        can_manage_chat: false, can_delete_messages: false, can_restrict_members: false,
        can_pin_messages: false, can_invite_users: false, can_promote_members: false,
      });
      return send(token, chatId, r.ok ? `⬇️ Demoted ${mention(target)}.` : `❌ ${r.description}`, msg.message_id);
    }
    if (cmd === "/pin") {
      if (!reply) return send(token, chatId, "Reply to the message you want to pin.", msg.message_id);
      await tg(token, "pinChatMessage", { chat_id: chatId, message_id: reply.message_id });
      return send(token, chatId, "📌 Pinned.", msg.message_id);
    }
    if (cmd === "/unpin") {
      await tg(token, "unpinChatMessage", { chat_id: chatId });
      return send(token, chatId, "📍 Unpinned.", msg.message_id);
    }
    if (cmd === "/purge") {
      if (!reply) return send(token, chatId, "Reply to the first message to purge from.", msg.message_id);
      const from = reply.message_id; const to = msg.message_id;
      for (let i = from; i <= to; i++) {
        try { await tg(token, "deleteMessage", { chat_id: chatId, message_id: i }); } catch {}
      }
      return;
    }
    if (cmd === "/lock") {
      await tg(token, "setChatPermissions", { chat_id: chatId, permissions: { can_send_messages: false } });
      return send(token, chatId, "🔒 Chat locked.", msg.message_id);
    }
    if (cmd === "/unlock") {
      await tg(token, "setChatPermissions", { chat_id: chatId, permissions: { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true } });
      return send(token, chatId, "🔓 Chat unlocked.", msg.message_id);
    }
  }

  // ===== Owner-only (LaPoe owners) =====
  const ownerOnly = ["/users","/allbots","/allgroups","/stats","/broadcast","/activate","/pause"];
  if (ownerOnly.includes(cmd)) {
    if (!owner) return send(token, chatId, "🔒 Owner-only.", msg.message_id);

    if (cmd === "/users") {
      const { data: users } = await sb.from("profiles").select("display_name,email,telegram_username,created_at").order("created_at", { ascending: false }).limit(20);
      return send(token, chatId, `*Recent users (${users?.length ?? 0})*\n\n` + (users || []).map((u: any) =>
        `• ${u.display_name || u.email}${u.telegram_username ? " (@" + u.telegram_username + ")" : ""}`).join("\n"));
    }
    if (cmd === "/allbots") {
      const { data: bots } = await sb.from("bots").select("name,status,bot_username").order("created_at", { ascending: false }).limit(30);
      return send(token, chatId, `*All bots (${bots?.length ?? 0})*\n\n` + (bots || []).map((b: any) =>
        `• *${b.name}*${b.bot_username ? " (@" + b.bot_username + ")" : ""} — ${b.status}`).join("\n"));
    }
    if (cmd === "/allgroups") {
      const { data: gs } = await sb.from("system_bot_groups").select("title,chat_id,type").order("created_at", { ascending: false }).limit(40);
      return send(token, chatId, `*System bot groups (${gs?.length ?? 0})*\n\n` + (gs || []).map((g: any) =>
        `• ${g.title} (${g.type}) — \`${g.chat_id}\``).join("\n"));
    }
    if (cmd === "/stats") {
      const [u, b, m, g] = await Promise.all([
        sb.from("profiles").select("id", { count: "exact", head: true }),
        sb.from("bots").select("id", { count: "exact", head: true }),
        sb.from("bot_messages").select("id", { count: "exact", head: true }),
        sb.from("system_bot_groups").select("chat_id", { count: "exact", head: true }),
      ]);
      return send(token, chatId, `*LaPoe stats*\n• Users: ${u.count ?? 0}\n• User bots: ${b.count ?? 0}\n• Messages: ${m.count ?? 0}\n• System bot groups: ${g.count ?? 0}`);
    }
    if (cmd === "/broadcast") {
      if (!args) return send(token, chatId, "Usage: `/broadcast message`", msg.message_id);
      const { data: targets } = await sb.from("profiles").select("telegram_user_id").not("telegram_user_id", "is", null);
      let n = 0;
      for (const t of targets || []) {
        try { await send(token, t.telegram_user_id, `📣 *LaPoe*\n\n${args}`); n++; } catch {}
      }
      return send(token, chatId, `✅ Sent to ${n}.`);
    }
    if (cmd === "/activate" || cmd === "/pause") {
      const next = cmd === "/activate" ? "active" : "paused";
      const { data: hits } = await sb.from("bots").select("id,name").ilike("name", args);
      if (!hits?.length) return send(token, chatId, `No bot named "${args}".`, msg.message_id);
      if (hits.length > 1) return send(token, chatId, "Multiple matches — be specific.", msg.message_id);
      await sb.from("bots").update({ status: next }).eq("id", hits[0].id);
      return send(token, chatId, `✅ *${hits[0].name}* → ${next}.`);
    }
  }

  if (raw.startsWith("/")) {
    return send(token, chatId, "Unknown command. Try /help.", msg.message_id);
  }
}

// ---------- Membership events ----------
async function handleMembership(sb: any, token: string, msg: any) {
  const chat = msg.chat;
  await ensureGroup(sb, chat, msg.from?.id);
  const group = await getGroup(sb, chat.id);

  // New members
  if (msg.new_chat_members?.length) {
    for (const m of msg.new_chat_members) {
      if (m.is_bot && m.username && m.username.toLowerCase() === "lapoe_bot") {
        await send(token, chat.id, `👋 Thanks for adding me!\n\nPromote me as admin and run /help to see what I can do. I handle welcomes, rules, warns, bans, filters, notes, anti-flood and more.\n\nLearn more: https://lapoe-ai.vercel.app`);
        continue;
      }
      if (group?.welcome_message) {
        const text = group.welcome_message
          .replace(/\{name\}/gi, m.first_name || "friend")
          .replace(/\{mention\}/gi, mention(m))
          .replace(/\{group\}/gi, chat.title || "");
        await send(token, chat.id, text);
      }
    }
  }
  // Left member
  if (msg.left_chat_member && group?.goodbye_message) {
    const u = msg.left_chat_member;
    await send(token, chat.id, group.goodbye_message.replace(/\{name\}/gi, u.first_name || "friend"));
  }
}

// ---------- Webhook (fast path) ----------
// Telegram pushes each update here within ms of the user sending it.
// We process inline and return 200 immediately — no cron delay, no long polling.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/lapoe-system-bot`;

// Derive a stable per-bot secret_token from the bot's API token. Both this
// function and the setWebhook call compute it the same way.
async function webhookSecret(token: string): Promise<string> {
  const data = new TextEncoder().encode(`lapoe-system-bot:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function safeEqual(a: string | null, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function ensureWebhook(token: string): Promise<{ ok: boolean; info?: any }> {
  const secret = await webhookSecret(token);
  const info = await tg(token, "getWebhookInfo", {});
  const current = info?.result?.url;
  // Already registered to the right URL — skip the round-trip.
  if (current === WEBHOOK_URL && (info?.result?.pending_update_count ?? 0) < 50) {
    return { ok: true, info: info.result };
  }
  const r = await tg(token, "setWebhook", {
    url: WEBHOOK_URL,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "my_chat_member"],
    drop_pending_updates: false,
    max_connections: 40,
  });
  return { ok: !!r.ok, info: r };
}

// Set the bot's command menu so users see commands when they type "/" in
// Telegram. Idempotent + cached per cold start (re-runs every 6h).
const commandsSetAt = { t: 0 };
async function ensureCommands(token: string): Promise<void> {
  if (Date.now() - commandsSetAt.t < 6 * 60 * 60 * 1000) return;
  commandsSetAt.t = Date.now();

  const privateCommands = [
    { command: "start", description: "About LaPoe + how to set up" },
    { command: "help", description: "Show available commands" },
    { command: "link", description: "Link your LaPoe account: /link CODE" },
    { command: "unlink", description: "Unlink your LaPoe account" },
    { command: "status", description: "Show your plan + usage" },
    { command: "mybots", description: "List bots you own" },
    { command: "createbot", description: "How to create a new bot" },
    { command: "id", description: "Show your Telegram user ID" },
    { command: "info", description: "About this chat" },
  ];
  const groupCommands = [
    { command: "rules", description: "Show this group's rules" },
    { command: "report", description: "Report a message to admins" },
    { command: "id", description: "Show user / chat IDs" },
    { command: "info", description: "About this group" },
    { command: "notes", description: "List saved notes" },
    { command: "filters", description: "List active filters" },
    { command: "warns", description: "Show warnings (reply to a user)" },
    { command: "get", description: "Get a note: /get name" },
    { command: "setrules", description: "Admin: set group rules" },
    { command: "setwelcome", description: "Admin: set welcome message" },
    { command: "setgoodbye", description: "Admin: set goodbye message" },
    { command: "addnote", description: "Admin: /addnote name text" },
    { command: "clearnote", description: "Admin: /clearnote name" },
    { command: "filter", description: "Admin: /filter trigger reply" },
    { command: "stop", description: "Admin: remove a filter" },
    { command: "banword", description: "Admin: ban a word" },
    { command: "unbanword", description: "Admin: unban a word" },
    { command: "warn", description: "Admin: warn a user (reply)" },
    { command: "unwarn", description: "Admin: remove last warn (reply)" },
    { command: "resetwarns", description: "Admin: reset warns (reply)" },
    { command: "ban", description: "Admin: ban a user (reply)" },
    { command: "unban", description: "Admin: unban a user (reply)" },
    { command: "kick", description: "Admin: kick a user (reply)" },
    { command: "mute", description: "Admin: mute a user (reply)" },
    { command: "unmute", description: "Admin: unmute a user (reply)" },
    { command: "promote", description: "Admin: promote a user (reply)" },
    { command: "demote", description: "Admin: demote a user (reply)" },
    { command: "pin", description: "Admin: pin replied message" },
    { command: "unpin", description: "Admin: unpin current pinned" },
    { command: "purge", description: "Admin: delete from replied to now" },
    { command: "lock", description: "Admin: lock chat" },
    { command: "unlock", description: "Admin: unlock chat" },
    { command: "antiflood", description: "Admin: set flood limit" },
    { command: "moderation", description: "Admin: toggle moderation on/off" },
    { command: "setwarnlimit", description: "Admin: set max warns" },
    { command: "setlang", description: "Admin: set language" },
    { command: "feedback", description: "Send feedback to LaPoe" },
  ];

  try {
    await Promise.all([
      tg(token, "setMyCommands", { commands: privateCommands, scope: { type: "all_private_chats" } }),
      tg(token, "setMyCommands", { commands: groupCommands, scope: { type: "all_group_chats" } }),
      tg(token, "setMyCommands", { commands: groupCommands, scope: { type: "all_chat_administrators" } }),
    ]);
  } catch (e) {
    console.error("setMyCommands failed:", (e as Error).message);
  }
}

// ---------- AI handlers ----------
// DM policy: @LaPoe_bot does NOT reply to free-form messages in DMs. Only
// commands (handled in handleCommand) and the one-time welcome DM sent right
// after /link are allowed. This mirrors the project-wide "no AI in DMs" rule.
async function handleDmAi(sb: any, token: string, msg: any) {
  const chatId = msg.chat.id;
  const fromId = msg.from?.id;
  const text = (msg.text || msg.caption || "").trim();
  if (!fromId || !text) return;

  const profile = await getProfile(sb, fromId);
  if (!profile) {
    return send(token, chatId,
      `👋 I'm *LaPoe*. I don't chat in DMs — I'm a *group* assistant.\n\nTo set me up:\n1. Open https://lapoe-ai.vercel.app and sign in\n2. Settings → Telegram → generate a code\n3. Send me \`/link YOUR_CODE\` here\n4. Add me to your group as admin\n\nUse /help for commands.`, msg.message_id);
  }
  return send(token, chatId,
    `I don't reply in DMs — I work in your *group*. Manage me at https://lapoe-ai.vercel.app/dashboard/assistant or use /help for commands.`,
    msg.message_id);
}

// Greeting / group-related helpers (mirror user-bot triggers).
function isGreeting(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 30) return false;
  return /^(hi|hello|hey|hola|yo|gm|good\s*morning|good\s*evening|good\s*afternoon|sup|howdy|hiya)\b/i.test(t);
}
function isGroupRelated(text: string, group: any, persona: any): boolean {
  const hay = (text || "").toLowerCase();
  const bag = [
    group?.title, group?.rules, group?.welcome_message,
    persona?.display_name, persona?.personality, persona?.house_rules,
  ].filter(Boolean).join(" ").toLowerCase();
  if (!bag) return false;
  const words = Array.from(new Set(bag.split(/[^a-z0-9]+/).filter((w) => w.length >= 4)));
  return words.some((w) => hay.includes(w));
}

function isPlatformTopic(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(lapoe|la\s*poe|platform|website|dashboard|docs?|documentation|pricing|free plan|paid plan|telegram bot|own bot|create (?:my |your |a )?bot|assistant|bot token|botfather)\b/i.test(t);
}

function sanitizePlatformLinks(reply: string): string {
  if (!reply) return reply;
  return reply
    .replace(/\b(Go to the LaPoe website at|Open the LaPoe website at|Visit the LaPoe website at)\s*(?=\n|$)/gi, "$1 https://lapoe-ai.vercel.app")
    .replace(/\b(see the docs at|read the docs at|full details.*?docs at)\s*(?=\n|$)/gi, "$1 https://lapoe-ai.vercel.app/docs")
    .replace(/\b(upgrade.*?pricing at|pricing at)\s*(?=\n|$)/gi, "$1 https://lapoe-ai.vercel.app/pricing")
    .trim();
}

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

async function logUnansweredSystem(sb: any, ownerId: string, question: string, from: any) {
  try {
    const norm = normalizeQuestion(question);
    if (norm.length < 4) return;
    const asker = from?.username ? `@${from.username}` : (from?.first_name || null);
    const { data: existing } = await sb.from("unanswered_questions")
      .select("id, ask_count, status")
      .is("bot_id", null)
      .eq("owner_id", ownerId)
      .eq("normalized_question", norm)
      .maybeSingle();
    if (existing) {
      if (existing.status === "dismissed") return;
      await sb.from("unanswered_questions").update({
        ask_count: (existing.ask_count || 1) + 1,
        status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await sb.from("unanswered_questions").insert({
        owner_id: ownerId,
        bot_id: null,
        question: question.slice(0, 1000),
        normalized_question: norm,
        asker, status: "pending",
      });
    }
  } catch (e) {
    console.error("logUnansweredSystem failed:", (e as Error).message);
  }
}

function isQuestionLikeSys(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/[?¿]\s*$/.test(t)) return true;
  return /\b(what|who|when|where|why|how|can|could|should|do|does|did|is|are|am|will|would|tell me|explain|help|que|qué|cuál|cómo|porque|cómo|nini|nani|lini|wapi|kwa\s?nini|vipi)\b/i.test(t);
}

// DM the free-plan owner once per month when their 30 AI replies run out.
// Stays silent in the group; uses notifications table to dedup.
async function notifySystemBotOwnerLimit(sb: any, token: string, ownerId: string, cap: number): Promise<void> {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: existing } = await sb
      .from("notifications")
      .select("id")
      .eq("user_id", ownerId)
      .eq("type", "limit")
      .gte("created_at", monthStart.toISOString())
      .limit(1)
      .maybeSingle();
    if (existing) return;

    await sb.from("notifications").insert({
      title: "Monthly AI limit reached",
      body: `Your free assistant @LaPoe_bot has used all ${cap} AI replies this month. It will stay silent in your group until the 1st. Upgrade for more.`,
      type: "limit", audience: "user", user_id: ownerId,
      link: "/pricing",
    });

    const { data: profile } = await sb
      .from("profiles").select("telegram_user_id")
      .eq("id", ownerId).maybeSingle();
    if (profile?.telegram_user_id) {
      await tg(token, "sendMessage", {
        chat_id: Number(profile.telegram_user_id),
        text: `🛑 You've used all ${cap} free AI replies this month.\n\n@LaPoe_bot will stay silent in your group until the 1st. Upgrade anytime: https://lapoe-ai.vercel.app/pricing`,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
  } catch (e) {
    console.error("notifySystemBotOwnerLimit failed:", (e as Error).message);
  }
}

async function handleGroupAi(sb: any, token: string, msg: any, group: any) {
  const text: string = (msg.text || msg.caption || "").trim();
  if (!text) return;
  if (!group.linked_owner_id) return; // unclaimed group → no AI

  const ownerId = group.linked_owner_id;
  const { plan, allowed, used, cap } = await ownerAiAllowed(sb, ownerId);
  if (plan !== "free") return; // paid users use their own bot

  // Decide whether to reply — mirrors user-bot policy.
  //  1) @LaPoe_bot or persona display name (as a phrase) mentioned
  //  2) Reply to one of @LaPoe_bot's messages
  //  3) Substantive message relevant to knowledge, group/persona, or LaPoe platform info
  // Greetings are NOT filtered when the bot is addressed (cases 1/2).
  const { data: persona } = await sb.from("system_bot_personas").select("*").eq("owner_id", ownerId).maybeSingle();

  const repliedToBot = msg.reply_to_message?.from?.username?.toLowerCase() === LAPOE_USERNAME;
  const lower = text.toLowerCase();
  const personaName = String(persona?.display_name || "").trim();
  const personaPhraseHit = personaName.length >= 3
    ? new RegExp(`(^|[\\s,.!?;:])${personaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\?\s+/g, "\\s+")}(?=$|[\\s,.!?;:])`, "iu").test(text)
    : false;
  const mentionedBot = lower.includes(`@${LAPOE_USERNAME}`) || personaPhraseHit;

  let rag = { text: "", exists: false };
  let shouldReply = Boolean(repliedToBot || mentionedBot);

  if (!shouldReply) {
    const probeWorthy =
      text.length >= 8 &&
      !text.startsWith("/") && !text.startsWith("!") &&
      !isGreeting(text) &&
      (isQuestionLikeSys(text) || isGroupRelated(text, group, persona) || isPlatformTopic(text));
    if (probeWorthy) {
      rag = await ragForOwner(sb, ownerId, text, 5);
      if (rag.text || isPlatformTopic(text) || (isQuestionLikeSys(text) && isGroupRelated(text, group, persona))) shouldReply = true;
    }
  }
  if (!shouldReply) return;

  // Log inbound to bot_messages so the dashboard's Messages page shows it.
  sb.from("bot_messages").insert({
    bot_id: null, owner_id: ownerId, group_id: null, direction: "inbound",
    content: text,
    telegram_user: msg.from?.username || msg.from?.first_name || String(msg.from?.id || ""),
  }).then(() => {}, () => {});

  if (!allowed) {
    // Silent in the group. DM the owner once per month.
    await notifySystemBotOwnerLimit(sb, token, ownerId, cap).catch(() => {});
    return;
  }

  if (!rag.exists && !rag.text) rag = await ragForOwner(sb, ownerId, text, 5);

  const ownerName = persona?.display_name || "LaPoe";
  const system = buildSystemBotPrompt(persona, rag.text, rag.exists, ownerName) +
    `\n\nYou are in the Telegram group "${group.title || ""}". Keep it conversational.`;

  let rawReply = "";
  try { rawReply = await askAI(system, text); } catch { return; }
  if (!rawReply) return;

  const needsKnowledge = /\[NEEDS_KNOWLEDGE\]/i.test(rawReply);
  const reply = sanitizePlatformLinks(rawReply.replace(/\[NEEDS_KNOWLEDGE\]/gi, "").trim());
  if (!reply) return;

  await send(token, msg.chat.id, reply, msg.message_id);

  sb.from("bot_messages").insert({
    bot_id: null, owner_id: ownerId, group_id: null, direction: "outbound",
    content: reply, telegram_user: msg.from?.username || null,
  }).then(() => {}, () => {});

  await sb.rpc("bump_system_bot_usage", { _owner_id: ownerId });

  if (needsKnowledge) {
    logUnansweredSystem(sb, ownerId, text, msg.from);
  }
}


async function processUpdate(sb: any, token: string, upd: any) {
  try {
    if (upd.my_chat_member) {
      await ensureGroup(sb, upd.my_chat_member.chat, upd.my_chat_member.from?.id);
    }
    const msg = upd.message || upd.edited_message;
    if (!msg) return;

    if (msg.new_chat_members?.length || msg.left_chat_member) {
      await handleMembership(sb, token, msg);
      return;
    }
    const text: string = msg.text || msg.caption || "";
    const isPrivate = msg.chat?.type === "private";

    if (text.startsWith("/") || text.startsWith("#")) {
      await handleCommand(sb, token, msg);
      return;
    }

    if (isPrivate) {
      await handleDmAi(sb, token, msg);
      return;
    }

    // Group: make every group message self-heal registration. If Telegram's
    // add/member event was missed, a message from the linked owner will create
    // and claim the group so dashboard visibility + AI start working.
    await ensureGroup(sb, msg.chat, msg.from?.id);

    // Group: run moderation first, then AI (only if mentioned/replied).
    const handled = await runGroupChecks(sb, token, msg);
    if (handled) return;
    const group = await getGroup(sb, msg.chat.id);
    if (group) await handleGroupAi(sb, token, msg, group);
  } catch (e) {
    console.error("system bot update error:", (e as Error).message);
  }
}


// ---------- Entrypoint ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("LAPOE_SYSTEM_BOT_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "LAPOE_SYSTEM_BOT_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  // === WEBHOOK FAST PATH ===
  // Telegram delivers updates via POST with the secret_token header set.
  const tgSecretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (req.method === "POST" && tgSecretHeader) {
    const expected = await webhookSecret(token);
    if (!safeEqual(tgSecretHeader, expected)) {
      return new Response("unauthorized", { status: 401 });
    }
    let upd: any = null;
    try { upd = await req.json(); } catch { /* ignore */ }
    if (upd && typeof upd.update_id === "number") {
      // Fire-and-forget: ack Telegram immediately so it never waits on us.
      processUpdate(sb, token, upd).catch(() => {});
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // === SETUP / SELF-HEAL WEBHOOK ===
  // Called from cron (safety net) and from ?action=setup_webhook (manual).
  // Idempotent: skips the API call when already registered correctly.
  const action = url.searchParams.get("action") || "";
  const hookRes = await ensureWebhook(token).catch((e) => ({ ok: false, info: { error: (e as Error).message } }));
  ensureCommands(token).catch(() => {});

  // === EMERGENCY DRAIN (only if webhook is broken) ===
  // If for any reason the webhook isn't accepting updates, fall back to a
  // short getUpdates burst so the bot keeps working.
  let drained = 0;
  if (action === "drain" || !hookRes.ok) {
    try {
      const { data: state } = await sb.from("system_bot_state").select("update_offset").eq("id", 1).maybeSingle();
      let offset = state?.update_offset || 0;
      // Note: getUpdates is incompatible with an active webhook, so we only
      // hit it when ensureWebhook failed.
      const r = await tg(token, "getUpdates", { offset, timeout: 0, limit: 50 });
      const updates: any[] = r?.result || [];
      for (const upd of updates) {
        offset = upd.update_id + 1;
        await processUpdate(sb, token, upd);
        drained++;
      }
      if (updates.length) {
        await sb.from("system_bot_state").update({ update_offset: offset, updated_at: new Date().toISOString() }).eq("id", 1);
      }
    } catch (e) {
      console.error("system bot drain error:", (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ ok: true, webhook: hookRes, drained }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
