import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, MessageSquare, Shield, Bot, UserPlus } from "lucide-react";

type Evt = { kind: "msg" | "mod" | "bot" | "user"; at: number; payload: any };

const ICON = (k: string) => {
  const cls = "h-3.5 w-3.5 text-ink-soft";
  switch (k) {
    case "msg": return <MessageSquare className={cls} />;
    case "mod": return <Shield className={cls} />;
    case "bot": return <Bot className={cls} />;
    case "user": return <UserPlus className={cls} />;
    default: return <Activity className={cls} />;
  }
};

const summary = (e: Evt) => {
  const p = e.payload || {};
  switch (e.kind) {
    case "msg": return `${p.direction === "inbound" ? "From" : "To"} ${p.telegram_user || "system"}: ${p.content ?? ""}`;
    case "mod": return `${(p.action || "").toUpperCase()} ${p.target_user || ""} by ${p.performed_by || "system"}`;
    case "bot": return `Bot "${p.name ?? "?"}" · status: ${p.status ?? "?"}`;
    case "user": return `New signup: ${p.email ?? p.display_name ?? p.id}`;
  }
};

export default function AdminActivity() {
  const [events, setEvents] = useState<Evt[]>([]);

  useEffect(() => {
    // Preload recent events so the page isn't empty
    (async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [{ data: msgs }, { data: mods }, { data: users }] = await Promise.all([
        supabase.from("bot_messages").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(40),
        supabase.from("moderation_actions").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(40),
        supabase.from("profiles").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(20),
      ]);
      const merged: Evt[] = [
        ...(msgs ?? []).map((p: any) => ({ kind: "msg" as const, at: new Date(p.created_at).getTime(), payload: p })),
        ...(mods ?? []).map((p: any) => ({ kind: "mod" as const, at: new Date(p.created_at).getTime(), payload: p })),
        ...(users ?? []).map((p: any) => ({ kind: "user" as const, at: new Date(p.created_at).getTime(), payload: p })),
      ].sort((a, b) => b.at - a.at).slice(0, 100);
      setEvents(merged);
    })();

    const ch = supabase.channel("admin-activity-firehose")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, (p) =>
        setEvents(prev => [{ kind: "msg" as const, at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moderation_actions" }, (p) =>
        setEvents(prev => [{ kind: "mod" as const, at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "*", schema: "public", table: "bots" }, (p) =>
        setEvents(prev => [{ kind: "bot" as const, at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (p) =>
        setEvents(prev => [{ kind: "user" as const, at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Activity className="h-5 w-5 text-ink-soft" />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</div>
          <h1 className="font-display text-3xl text-ink mt-1">Live activity</h1>
        </div>
        <Badge variant="default" className="gap-1.5 ml-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Streaming
        </Badge>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="divide-y divide-border/40 max-h-[78vh] overflow-y-auto">
          {events.length === 0 && (
            <div className="p-10 text-center text-ink-soft text-sm">Waiting for live events…</div>
          )}
          {events.map((e, i) => (
            <div key={i} className="p-3 sm:p-4 flex gap-3 items-start hover:bg-muted/10 transition-colors">
              <div className="p-2 rounded-full bg-muted/40 shrink-0">{ICON(e.kind)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-ink uppercase tracking-wider">{e.kind}</span>
                  <span className="text-[10px] text-ink-soft">{new Date(e.at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-ink-soft mt-1 line-clamp-2 leading-relaxed break-words">
                  {summary(e)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
