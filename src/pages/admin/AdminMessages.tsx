import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/dashboard/ListSkeleton";

export default function AdminMessages() {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const { data } = await supabase.from("bot_messages")
      .select("id,direction,content,telegram_user,created_at,bots(name)")
      .order("created_at", { ascending: false }).limit(200);
    setFeed(data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, (p) => {
        setFeed(prev => [p.new as any, ...prev].slice(0, 200));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="font-display text-3xl text-ink mt-1">Messages</h1>
        </div>
        <Badge variant="default" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Live</Badge>
      </div>
      <div className="border border-border/50 rounded-xl bg-card divide-y divide-border/40 max-h-[75vh] overflow-y-auto">
        {loading ? (
          <div className="p-4"><ListSkeleton rows={5} /></div>
        ) : feed.length === 0 ? (
          <div className="p-8 text-sm text-ink-soft text-center">Waiting for messages…</div>
        ) : feed.map((m: any) => (
          <div key={m.id} className="p-3 flex gap-3 items-start hover:bg-muted/20">
            <Badge variant={m.direction === "inbound" ? "secondary" : "default"} className="text-[10px] mt-0.5">{m.direction}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-ink-soft">{m.bots?.name || "—"} · {m.telegram_user || "—"} · {new Date(m.created_at).toLocaleTimeString()}</div>
              <p className="text-sm text-ink mt-0.5 break-words">{m.content}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
