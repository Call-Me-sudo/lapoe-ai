import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function AdminModeration() {
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const [{ data: mods }, { data: bots }] = await Promise.all([
      supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("bots").select("id,name"),
    ]);
    const map = new Map((bots ?? []).map((b: any) => [b.id, b.name]));
    setItems((mods ?? []).map((m: any) => ({ ...m, bot_name: map.get(m.bot_id) || "—" })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-mod-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moderation_actions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-ink-soft" />
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</div>
          <h1 className="font-display text-3xl text-ink mt-1">Moderation log</h1>
        </div>
      </div>

      {items.length === 0 && (
        <div className="surface-card p-10 text-center text-sm text-ink-soft">No moderation actions yet.</div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((m) => (
          <div key={m.id} className="surface-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">{m.action}</Badge>
                  <Badge variant={m.success ? "secondary" : "destructive"}>{m.success ? "ok" : "fail"}</Badge>
                </div>
                <div className="text-sm text-ink mt-2 truncate">{m.target_user || "—"}</div>
                <div className="text-[11px] text-ink-soft mt-0.5">on <span className="text-ink">{m.bot_name}</span> · by {m.performed_by || "system"}</div>
              </div>
              <div className="text-[10px] text-ink-soft whitespace-nowrap">{new Date(m.created_at).toLocaleTimeString()}</div>
            </div>
            {m.reason && <div className="text-xs text-ink-soft mt-2 italic">"{m.reason}"</div>}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      {items.length > 0 && (
        <div className="hidden md:block surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Bot</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Target</th>
                  <th className="text-left p-3">By</th>
                  <th className="text-left p-3">Reason</th>
                  <th className="text-left p-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="p-3 text-xs text-ink-soft whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="p-3">{m.bot_name}</td>
                    <td className="p-3 capitalize"><Badge variant="outline">{m.action}</Badge></td>
                    <td className="p-3 text-ink-soft">{m.target_user || "—"}</td>
                    <td className="p-3 text-ink-soft">{m.performed_by || "—"}</td>
                    <td className="p-3 text-ink-soft text-xs max-w-[260px] truncate">{m.reason || "—"}</td>
                    <td className="p-3"><Badge variant={m.success ? "secondary" : "destructive"}>{m.success ? "ok" : "fail"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
