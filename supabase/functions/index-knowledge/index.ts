// Chunks knowledge_sources content and stores them for full-text RAG.
// Body: { source_id: string }  (or { bot_id } to reindex all of a bot's sources)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;

function chunk(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
    out.push(clean.slice(i, i + CHUNK_CHARS));
  }
  return out;
}

async function fetchUrl(url: string): Promise<string> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(`Invalid URL: ${url}`); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http(s) URLs are supported");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Could not reach ${url}: ${(e as Error).message}`);
  }
  clearTimeout(timer);
  if (!r.ok) throw new Error(`Page returned ${r.status} ${r.statusText}`);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("text/") && !ct.includes("xml") && !ct.includes("json")) {
    throw new Error(`Unsupported content-type: ${ct}`);
  }
  const html = (await r.text()).slice(0, 1_500_000);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("Page had no readable text content");
  return text;
}

async function indexSource(supabase: any, source: any) {
  const text = source.kind === "url" && source.source_url
    ? await fetchUrl(source.source_url)
    : (source.content || "");
  const chunks = chunk(text);
  if (chunks.length === 0) {
    await supabase.from("knowledge_sources").update({
      indexed_at: new Date().toISOString(), chunk_count: 0, indexing_error: "empty",
    }).eq("id", source.id);
    return { source: source.id, chunks: 0 };
  }

  await supabase.from("knowledge_chunks").delete().eq("source_id", source.id);
  const rows = chunks.map((c, i) => ({
    source_id: source.id,
    bot_id: source.bot_id,
    owner_id: source.owner_id,
    scope: source.scope || "bot",
    chunk_index: i,
    content: c,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("knowledge_chunks").insert(batch);
    if (error) throw error;
  }
  await supabase.from("knowledge_sources").update({
    indexed_at: new Date().toISOString(),
    chunk_count: chunks.length,
    indexing_error: null,
  }).eq("id", source.id);
  return { source: source.id, chunks: chunks.length };
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    let sources: any[] = [];
    if (body.source_id) {
      const { data } = await admin.from("knowledge_sources").select("*")
        .eq("id", body.source_id).maybeSingle();
      if (data) sources = [data];
    } else if (body.bot_id) {
      const { data } = await admin.from("knowledge_sources").select("*")
        .eq("bot_id", body.bot_id);
      sources = data || [];
    } else {
      return new Response(JSON.stringify({ error: "source_id or bot_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const s of sources) {
      try {
        results.push(await indexSource(admin, s));
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from("knowledge_sources").update({ indexing_error: msg }).eq("id", s.id);
        results.push({ source: s.id, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
