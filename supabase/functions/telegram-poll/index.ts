// Polls Telegram getUpdates for every user bot.
// - Replies via Lovable AI with persona + RAG (top-k from knowledge_chunks).
// - In group chats: only replies on mention/reply, auto-registers groups, runs moderation.
// - In private chats with the bot owner (linked profile): exposes a Rose-style command suite to configure the bot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "google/text-embedding-004";

// ---------- In-memory rate limiting + backoff ----------
// Lives per warm edge instance. Resets on cold start; not shared across instances.
// Token-bucket: refill `rate` tokens per second, capacity = `burst`.
type Bucket = { tokens: number; updated: number };
const userBuckets = new Map<string, Bucket>();
const groupBuckets = new Map<string, Bucket>();
const chatCooldown = new Map<string, number>(); // key -> epoch ms until silent
const aiBackoffUntil = { t: 0 };                // global AI backoff after 429 / credits

function takeToken(map: Map<string, Bucket>, key: string, rate: number, burst: number): boolean {
  const now = Date.now();
  const b = map.get(key) ?? { tokens: burst, updated: now };
  const elapsed = (now - b.updated) / 1000;
  b.tokens = Math.min(burst, b.tokens + elapsed * rate);
  b.updated = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    map.set(key, b);
    return true;
  }
  map.set(key, b);
  return false;
}

function inCooldown(key: string): boolean {
  const until = chatCooldown.get(key) ?? 0;
  if (until > Date.now()) return true;
  if (until) chatCooldown.delete(key);
  return false;
}
function setCooldown(key: string, ms: number) {
  chatCooldown.set(key, Date.now() + ms);
}
function gcBuckets() {
  const now = Date.now();
  const stale = 10 * 60_000;
  for (const [k, b] of userBuckets) if (now - b.updated > stale) userBuckets.delete(k);
  for (const [k, b] of groupBuckets) if (now - b.updated > stale) groupBuckets.delete(k);
  for (const [k, t] of chatCooldown) if (t < now) chatCooldown.delete(k);
}

const TONES: Record<string, string> = {
  friendly: "Warm, casual, like a helpful community member. Contractions OK. Short sentences. No corporate fluff.",
  professional: "Clear, courteous, business-appropriate. No emoji unless the user uses them first.",
  witty: "Dry, clever, a little playful. Keep it short. Land the joke and move on.",
  strict: "Direct and rule-focused. Short. No padding. Cite the rule when enforcing.",
  hype: "High-energy community vibe. A few emoji are fine. Keep it real, never spammy.",
};

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function send(token: string, chatId: number | string, text: string, replyTo?: number) {
  return tg(token, "sendMessage", {
    chat_id: chatId, text,
    reply_to_message_id: replyTo,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

async function ragSnippets(supabase: any, botId: string, question: string, k = 6, useFallback = true): Promise<string> {
  const q = (question || "").trim();
  if (!q) return "";

  // Try the natural query first.
  let { data } = await supabase.rpc("match_knowledge_chunks_text", {
    _bot_id: botId, _query: q, _match_count: k,
  });

  // If nothing matched, OR-join meaningful tokens and retry — much more forgiving.
  if (!data || data.length === 0) {
    const tokens = q.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 2);
    if (tokens.length > 0) {
      const orQuery = tokens.join(" or ");
      const r = await supabase.rpc("match_knowledge_chunks_text", {
        _bot_id: botId, _query: orQuery, _match_count: k,
      });
      data = r.data;
    }
  }

  // Final fallback: pull a few recent chunks so the bot at least sees some context.
  if (!data || data.length === 0) {
    if (!useFallback) return "";
    const { data: recent } = await supabase
      .from("knowledge_chunks")
      .select("content")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(k);
    if (recent && recent.length > 0) {
      return recent.map((r: any, i: number) => `[${i + 1}] ${r.content}`).join("\n\n").slice(0, 6000);
    }
    return "";
  }

  return data
    .map((r: any, i: number) => `[${i + 1}] ${r.content}`)
    .join("\n\n")
    .slice(0, 6000);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function messageNamesBot(text: string, bot: any, me: { username: string | null; id: number | null }): boolean {
  const lowerText = text.toLowerCase();
  if (me.username && new RegExp(`(^|\\s|[,.!?;:])@${escapeRe(me.username.toLowerCase())}(?=$|\\s|[,.!?;:])`).test(lowerText)) return true;
  const nameTokens = (bot.name || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t: string) => t.length >= 3);
  return nameTokens.some((t: string) => new RegExp(`\\b${escapeRe(t)}\\b`, "iu").test(text));
}

function stripBotName(text: string, bot: any, me: { username: string | null; id: number | null }): string {
  let clean = text;
  if (me.username) clean = clean.replace(new RegExp(`@${escapeRe(me.username)}`, "ig"), " ");
  const names = [bot.name, ...(bot.name || "").split(/\s+/)].filter((n: string) => n && n.length >= 3);
  for (const n of names) {
    clean = clean.replace(new RegExp(`(^|[\n\s,.:;!?-])${escapeRe(n)}(?=($|[\n\s,.:;!?-]))`, "ig"), " ");
  }
  return clean.replace(/\s+/g, " ").trim() || text.trim();
}

function isQuestionLike(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/[?¿]\s*$/.test(t)) return true;
  // English + common question words across languages (es/fr/pt/de/it/sw/ar-translit/ru-translit/id/tr)
  return /\b(what|who|when|where|why|how|can|could|should|do|does|did|is|are|am|will|would|tell me|explain|help|que|qué|cuál|cuándo|dónde|por\s?qué|cómo|quoi|quel|quand|où|pourquoi|comment|porque|qual|quando|onde|warum|wie|wer|wann|wo|cosa|perché|come|nini|nani|lini|wapi|kwa\s?nini|vipi|kak|chto|gde|kogda|pochemu|apa|siapa|kapan|dimana|mengapa|bagaimana|ne|nasıl|neden|nerede)\b/i.test(t);
}

function isGreeting(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.?¡¿,]/g, "").slice(0, 60);
  return /^(hi|hii+|hello|hey|yo|sup|hiya|howdy|good\s?(morning|afternoon|evening|night)|gm|gn|hola|buen[oa]s|salut|bonjour|bonsoir|coucou|ola|olá|oi|hallo|servus|moin|ciao|salve|buongiorno|habari|jambo|mambo|sasa|hujambo|salaam|salam|assalam[ou]\s?alaikum|marhaba|privet|zdravstvuyte|halo|hai|merhaba|selam|namaste|annyeong|konnichiwa|ohayo|ni\s?hao)\b/i.test(t);
}

