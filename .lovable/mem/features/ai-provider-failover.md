---
name: AI provider failover
description: Shared edge helper that fails over between Lovable AI and OpenRouter on 429/402/5xx
type: feature
---
All AI chat calls in edge functions go through `supabase/functions/_shared/ai-chat.ts` (`aiChat`).
Providers are tried in order, each gated on its env key being present:
1. Lovable AI (`LOVABLE_API_KEY`) — primary
2. OpenRouter (`OPENROUTER_API_KEY`) — fallback

Failover triggers: HTTP 429, 402, or any 5xx (or thrown error). Other 4xx return immediately.
To add more providers (load balancing), append to `getProviders()` with the right `url`, `authHeader`, and `mapModel` mapping.

Model mapping for OpenRouter lives in `OPENROUTER_MODEL_MAP` (e.g. `google/gemini-3.5-flash` → `google/gemini-2.5-flash`).

Call sites updated: `telegram-poll`, `lapoe-system-bot`, `bot-playground`, `auto-knowledge-summarize`. Embeddings (`EMBED_URL`) are still Lovable-only — not yet routed through the helper.
