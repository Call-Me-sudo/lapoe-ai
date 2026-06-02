// Detect Telegram Mini App context and auto-link the Telegram identity to the
// signed-in LaPoe profile. Safe to call on any page after auth.
import { supabase } from "@/integrations/supabase/client";

export function getTelegramInitData(): string | null {
  // @ts-expect-error - Telegram injects window.Telegram
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  return tg?.initData || null;
}

export async function autoLinkTelegramIfPossible(): Promise<{ linked: boolean; username?: string } | null> {
  const initData = getTelegramInitData();
  if (!initData) return null;
  try {
    const { data, error } = await supabase.functions.invoke("telegram-link-init", { body: { initData } });
    if (error) return { linked: false };
    return { linked: true, username: data?.telegram?.username };
  } catch {
    return { linked: false };
  }
}
