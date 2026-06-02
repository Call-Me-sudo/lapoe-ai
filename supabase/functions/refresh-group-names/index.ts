// Refreshes Telegram group titles & member counts for the calling owner.
// Uses each bot's stored telegram_bot_token to call Telegram getChat.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    const userId = claimsRes?.claims?.sub;
    if (claimsErr || !userId) return json({ error: "unauthorized" }, 401);
    const user = { id: userId };

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: groups } = await admin
      .from("telegram_groups")
      .select("id, telegram_chat_id, bot_id, name, bots(telegram_bot_token)")
      .eq("owner_id", user.id);

    let updated = 0;
    for (const g of groups ?? []) {
      const token = (g as any).bots?.telegram_bot_token;
      if (!token || !g.telegram_chat_id) continue;
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: g.telegram_chat_id }),
        });
        const j = await r.json();
        if (!j.ok) continue;
        const title = j.result?.title || j.result?.first_name || g.name;
        const member_count = j.result?.members_count ?? undefined;

        const patch: Record<string, unknown> = {};
        if (title && title !== g.name) patch.name = title;
        if (typeof member_count === "number") patch.member_count = member_count;
        if (Object.keys(patch).length > 0) {
          await admin.from("telegram_groups").update(patch).eq("id", g.id);
          updated++;
        }
      } catch {
        // ignore single-group failure
      }
    }

    return json({ ok: true, refreshed: updated, total: groups?.length ?? 0 });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
