// Bot Playground — preview chat for owners on the website.
// - Verifies the caller's JWT and confirms they own the bot.
// - Reuses the bot's tone/persona/rules/knowledge so the preview matches
//   real Telegram behavior.
// - Does NOT write to bot_messages, so it never consumes the monthly quota.
// - Rate-limited per user (in-memory) to prevent runaway calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const TONES: Record<string, string> = {
  friendly: "Warm, casual, like a helpful community member. Contractions OK. Short sentences. No corporate fluff.",
  professional: "Clear, courteous, business-appropriate. No emoji unless the user uses them first.",
  witty: "Dry, clever, a little playful. Keep it short. Land the joke and move on.",
  strict: "Direct and rule-focused. Short. No padding. Cite the rule when enforcing.",
  hype: "High-energy community vibe. A few emoji are fine. Keep it real, never spammy.",
};

// Per-user sliding-window rate limit (per warm instance).
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const MAX_PER_WINDOW = 60;          // 60 preview messages / hour / user

function rateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const times = (buckets.get(userId) ?? []).filter(t => t > now - WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    buckets.set(userId, times);
    return { allowed: false, remaining: 0 };
  }
  times.push(now);
  buckets.set(userId, times);
  return { allowed: true, remaining: MAX_PER_WINDOW - times.length };
}

async function ragSnippets(supabase: any, botId: string, question: string, k = 6): Promise<string> {
  const q = (question || "").trim();
  if (!q) return "";
  const { data } = await supabase.rpc("match_knowledge_chunks_text", {
    _bot_id: botId, _query: q, _match_count: k,
  });
  if (!data || data.length === 0) return "";
  return data.map((r: any, i: number) => `[${i + 1}] ${r.content}`).join("\n\n").slice(0, 6000);
}

function buildSystemPrompt(bot: any, knowledge: string): string {
  const tone = TONES[bot.tone] || TONES.friendly;
  const persona = bot.personality || "";
  const houseRules = bot.house_rules ? `\nHouse rules to follow:\n${bot.house_rules}` : "";
  const customInstr = bot.default_instructions ? `\n\nOwner instructions:\n${bot.default_instructions}` : "";
  const hasKnowledge = !!knowledge;
  const knowledgeBlock = hasKnowledge
    ? `\n\n=== KNOWLEDGE BASE (authoritative) ===\n${knowledge}\n=== END KNOWLEDGE ===`
    : "";

  return `You are *${bot.name}*, a Telegram community bot. The user is previewing you from a web playground.

Tone: ${tone}
${persona ? `Character: ${persona}\n` : ""}You are in a private chat.${houseRules}${customInstr}${knowledgeBlock}

STRICT SCOPE RULES — follow these above all else:
- You exist ONLY to help with topics related to this bot's community/persona${hasKnowledge ? " and the KNOWLEDGE BASE above" : ""}.
- DO NOT answer general-knowledge questions (politics, world facts, trivia, celebrities, geography, history, coding help, math, etc.) unless they are explicitly covered ${hasKnowledge ? "in the knowledge base" : "by the owner instructions or house rules"}.
- If a question is outside your scope, politely decline in ONE short line and redirect to what you can help with. Example: "That's outside what I'm here for — I can help with <topic>."
- Never invent facts. If the knowledge base doesn't cover it, say you don't have that info.
${hasKnowledge ? "- Ground every factual answer in the knowledge above. Paraphrase naturally — do not quote source numbers.\n" : ""}
Reply rules:
- Sound like a real person, not an AI assistant. NEVER say "as an AI" or "I'm just an AI".
- ALWAYS reply in the same language the user wrote in.
- Match the user's energy and length. One-liners get one-liners.
- Never apologize unprompted. Keep replies under 4 short sentences unless asked for detail.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Identify caller
  const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "invalid auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userRes.user.id;

  // Rate limit
  const rl = rateLimit(userId);
  if (!rl.allowed) {
    return new Response(JSON.stringify({
      error: "Playground limit reached — try again in an hour. This is a preview cap and doesn't affect your plan.",
    }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botId = String(body?.bot_id || "");
  const messages: Array<{ role: string; content: string }> = Array.isArray(body?.messages) ? body.messages : [];
  if (!botId || messages.length === 0) {
    return new Response(JSON.stringify({ error: "bot_id and messages required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Confirm ownership
  const { data: bot, error: botErr } = await supabase
    .from("bots").select("*").eq("id", botId).eq("owner_id", userId).maybeSingle();
  if (botErr || !bot) {
    return new Response(JSON.stringify({ error: "bot not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build prompt using latest user message for RAG
  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const knowledge = await ragSnippets(supabase, bot.id, lastUser);
  const system = buildSystemPrompt(bot, knowledge);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiRes = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        ...messages.slice(-12).map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, 4000),
        })),
      ],
    }),
  });

  if (aiRes.status === 429) {
    return new Response(JSON.stringify({ error: "AI is rate-limiting requests. Try again in a moment." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (aiRes.status === 402) {
    return new Response(JSON.stringify({ error: "AI credits exhausted for this workspace." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await aiRes.json();
  if (!aiRes.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || "AI error" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || "";
  return new Response(JSON.stringify({ reply, remaining: rl.remaining }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