function isGroupRelated(text: string, group: any | null, bot: any): boolean {
  const hay = text.toLowerCase();
  const sources = [group?.name, group?.rules, group?.welcome_message, bot.house_rules, bot.default_instructions]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w: string) => w.length >= 5 && !["about", "group", "rules", "please", "welcome", "message", "members"].includes(w));
  const keywords = Array.from(new Set(sources)).slice(0, 40);
  return keywords.some((w: string) => hay.includes(w));
}

async function hasKnowledge(supabase: any, botId: string): Promise<boolean> {
  const { count } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", botId);
  return (count ?? 0) > 0;
}


function buildSystemPrompt(bot: any, group: any | null, knowledge: string, knowledgeExists: boolean): string {
  const tone = TONES[bot.tone] || TONES.friendly;
  const persona = bot.personality || "";
  const groupCtx = group
    ? `You are currently in the Telegram group "${group.name}".${group.welcome_message ? `\nGroup vibe: ${group.welcome_message}` : ""}${group.rules ? `\nGroup rules:\n${group.rules}` : ""}`
    : "You are in a private chat.";
  const houseRules = bot.house_rules ? `\nHouse rules to follow:\n${bot.house_rules}` : "";
  const customInstr = bot.default_instructions ? `\n\nOwner instructions:\n${bot.default_instructions}` : "";

  let knowledgeBlock = "";
  if (knowledge) {
    knowledgeBlock = `\n\n=== KNOWLEDGE BASE (authoritative) ===\n${knowledge}\n=== END KNOWLEDGE ===\n\nGround every factual answer in the knowledge above. Paraphrase naturally — do not quote source numbers. If the user's question is clearly outside this knowledge, say so honestly in one short line and offer to help with what you do cover.`;
  } else if (knowledgeExists) {
    knowledgeBlock = `\n\nThe owner gave you a knowledge base, but nothing in it matches this message. Tell the user briefly that this isn't covered in your notes, then offer what you can help with. Do NOT invent facts.`;
  }

  return `You are *${bot.name}*, a Telegram community bot.

Tone: ${tone}
${persona ? `Character: ${persona}\n` : ""}${groupCtx}${houseRules}${customInstr}${knowledgeBlock}

STRICT SCOPE RULES — follow these above all else:
- You exist ONLY to help with topics related to this bot's community/persona${knowledgeExists ? " and the KNOWLEDGE BASE" : ""}${group ? " and this group" : ""}.
- DO NOT answer general-knowledge questions (politics, world facts, trivia, celebrities, geography, history, coding help, math, etc.) unless they are explicitly covered ${knowledgeExists ? "in the knowledge base" : "by the owner instructions or house rules"}.
- If a question is outside your scope, politely decline in ONE short line and redirect to what you can help with.
- Never invent facts. If you don't have it, say so.

ANTI-HALLUCINATION — links, URLs, references, citations:
- NEVER invent, guess, autocomplete, or fabricate any URL, link, domain, path, email, phone number, handle, file name, product name, price, date, or statistic.
- Only include a URL/link if it appears VERBATIM inside the KNOWLEDGE BASE / owner instructions / house rules above. Copy it character-for-character — do NOT modify the path, add subpages (e.g. "/knowledge-base"), or assume what a docs URL "should" be.
- If you don't have a real source, OMIT the link entirely. Do NOT write "Reference:", "Source:", "Docs:", "See:", "More info:" or any similar line followed by a guessed URL.
- Markdown links to invented destinations are forbidden under the same rule.

Reply rules:
- Sound like a real person, not an AI assistant. NEVER say "as an AI" or "I'm just an AI".
- ALWAYS reply in the same language the user wrote in. Detect language from the latest message and mirror it.
- Match the user's energy and length. One-liners get one-liners. Greetings get a short friendly greeting back.
- Never apologize unprompted. Never say "I hope this helps".
- Keep replies under 4 short sentences unless explicitly asked for detail.
- No bullet lists for casual chat. Save lists for actual lists.
- NEVER claim you "are not an admin" or refuse moderation requests in chat — moderation runs through /ban /kick /mute /del /pin /warn commands. If asked to moderate in conversation, briefly tell the user to reply to the offender's message with one of those commands.`;
}

