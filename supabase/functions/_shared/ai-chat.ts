// Multi-provider AI chat helper with automatic failover.
// Tries providers in order; on 429/402/5xx (or missing key) falls back to the next.
// Designed to be drop-in compatible with the prior `fetch(LOVABLE_AI_URL, ...)`
// pattern: returns a `Response`-like object with .ok, .status, .text(), .json().

type Provider = {
  name: string;
  url: string;
  apiKey: string | undefined;
  mapModel: (m: string) => string;
  authHeader: (key: string) => Record<string, string>;
};

// Map "canonical" model strings (the ones we use with Lovable) to each provider.
const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "google/gemini-3.5-flash": "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash": "google/gemini-2.5-flash",
  "google/gemini-2.5-pro": "google/gemini-2.5-pro",
};

function getProviders(): Provider[] {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

  const list: Provider[] = [];
  if (lovableKey) {
    list.push({
      name: "lovable",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey: lovableKey,
      mapModel: (m) => m,
      authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
    });
  }
  if (openrouterKey) {
    list.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openrouterKey,
      mapModel: (m) => OPENROUTER_MODEL_MAP[m] || m,
      authHeader: (k) => ({
        Authorization: `Bearer ${k}`,
        "HTTP-Referer": "https://lapoe-ai.vercel.app",
        "X-Title": "LaPoe",
      }),
    });
  }
  return list;
}

export type AiChatBody = {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  [k: string]: unknown;
};

export type AiChatResult = {
  ok: boolean;
  status: number;
  provider: string;
  text: () => Promise<string>;
  json: () => Promise<any>;
  _bodyText: string;
};

async function callOne(p: Provider, body: AiChatBody): Promise<AiChatResult> {
  const payload = { ...body, model: p.mapModel(body.model) };
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...p.authHeader(p.apiKey!) },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    provider: p.name,
    _bodyText: txt,
    text: async () => txt,
    json: async () => { try { return JSON.parse(txt); } catch { return null; } },
  };
}

/**
 * Call AI chat completion, transparently falling back across providers
 * when one is rate-limited / out of credits / errors out.
 */
export async function aiChat(body: AiChatBody): Promise<AiChatResult> {
  const providers = getProviders();
  if (providers.length === 0) {
    return {
      ok: false, status: 500, provider: "none", _bodyText: "No AI providers configured",
      text: async () => "No AI providers configured",
      json: async () => ({ error: { message: "No AI providers configured" } }),
    };
  }
  let last: AiChatResult | null = null;
  for (const p of providers) {
    try {
      const r = await callOne(p, body);
      if (r.ok) return r;
      // Fall back on rate-limit, payment required, or upstream 5xx.
      if (r.status === 429 || r.status === 402 || r.status >= 500) {
        console.warn(`[ai-chat] provider=${p.name} status=${r.status}, trying next`);
        last = r;
        continue;
      }
      // Other 4xx: return immediately (likely bad request, won't fix by switching).
      return r;
    } catch (e) {
      console.warn(`[ai-chat] provider=${p.name} threw: ${(e as Error).message}`);
      last = {
        ok: false, status: 502, provider: p.name, _bodyText: (e as Error).message,
        text: async () => (e as Error).message,
        json: async () => ({ error: { message: (e as Error).message } }),
      };
    }
  }
  return last!;
}
