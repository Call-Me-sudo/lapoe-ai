import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Users, MessageSquare, Shield, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function AdminSystemBot() {
  const [stats, setStats] = useState({ groups: 0, warns: 0, mods: 0, filters: 0, notes: 0, linked: 0 });
  const [groups, setGroups] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [g, w, m, f, n, l, gs, log] = await Promise.all([
      supabase.from("system_bot_groups").select("chat_id", { count: "exact", head: true }),
      supabase.from("system_bot_warnings").select("id", { count: "exact", head: true }),
      supabase.from("system_bot_mod_log").select("id", { count: "exact", head: true }),
      supabase.from("system_bot_filters").select("id", { count: "exact", head: true }),
      supabase.from("system_bot_notes").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).not("telegram_user_id", "is", null),
      supabase.from("system_bot_groups").select("*").order("updated_at", { ascending: false }).limit(50),
      supabase.from("system_bot_mod_log").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setStats({
      groups: g.count ?? 0, warns: w.count ?? 0, mods: m.count ?? 0,
      filters: f.count ?? 0, notes: n.count ?? 0, linked: l.count ?? 0,
    });
    setGroups(gs.data ?? []);
    setRecent(log.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (g: any, field: "is_active" | "moderation_enabled" | "anti_flood_enabled") => {
    const { error } = await supabase.from("system_bot_groups").update({ [field]: !g[field] }).eq("chat_id", g.chat_id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  const Stat = ({ icon: Icon, label, value }: any) => (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-soft"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="font-display text-3xl text-ink mt-1">{value}</div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">System bot</div>
          <h1 className="font-display text-3xl text-ink mt-1">@LaPoe_bot</h1>
          <p className="text-sm text-ink-soft mt-1">General-purpose group bot. Anyone can add it to their group.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button size="sm" asChild>
            <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open in Telegram</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Stat icon={Users} label="Groups" value={stats.groups} />
        <Stat icon={Bot} label="Linked accounts" value={stats.linked} />
        <Stat icon={Shield} label="Mod actions" value={stats.mods} />
        <Stat icon={Shield} label="Warnings" value={stats.warns} />
        <Stat icon={MessageSquare} label="Filters" value={stats.filters} />
        <Stat icon={MessageSquare} label="Notes" value={stats.notes} />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section>
          <h2 className="font-display text-xl text-ink mb-3">Groups ({groups.length})</h2>
          {loading && <div className="text-sm text-ink-soft">Loading…</div>}
          {!loading && groups.length === 0 && (
            <div className="surface-card p-8 text-center text-sm text-ink-soft">
              No groups yet. Add @LaPoe_bot to a Telegram group to get started.
            </div>
          )}
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.chat_id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink truncate">{g.title || `chat:${g.chat_id}`}</div>
                    <div className="text-xs text-ink-soft truncate">
                      <code>{g.chat_id}</code> · {g.type} · lang {g.language}
                    </div>
                  </div>
                  <Badge variant={g.is_active ? "default" : "secondary"}>{g.is_active ? "active" : "inactive"}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(g, "moderation_enabled")}>
                    Moderation: {g.moderation_enabled ? "on" : "off"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(g, "anti_flood_enabled")}>
                    Anti-flood: {g.anti_flood_enabled ? "on" : "off"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(g, "is_active")}>
                    {g.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
                {(g.rules || g.welcome_message) && (
                  <div className="mt-3 text-xs text-ink-soft space-y-1">
                    {g.welcome_message && <div>👋 <span className="line-clamp-1">{g.welcome_message}</span></div>}
                    {g.rules && <div>📜 <span className="line-clamp-1">{g.rules}</span></div>}
                    {g.banned_words?.length > 0 && <div>🚫 {g.banned_words.length} banned word(s)</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside>
          <h2 className="font-display text-xl text-ink mb-3">Recent moderation</h2>
          <div className="surface-card p-3 space-y-2">
            {recent.length === 0 && <div className="text-sm text-ink-soft p-2">No actions yet.</div>}
            {recent.map((r) => (
              <div key={r.id} className="text-xs text-ink-soft border-b border-border/40 last:border-0 pb-2 last:pb-0">
                <span className="font-medium text-ink">{r.action}</span>
                {r.target_username && <> → {r.target_username}</>}
                {r.reason && <> · {r.reason}</>}
                <div className="text-[10px] mt-0.5 opacity-70">{new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}