async function askAI(system: string, userText: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  if (aiBackoffUntil.t > Date.now()) throw new Error("AI backoff active");
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    }),
  });
  if (res.status === 429) {
    aiBackoffUntil.t = Date.now() + 30_000;
    throw new Error("AI rate limit");
  }
  if (res.status === 402) {
    aiBackoffUntil.t = Date.now() + 60_000;
    throw new Error("AI credits exhausted");
  }
  if (res.status >= 500) {
    aiBackoffUntil.t = Date.now() + 10_000;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Lovable AI error");
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// Belt-and-braces: even with strict prompting, scrub fabricated URLs.
// Strips any URL that doesn't appear verbatim in the grounded context,
// and removes orphan "Reference:" / "Source:" / "Docs:" / "See:" lines.
function sanitizeReply(reply: string, allowedContext: string): string {
  if (!reply) return reply;
  const haystack = (allowedContext || "").toLowerCase();
  const urlRe = /\bhttps?:\/\/[^\s)\]>"']+/gi;

  // 1) Strip whole lines whose only purpose is a reference label + URL.
  let out = reply.replace(
    /^[ \t>*_~`-]*\[?(reference|references|source|sources|docs?|documentation|see|see also|more info|read more|link|links?|url)s?\]?\s*[:：-]\s*.*$/gim,
    "",
  );

  // 2) Remove markdown links pointing to URLs not present in the context.
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_m, label, url) =>
    haystack.includes(String(url).toLowerCase()) ? `[${label}](${url})` : label,
  );

  // 3) Strip bare URLs not present in the context.
  out = out.replace(urlRe, (url) =>
    haystack.includes(url.toLowerCase()) ? url : "",
  );

  // 4) Collapse blank lines created by the scrub.
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function getMe(token: string, bot: any, supabase: any): Promise<{ username: string | null; id: number | null }> {
  if (bot.bot_username && bot.bot_telegram_id) {
    return { username: bot.bot_username, id: Number(bot.bot_telegram_id) };
  }
  const me = await tg(token, "getMe", {});
  const username = me.result?.username ?? null;
  const id = me.result?.id ?? null;
  if (username || id) {
    await supabase.from("bots").update({ bot_username: username, bot_telegram_id: id }).eq("id", bot.id);
  }
  return { username, id };
}

async function isGroupAdmin(token: string, chatId: number, userId: number): Promise<boolean> {
  try {
    const r = await tg(token, "getChatMember", { chat_id: chatId, user_id: userId });
    const status = r?.result?.status;
    return status === "creator" || status === "administrator";
  } catch { return false; }
}

async function logMod(supabase: any, bot: any, chatId: number, action: string, opts: any) {
  await supabase.from("moderation_actions").insert({
    bot_id: bot.id, owner_id: bot.owner_id,
    group_chat_id: String(chatId), action,
    target_user: opts.target_user || null,
    target_user_id: opts.target_user_id || null,
    performed_by: opts.performed_by || null,
    reason: opts.reason || null,
    success: opts.success !== false,
    details: opts.details || null,
  });
}

function containsBannedWord(text: string, bannedBot: string[], bannedGroup: string[]): string | null {
  const all = [...(bannedBot || []), ...(bannedGroup || [])].map(w => w.trim().toLowerCase()).filter(Boolean);
  if (all.length === 0) return null;
  const lower = text.toLowerCase();
  return all.find(w => lower.includes(w)) || null;
}

async function checkFlood(supabase: any, botId: string, telegramUser: string, sensitivity: number): Promise<boolean> {
  const windowSeconds = 10;
  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase
    .from("bot_messages")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", botId)
    .eq("telegram_user", telegramUser)
    .eq("direction", "inbound")
    .gte("created_at", sinceIso);
  return (count ?? 0) >= sensitivity;
}

async function checkSpam(supabase: any, botId: string, telegramUser: string, content: string): Promise<boolean> {
  const { data } = await supabase
    .from("bot_messages")
    .select("content")
    .eq("bot_id", botId)
    .eq("telegram_user", telegramUser)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.content === content;
}

async function ensureGroup(supabase: any, bot: any, msg: any) {
  const chat = msg.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return null;
  const chatId = String(chat.id);
  const { data: existing } = await supabase.from("telegram_groups").select("*")
    .eq("bot_id", bot.id).eq("telegram_chat_id", chatId).maybeSingle();
  if (existing) {
    await supabase.from("telegram_groups").update({
      name: chat.title || existing.name, last_seen_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing;
  }
  const { data: created } = await supabase.from("telegram_groups").insert({
    bot_id: bot.id, owner_id: bot.owner_id,
    name: chat.title || "Untitled group",
    telegram_chat_id: chatId,
    is_auto: true, last_seen_at: new Date().toISOString(),
  }).select("*").single();
  return created;
}

// ----- Owner DM commands (Rose-style) -----
const OWNER_HELP = `*${"{name}"}* — owner controls

Setup:
/settone <friendly|professional|witty|strict|hype>
/setpersona <one-line character description>
/setrules <house rules — multi-line OK>
/setwelcome <welcome message for new members>
/setinstructions <freeform instructions, overrides defaults>

Knowledge:
/addknow <text> — paste a fact or paragraph the bot should know
/addurl <https://...> — index a page

Moderation:
/banword <word>
/unbanword <word>
/banwords — list current banned words
/modon /modoff — toggle moderation in groups

Groups:
/groups — list groups this bot is in
/status — health check
/help — this menu`;

async function handleOwnerDM(supabase: any, bot: any, token: string, msg: any): Promise<boolean> {
  // Only the bot owner (linked Telegram) can configure here.
  const fromId = msg.from?.id;
  if (!fromId) return false;
  const { data: profile } = await supabase.from("profiles").select("id")
    .eq("telegram_user_id", fromId).eq("id", bot.owner_id).maybeSingle();
  if (!profile) return false;

  const text = (msg.text || "").trim();
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = text.slice(cmdRaw.length).trim();

  const ack = (m: string) => send(token, msg.chat.id, m, msg.message_id);

  switch (cmd) {
    case "/help":
    case "/start":
      return ack(OWNER_HELP.replaceAll("{name}", bot.name)), true;
    case "/status": {
      const { count: kc } = await supabase.from("knowledge_chunks").select("id", { count: "exact", head: true }).eq("bot_id", bot.id);
      const { count: gc } = await supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("bot_id", bot.id);
      return ack(`*${bot.name}* — health\n\n• Status: ${bot.status === "active" ? "🟢 active" : "🟡 paused"}\n• Tone: ${bot.tone || "friendly"}\n• Knowledge chunks: ${kc ?? 0}\n• Groups: ${gc ?? 0}\n• Moderation: ${bot.moderation_enabled ? "on" : "off"}\n• AI: 🟢 Lovable AI Gateway`), true;
    }
    case "/settone": {
      const t = arg.toLowerCase();
      if (!TONES[t]) return ack(`Tones: ${Object.keys(TONES).join(", ")}`), true;
      await supabase.from("bots").update({ tone: t }).eq("id", bot.id);
      return ack(`✅ Tone set to *${t}*.`), true;
    }
    case "/setpersona":
      if (!arg) return ack("Usage: `/setpersona Sassy librarian who loves indie rock`"), true;
      await supabase.from("bots").update({ personality: arg.slice(0, 500) }).eq("id", bot.id);
      return ack("✅ Persona saved."), true;
    case "/setrules":
      await supabase.from("bots").update({ house_rules: arg.slice(0, 2000) }).eq("id", bot.id);
      return ack(arg ? "✅ House rules updated." : "✅ House rules cleared."), true;
    case "/setwelcome":
      await supabase.from("bots").update({ welcome_message: arg.slice(0, 1000) }).eq("id", bot.id);
      return ack(arg ? "✅ Welcome message set." : "✅ Welcome cleared."), true;
    case "/setinstructions":
      await supabase.from("bots").update({ default_instructions: arg.slice(0, 4000) }).eq("id", bot.id);
      return ack(arg ? "✅ Instructions saved." : "✅ Instructions cleared."), true;
    case "/addknow": {
      if (!arg) return ack("Usage: `/addknow Our refund policy is 30 days no questions.`"), true;
      const { data: src } = await supabase.from("knowledge_sources").insert({
        bot_id: bot.id, owner_id: bot.owner_id,
        kind: "text", title: arg.slice(0, 60), content: arg,
      }).select("id").single();
      // Fire-and-forget index
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/index-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ source_id: src?.id }),
      }).catch(() => {});
      return ack("✅ Saved. Indexing in the background."), true;
    }
    case "/addurl": {
      if (!arg.startsWith("http")) return ack("Usage: `/addurl https://example.com/post`"), true;
      const { data: src } = await supabase.from("knowledge_sources").insert({
        bot_id: bot.id, owner_id: bot.owner_id,
        kind: "url", title: arg.slice(0, 80), source_url: arg,
      }).select("id").single();
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/index-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ source_id: src?.id }),
      }).catch(() => {});
      return ack("✅ URL queued. Indexing in the background."), true;
    }
    case "/banword": {
      if (!arg) return ack("Usage: `/banword spammer`"), true;
      const next = Array.from(new Set([...(bot.banned_words || []), arg.toLowerCase()]));
      await supabase.from("bots").update({ banned_words: next }).eq("id", bot.id);
      return ack(`✅ Added. Now banning ${next.length} word(s).`), true;
    }
    case "/unbanword": {
      const next = (bot.banned_words || []).filter((w: string) => w !== arg.toLowerCase());
      await supabase.from("bots").update({ banned_words: next }).eq("id", bot.id);
      return ack(`✅ Removed. Now banning ${next.length} word(s).`), true;
    }
    case "/banwords":
      return ack(`Banned words: ${(bot.banned_words || []).join(", ") || "—"}`), true;
    case "/modon":
      await supabase.from("bots").update({ moderation_enabled: true }).eq("id", bot.id);
      return ack("✅ Moderation on."), true;
    case "/modoff":
      await supabase.from("bots").update({ moderation_enabled: false }).eq("id", bot.id);
      return ack("✅ Moderation off."), true;
    case "/groups": {
      const { data: gs } = await supabase.from("telegram_groups").select("name,member_count").eq("bot_id", bot.id);
      const list = (gs || []).map((g: any) => `• ${g.name}${g.member_count ? ` (${g.member_count})` : ""}`).join("\n");
      return ack(`*Groups (${gs?.length ?? 0})*\n\n${list || "—"}`), true;
    }
  }
  return false;
}

