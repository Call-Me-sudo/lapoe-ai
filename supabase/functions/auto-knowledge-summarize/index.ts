// Summarizes admin messages buffered in `auto_kb_buffer` into auto-generated
// knowledge_sources rows (one per bot+group). Triggered by cron or invoked
// directly with { bot_id, telegram_chat_id } to flush a single chat.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiChat } from "../_shared/ai-chat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3.5-flash";

const MIN_BUFFER_ROWS = 4;        // wait until we have at least N admin messages
const MAX_AGE_MIN = 30;            // …or flush anyway if oldest is this old
const MAX_PER_RUN = 25;            // safety cap per invocation
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;

function chunk(text: string): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
    out.push(clean.slice(i, i + CHUNK_CHARS));
  }
  return out;
}

async function summarize(existing: string, newMessages: { sender_name: string | null; content: string }[], groupTitle: string): Promise<string> {

  const formatted = newMessages
    .map((m, i) => `(${i + 1}) ${m.sender_name || "admin"}: ${m.content.replace(/\s+/g, " ").slice(0, 800)}`)
    .join("\n");

  const system = `You maintain a living knowledge base for a Telegram community called "${groupTitle}".
Your job: merge NEW admin messages into the EXISTING knowledge base, producing a clean, organized Markdown document the bot can quote when answering members.

Rules:
- Treat the admin messages as the source of truth — they come from group admins/owners only.
- Drop chit-chat, jokes, greetings, off-topic, and one-word reactions. Keep only durable, informative content (rules, announcements, FAQs, schedules, links, how-tos, policy clarifications).
- Deduplicate. If something contradicts older info, prefer the newer admin message.
- Organize with clear "##" sections (e.g. Rules, Announcements, FAQ, Links, How to…). Use bullet points and short paragraphs.
- Preserve any human-edited content in EXISTING that still seems correct.
- Never invent facts. If nothing new is informative, return the EXISTING document unchanged.
- Output the FULL updated document only. No preamble, no commentary. Max ~6000 characters.`;

  const user = `EXISTING KNOWLEDGE BASE for "${groupTitle}":
---
${existing || "(empty — this is the first version)"}
---

NEW ADMIN MESSAGES (most recent at the bottom):
${formatted}

Now output the updated knowledge base.`;

  const res = await aiChat({
    model: MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0.2,
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const out = j?.choices?.[0]?.message?.content?.trim() || "";
  return out.slice(0, 8000);
}

async function reindex(admin: any, sourceId: string, botId: string, ownerId: string, content: string) {
  await admin.from("knowledge_chunks").delete().eq("source_id", sourceId);
  const chunks = chunk(content);
  if (chunks.length === 0) {
    await admin.from("knowledge_sources").update({
      indexed_at: new Date().toISOString(), chunk_count: 0, indexing_error: "empty",
    }).eq("id", sourceId);
    return;
  }
  const rows = chunks.map((c, i) => ({
    source_id: sourceId, bot_id: botId, owner_id: ownerId,
    scope: "bot_auto", chunk_index: i, content: c,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await admin.from("knowledge_chunks").insert(batch);
    if (error) throw error;
  }
  await admin.from("knowledge_sources").update({
    indexed_at: new Date().toISOString(),
    chunk_count: chunks.length,
    indexing_error: null,
  }).eq("id", sourceId);
}

async function processOne(admin: any, bot_id: string, telegram_chat_id: string) {
  // Pull buffer rows for this (bot, chat)
  const { data: rows } = await admin.from("auto_kb_buffer")
    .select("*")
    .eq("bot_id", bot_id)
    .eq("telegram_chat_id", telegram_chat_id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (!rows || rows.length === 0) return { bot_id, telegram_chat_id, skipped: "no buffer" };

  const ownerId = rows[0].owner_id;
  const groupTitle = rows[0].group_title || "this group";

  // Existing auto source for this group
  const { data: existing } = await admin.from("knowledge_sources")
    .select("id,content")
    .eq("bot_id", bot_id)
    .eq("telegram_chat_id", telegram_chat_id)
    .eq("auto_generated", true)
    .maybeSingle();

  let updated: string;
  try {
    updated = await summarize(existing?.content || "", rows.map((r: any) => ({
      sender_name: r.sender_name, content: r.content,
    })), groupTitle);
  } catch (e) {
    return { bot_id, telegram_chat_id, error: (e as Error).message };
  }
  if (!updated) updated = existing?.content || "";

  const nowIso = new Date().toISOString();
  let sourceId = existing?.id as string | undefined;
  if (sourceId) {
    await admin.from("knowledge_sources").update({
      title: `Auto-generated · ${groupTitle}`,
      telegram_group_title: groupTitle,
      content: updated,
      auto_updated_at: nowIso,
      indexed_at: null, indexing_error: null,
    }).eq("id", sourceId);
  } else {
    const { data: ins, error } = await admin.from("knowledge_sources").insert({
      bot_id, owner_id: ownerId, scope: "bot_auto",
      kind: "text",
      title: `Auto-generated · ${groupTitle}`,
      content: updated,
      auto_generated: true,
      telegram_chat_id,
      telegram_group_title: groupTitle,
      auto_updated_at: nowIso,
    }).select("id").single();
    if (error) return { bot_id, telegram_chat_id, error: error.message };
    sourceId = ins.id;
  }

  try {
    await reindex(admin, sourceId!, bot_id, ownerId, updated);
  } catch (e) {
    await admin.from("knowledge_sources").update({ indexing_error: (e as Error).message }).eq("id", sourceId!);
  }

  // Drain consumed buffer rows
  await admin.from("auto_kb_buffer").delete().in("id", rows.map((r: any) => r.id));

  return { bot_id, telegram_chat_id, summarized: rows.length, source: sourceId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));

    let targets: { bot_id: string; telegram_chat_id: string }[] = [];
    if (body.bot_id && body.telegram_chat_id) {
      targets = [{ bot_id: body.bot_id, telegram_chat_id: body.telegram_chat_id }];
    } else {
      // Find (bot, chat) groups that are ready to flush
      const { data: g } = await admin.rpc("exec", {}).catch(() => ({ data: null }));
      // No RPC — use a SQL-ish query via from()
      const { data: groups } = await admin
        .from("auto_kb_buffer")
        .select("bot_id,telegram_chat_id,created_at")
        .order("created_at", { ascending: true })
        .limit(2000);
      const counts = new Map<string, { bot_id: string; telegram_chat_id: string; count: number; oldest: number }>();
      for (const r of groups || []) {
        const key = `${r.bot_id}::${r.telegram_chat_id}`;
        const t = Date.parse(r.created_at);
        const cur = counts.get(key);
        if (cur) { cur.count++; if (t < cur.oldest) cur.oldest = t; }
        else counts.set(key, { bot_id: r.bot_id, telegram_chat_id: r.telegram_chat_id, count: 1, oldest: t });
      }
      const ageCutoff = Date.now() - MAX_AGE_MIN * 60_000;
      targets = [...counts.values()]
        .filter(c => c.count >= MIN_BUFFER_ROWS || c.oldest <= ageCutoff)
        .slice(0, MAX_PER_RUN)
        .map(c => ({ bot_id: c.bot_id, telegram_chat_id: c.telegram_chat_id }));
    }

    const results = [];
    for (const t of targets) {
      try { results.push(await processOne(admin, t.bot_id, t.telegram_chat_id)); }
      catch (e) { results.push({ ...t, error: (e as Error).message }); }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
