import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Trash2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function AdminBots() {
  const [bots, setBots] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (b: any) => {
    const next = b.status === "active" ? "paused" : "active";
    await supabase.from("bots").update({ status: next }).eq("id", b.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete bot? All data goes with it.")) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</div>
        <h1 className="font-display text-3xl text-ink mt-1">Bots ({bots.length})</h1>
      </div>

      {bots.length === 0 && (
        <div className="surface-card p-10 text-center text-sm text-ink-soft">No bots yet.</div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {bots.map((b) => (
          <div key={b.id} className="surface-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink truncate">{b.name}</div>
                <div className="text-xs text-ink-soft truncate">@{b.bot_username || "—"}</div>
              </div>
              <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-soft">
              <span className="capitalize">tone · {b.tone || "friendly"}</span>
              <span>token · {b.telegram_bot_token ? "✓" : "—"}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toggle(b)}>
                {b.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(b.id); toast.success("Bot ID copied"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {b.bot_username && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://t.me/${b.bot_username}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      {bots.length > 0 && (
        <div className="hidden md:block surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left p-3">Bot</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Tone</th>
                <th className="text-left p-3">Token</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {bots.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium text-ink">{b.name}</div>
                    <div className="text-xs text-ink-soft">@{b.bot_username || "—"}</div>
                  </td>
                  <td className="p-3"><Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge></td>
                  <td className="p-3 capitalize text-ink-soft">{b.tone || "friendly"}</td>
                  <td className="p-3 text-xs text-ink-soft">{b.telegram_bot_token ? "✓" : "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => toggle(b)}>
                        {b.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