// ----- Group moderation commands (admins + bot owner) -----
async function canModerate(supabase: any, bot: any, token: string, chatId: number, fromId: number): Promise<boolean> {
  // Bot owner (linked Telegram) can always moderate
  const { data: profile } = await supabase.from("profiles").select("id")
    .eq("telegram_user_id", fromId).eq("id", bot.owner_id).maybeSingle();
  if (profile) return true;
  return await isGroupAdmin(token, chatId, fromId);
}

async function handleModeration(supabase: any, bot: any, token: string, msg: any): Promise<boolean> {
  const text = (msg.text || "").trim();
  if (!text.startsWith("/")) return false;
  const [cmdRaw] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  if (!["/ban", "/unban", "/kick", "/mute", "/unmute", "/del", "/delete", "/pin", "/unpin", "/warn"].includes(cmd)) return false;

  const fromId = msg.from?.id;
  const chatId = msg.chat.id;
  if (!fromId || !(await canModerate(supabase, bot, token, chatId, fromId))) {
    await send(token, chatId, "🚫 You don't have moderation rights here.", msg.message_id);
    return true;
  }

  // Most actions need a reply target
  const target = msg.reply_to_message;
  const targetId = target?.from?.id;
  const targetName = target?.from?.username ? `@${target.from.username}` : (target?.from?.first_name || "user");
  const performedBy = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || String(fromId));

  const needsTarget = ["/ban", "/unban", "/kick", "/mute", "/unmute", "/del", "/delete", "/warn"].includes(cmd);
  if (needsTarget && !targetId) {
    await send(token, chatId, `Reply to a user's message and use ${cmd} again.`, msg.message_id);
    return true;
  }

  switch (cmd) {
    case "/ban": {
      const r = await tg(token, "banChatMember", { chat_id: chatId, user_id: targetId });
      const ok = r.ok;
      await logMod(supabase, bot, chatId, "ban", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: ok, details: r });
      await send(token, chatId, ok ? `🔨 Banned ${targetName}.` : `❌ Couldn't ban: ${r.description}`, msg.message_id);
      return true;
    }
    case "/unban": {
      const r = await tg(token, "unbanChatMember", { chat_id: chatId, user_id: targetId, only_if_banned: true });
      await logMod(supabase, bot, chatId, "unban", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `✅ Unbanned ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/kick": {
      await tg(token, "banChatMember", { chat_id: chatId, user_id: targetId });
      const r = await tg(token, "unbanChatMember", { chat_id: chatId, user_id: targetId });
      await logMod(supabase, bot, chatId, "kick", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `👢 Kicked ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/mute": {
      const r = await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: targetId,
        permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false },
      });
      await logMod(supabase, bot, chatId, "mute", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `🔇 Muted ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/unmute": {
      const r = await tg(token, "restrictChatMember", {
        chat_id: chatId, user_id: targetId,
        permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_send_polls: true, can_add_web_page_previews: true },
      });
      await logMod(supabase, bot, chatId, "unmute", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? `🔊 Unmuted ${targetName}.` : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/del":
    case "/delete": {
      const r = await tg(token, "deleteMessage", { chat_id: chatId, message_id: target.message_id });
      await logMod(supabase, bot, chatId, "delete", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: r.ok });
      if (!r.ok) await send(token, chatId, `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/pin": {
      const replyTarget = msg.reply_to_message;
      if (!replyTarget) { await send(token, chatId, "Reply to a message and run /pin again.", msg.message_id); return true; }
      const r = await tg(token, "pinChatMessage", { chat_id: chatId, message_id: replyTarget.message_id });
      await logMod(supabase, bot, chatId, "pin", { performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? "📌 Pinned." : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/unpin": {
      const r = await tg(token, "unpinChatMessage", { chat_id: chatId });
      await logMod(supabase, bot, chatId, "unpin", { performed_by: performedBy, success: r.ok });
      await send(token, chatId, r.ok ? "📌 Unpinned." : `❌ ${r.description}`, msg.message_id);
      return true;
    }
    case "/warn": {
      await logMod(supabase, bot, chatId, "warn", { target_user: targetName, target_user_id: targetId, performed_by: performedBy, success: true });
      await send(token, chatId, `⚠️ ${targetName} has been warned.`, msg.message_id);
      return true;
    }
  }
  return false;
}

async function processBot(supabase: any, bot: any, deadline: number) {
  if (!bot.telegram_bot_token) return { bot: bot.name, skipped: "no token" };
  let offset: number = bot.update_offset || 0;
  let processed = 0;
  const me = await getMe(bot.telegram_bot_token, bot, supabase);

  while (Date.now() < deadline - 3000) {
    const remainingSec = Math.max(1, Math.floor((deadline - Date.now()) / 1000) - 2);
    const timeout = Math.min(25, remainingSec);
    const updatesRes = await tg(bot.telegram_bot_token, "getUpdates", {
      offset, timeout,
      allowed_updates: ["message", "my_chat_member", "new_chat_members", "left_chat_member"],
    });
    if (!updatesRes.ok) return { bot: bot.name, error: updatesRes.description };
    const updates: any[] = updatesRes.result || [];
    if (updates.length === 0) break;

    for (const upd of updates) {
      offset = upd.update_id + 1;

      // Bot was added/removed from a group
      if (upd.my_chat_member) {
        const m = upd.my_chat_member;
        const chat = m.chat;
        const newStatus = m.new_chat_member?.status;
        if (chat.type === "group" || chat.type === "supergroup") {
          if (newStatus === "member" || newStatus === "administrator" || newStatus === "creator") {
            await ensureGroup(supabase, bot, { chat });
          } else if (newStatus === "left" || newStatus === "kicked") {
            // Bot was removed from the group → auto-remove from KADE
            await supabase.from("telegram_groups").delete()
              .eq("bot_id", bot.id).eq("telegram_chat_id", String(chat.id));
          }
        }
        continue;
      }

      const msg = upd.message;
      if (!msg) continue;

      // New members → welcome
      if (msg.new_chat_members && msg.new_chat_members.length > 0) {
        const group = await ensureGroup(supabase, bot, msg);
        const tmpl = group?.welcome_message || bot.welcome_message;
        if (tmpl) {
          for (const m of msg.new_chat_members) {
            if (m.id === me.id) continue;
            const name = m.username ? `@${m.username}` : (m.first_name || "friend");
            await send(bot.telegram_bot_token, msg.chat.id,
              tmpl.replaceAll("{name}", name).replaceAll("{group}", msg.chat.title || ""));
          }
        }
        continue;
      }

      if (!msg.text) continue;

      await supabase.from("bot_messages").insert({
        bot_id: bot.id, owner_id: bot.owner_id, direction: "inbound",
        content: msg.text,
        telegram_user: msg.from?.username || msg.from?.first_name || String(msg.from?.id || ""),
      });

      const isPrivate = msg.chat.type === "private";
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

      // 1) Owner DM commands
      if (isPrivate && await handleOwnerDM(supabase, bot, bot.telegram_bot_token, msg)) {
        processed++; continue;
      }

      // 2) Group moderation commands
      if (isGroup && bot.moderation_enabled && await handleModeration(supabase, bot, bot.telegram_bot_token, msg)) {
        processed++; continue;
      }

      // 3) Auto-register group (silent) + auto-filter moderation
      let group: any = null;
      if (isGroup) {
        group = await ensureGroup(supabase, bot, msg);
        if (bot.moderation_enabled && (group?.moderation_enabled !== false)) {
          const telegramUser = msg.from?.username || msg.from?.first_name || String(msg.from?.id || "");

          // Anti-Spam
          if (bot.anti_spam_enabled && await checkSpam(supabase, bot.id, telegramUser, msg.text)) {
            const r = await tg(bot.telegram_bot_token, "deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
            await logMod(supabase, bot, msg.chat.id, "anti_spam", {
              target_user: telegramUser, target_user_id: msg.from?.id, success: r.ok,
            });
            continue;
          }

          // Anti-Flood
          if (bot.anti_flood_enabled && await checkFlood(supabase, bot.id, telegramUser, bot.flood_sensitivity || 5)) {
            const r = await tg(bot.telegram_bot_token, "deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
            await logMod(supabase, bot, msg.chat.id, "anti_flood", {
              target_user: telegramUser, target_user_id: msg.from?.id, success: r.ok,
            });
            continue;
          }

          // Banned Words
          const hit = containsBannedWord(msg.text, bot.banned_words || [], group?.banned_words || []);
          if (hit) {
            const r = await tg(bot.telegram_bot_token, "deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
            await logMod(supabase, bot, msg.chat.id, "filter_word", {
              target_user: telegramUser, target_user_id: msg.from?.id, reason: hit, success: r.ok,
            });
            continue;
          }
        }
      }

      // Built-in info commands
      const text = msg.text.trim();
      if (text === "/start" || text.startsWith("/start ")) {
        const reply = isPrivate
          ? `👋 Hi! I'm *${bot.name}*. ${bot.personality || "Ask me anything."}\n\nIf you're my owner, send /help for the controls.`
          : `👋 Hello everyone, I'm *${bot.name}*.`;
        await send(bot.telegram_bot_token, msg.chat.id, reply, msg.message_id);
        processed++; continue;
      }
      if (text === "/status") {
        await send(bot.telegram_bot_token, msg.chat.id,
          `*${bot.name}* — ${bot.status === "active" ? "🟢 active" : "🟡 paused"} · AI 🟢`, msg.message_id);
        processed++; continue;
      }
      if (text === "/help" && !isPrivate) {
        await send(bot.telegram_bot_token, msg.chat.id,
          `Mention me, reply to my messages, or just say my name to chat. Admins can use /ban /kick /mute /del /pin (reply to a user's message).`, msg.message_id);
        processed++; continue;
      }

      if (bot.status !== "active") continue;

      // In groups, respond when directly called, replied-to, on greetings,
      // when the message is a question, or when it clearly matches knowledge/group context.
      let autoKnowledge = "";
      if (isGroup) {
        const mentionedOrNamed = messageNamesBot(text, bot, me);
        const isReply = msg.reply_to_message?.from?.id === me.id;
        let shouldReply = Boolean(mentionedOrNamed || isReply);
        if (!shouldReply && isGreeting(text)) shouldReply = true;

        // Always probe the knowledge base for substantive messages — if the bot's
        // own notes cover this topic, it should jump in even without being tagged.
        const probeWorthy = text.trim().length >= 4 && !/^[\/!]/.test(text);
        if (!shouldReply && probeWorthy) {
          autoKnowledge = await ragSnippets(supabase, bot.id, text, 5, false);
          if (autoKnowledge) shouldReply = true;
        }
        if (!shouldReply && (isQuestionLike(text) || isGroupRelated(text, group, bot))) {
          shouldReply = true;
        }
        if (!shouldReply) continue;
      }

      // ----- Subscription quota + per-user rate limit -----
      try {
        const { data: usage } = await supabase.rpc("bot_usage_status", { _bot_id: bot.id });
        const u = Array.isArray(usage) ? usage[0] : usage;
        if (u && u.monthly_messages >= u.max_monthly_messages) {
          // Soft-warn the user once, but don't spam the channel.
          await send(bot.telegram_bot_token, msg.chat.id,
            `🛑 Monthly message limit reached on this workspace (${u.max_monthly_messages}). Owner needs to upgrade the plan.`,
            msg.message_id);
          processed++; continue;
        }

        // Per-user, per-bot rate limit (last 60s).
        const tgUser = msg.from?.username || msg.from?.first_name || String(msg.from?.id || "");
        if (tgUser && u?.max_msgs_per_minute) {
          const sinceIso = new Date(Date.now() - 60_000).toISOString();
          const { count: recentCount } = await supabase
            .from("bot_messages")
            .select("id", { count: "exact", head: true })
            .eq("bot_id", bot.id)
            .eq("telegram_user", tgUser)
            .gte("created_at", sinceIso);
          if ((recentCount ?? 0) > u.max_msgs_per_minute) {
            // Stay silent in groups to avoid spam; warn once in DM.
            if (isPrivate) {
              await send(bot.telegram_bot_token, msg.chat.id,
                `Slow down a sec — you're sending faster than the plan allows (${u.max_msgs_per_minute}/min).`,
                msg.message_id);
            }
            processed++; continue;
          }
        }
      } catch (e) {
        console.error("quota check failed:", (e as Error).message);
      }

      try {
        // Show "typing…" immediately so the user knows the bot is working.
        // Fire-and-forget — never block on it.
        tg(bot.telegram_bot_token, "sendChatAction", {
          chat_id: msg.chat.id, action: "typing",
        }).catch(() => {});

        const cleanText = isGroup ? stripBotName(text, bot, me) : text.trim();
        const [knowledgeResult, kExists] = await Promise.all([
          autoKnowledge ? Promise.resolve(autoKnowledge) : ragSnippets(supabase, bot.id, cleanText, 6),
          hasKnowledge(supabase, bot.id),
        ]);

        const system = buildSystemPrompt(bot, group, knowledgeResult, kExists);
        const rawReply = await askAI(system, cleanText);
        const allowedCtx = [knowledgeResult, bot.house_rules, bot.default_instructions, bot.personality]
          .filter(Boolean).join("\n");
        const reply = sanitizeReply(rawReply, allowedCtx);

        if (reply) {
          // Send the reply first, log after — don't make the user wait for the DB write.
          await send(bot.telegram_bot_token, msg.chat.id, reply, msg.message_id);
          supabase.from("bot_messages").insert({
            bot_id: bot.id, owner_id: bot.owner_id, direction: "outbound",
            content: reply, telegram_user: msg.from?.username || null,
          }).then(() => {}, () => {});
        }
      } catch (e) {
        console.error(`bot ${bot.name} reply failed:`, (e as Error).message);
      }
      processed++;
    }

    await supabase.from("bots").update({ update_offset: offset }).eq("id", bot.id);
  }

  return { bot: bot.name, processed, offset };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bots, error } = await supabase
    .from("bots")
    .select("*")
    .not("telegram_bot_token", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deadline = Date.now() + MAX_RUNTIME_MS;
  const results = await Promise.all(
    (bots || []).map((b) =>
      processBot(supabase, b, deadline).catch((e) => ({ bot: b.name, error: e.message }))
    )
  );

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
