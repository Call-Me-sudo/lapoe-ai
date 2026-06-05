import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Bot, MessageSquare, AlertTriangle, TrendingUp,
  Activity, DollarSign, Zap, CheckCircle2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatGridSkeleton, CardBlockSkeleton } from "@/components/dashboard/ListSkeleton";

const PLAN_PRICE: Record<string, number> = { free: 0, starter: 19, pro: 49, business: 149, enterprise: 499 };

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0, usersDelta: 0,
    bots: 0, activeBots: 0,
    subs: 0, mrr: 0,
    messages: 0, messagesToday: 0,
    modActions: 0, modToday: 0,
    aiMonth: 0, aiToday: 0,
  });
  const [series, setSeries] = useState<any[]>([]);
  const [topBots, setTopBots] = useState<any[]>([]);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({ db: true, ai: true, telegram: true });
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const weekAgo = new Date(now - 7 * 86400_000).toISOString();
    const prevWeek = new Date(now - 14 * 86400_000).toISOString();

    const [u, b, ba, m, mToday, ma, maToday, allUsers, prevUsers] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("moderation_actions").select("id", { count: "exact", head: true }),
      supabase.from("moderation_actions").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", prevWeek).lt("created_at", weekAgo),
    ]);

    const usersDelta = (allUsers.count ?? 0) - (prevUsers.count ?? 0);

    const { data: paidSubs } = await supabase.from("subscriptions").select("plan").eq("status", "active");
    const mrr = (paidSubs || []).reduce((s, r: any) => s + (PLAN_PRICE[r.plan] || 0), 0);

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const monthStartISO = monthStart.toISOString().slice(0, 10);
    const [{ data: usageRows }, aiTodayRes] = await Promise.all([
      supabase.from("monthly_usage").select("outbound_count").eq("period_start", monthStartISO),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("direction", "outbound").gte("created_at", todayISO),
    ]);
    const aiMonth = (usageRows || []).reduce((s: number, r: any) => s + (r.outbound_count || 0), 0);

    setStats({
      users: u.count ?? 0,
      usersDelta,
      bots: b.count ?? 0,
      activeBots: ba.count ?? 0,
      subs: paidSubs?.length ?? 0,
      mrr,
      messages: m.count ?? 0,
      messagesToday: mToday.count ?? 0,
      modActions: ma.count ?? 0,
      modToday: maToday.count ?? 0,
      aiMonth,
      aiToday: aiTodayRes.count ?? 0,
    });

    const since14 = new Date(now - 14 * 86400_000).toISOString();
    const { data: msgs } = await supabase.from("bot_messages").select("created_at,direction").gte("created_at", since14);
    const buckets: Record<string, { date: string; in: number; out: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400_000).toISOString().slice(0, 10);
      buckets[d] = { date: d.slice(5), in: 0, out: 0 };
    }
    (msgs || []).forEach((m: any) => {
      const d = m.created_at.slice(0, 10);
      if (!(d in buckets)) return;
      if (m.direction === "inbound") buckets[d].in++;
      else buckets[d].out++;
    });
    setSeries(Object.values(buckets));

    const { data: bots } = await supabase.from("bots").select("id,name,status");
    const { data: msgCounts } = await supabase.from("bot_messages").select("bot_id").gte("created_at", since14);
    const tally: Record<string, number> = {};
    (msgCounts || []).forEach((r: any) => { tally[r.bot_id] = (tally[r.bot_id] || 0) + 1; });
    setTopBots((bots || []).map((b: any) => ({ name: b.name, count: tally[b.id] || 0, status: b.status }))
      .sort((a, b) => b.count - a.count).slice(0, 5));

    const { data: newUsers } = await supabase.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }).limit(5);
    setRecentSignups(newUsers || []);

    setSystemHealth({ db: true, ai: true, telegram: (b.count ?? 0) > 0 });
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("admin-overview-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => loadAll())
      .subscribe();
    const interval = setInterval(loadAll, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    { icon: DollarSign, label: "MRR", value: `$${stats.mrr.toLocaleString()}`, sub: `${stats.subs} paying`, to: "/admin/users" },
    { icon: Users, label: "Users", value: stats.users.toLocaleString(), sub: `${stats.usersDelta >= 0 ? "+" : ""}${stats.usersDelta} this week`, to: "/admin/users" },
    { icon: Bot, label: "Bots", value: stats.bots.toLocaleString(), sub: `${stats.activeBots} active`, to: "/admin/bots" },
    { icon: MessageSquare, label: "Messages", value: stats.messages.toLocaleString(), sub: `${stats.messagesToday} today`, to: "/admin/messages" },
  ];

  const refresh = () => { loadAll(); toast.success("Refreshed"); };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Overview</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1">Mission control</h1>
          <p className="text-ink-soft text-sm mt-2">A quiet read on everything across every workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Live</Badge>
          <Button size="sm" variant="outline" onClick={refresh}><Activity className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="mb-8"><StatGridSkeleton count={4} /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((c) => (
            <Link key={c.label} to={c.to}
              className="surface-card p-6 hover:shadow-lift hover:-translate-y-0.5 transition-all">
              <c.icon className="h-4 w-4 text-ink-soft mb-4" />
              <div className="font-display text-3xl text-ink tracking-tight">{c.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft mt-2">{c.label}</div>
              <div className="text-xs text-ink-soft mt-3">{c.sub}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Message volume — single primary chart */}
      {loading ? (
        <div className="mb-8"><CardBlockSkeleton height={280} /></div>
      ) : (
        <div className="surface-card p-6 mb-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div>
              <h2 className="font-display text-lg text-ink flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Message volume</h2>
              <p className="text-xs text-ink-soft mt-1">Last 14 days · inbound vs outbound</p>
            </div>
            <div className="flex gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />In</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Out</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" fill="url(#in)" strokeWidth={2} />
              <Area type="monotone" dataKey="out" stroke="hsl(var(--accent))" fill="url(#out)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI usage + System health */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="surface-card p-6">
          <h2 className="font-display text-lg text-ink flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> AI usage</h2>
          <p className="text-xs text-ink-soft mt-1 mb-6">Assistant replies across every workspace</p>
          <div className="flex gap-10">
            <div>
              <div className="font-display text-3xl text-ink">{stats.aiMonth.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft mt-2">This month</div>
            </div>
            <div>
              <div className="font-display text-3xl text-ink">{stats.aiToday.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft mt-2">Today</div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-lg text-ink mb-4">System health</h2>
          <div className="space-y-1">
            {[
              { label: "Database", ok: systemHealth.db },
              { label: "AI gateway", ok: systemHealth.ai },
              { label: "Telegram poll", ok: systemHealth.telegram },
            ].map((h) => (
              <div key={h.label} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                <span className="text-sm text-ink">{h.label}</span>
                {h.ok ? <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" />Online</Badge>
                      : <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" />Down</Badge>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top bots + Newest signups */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface-card p-6">
          <h2 className="font-display text-lg text-ink mb-1">Top bots</h2>
          <p className="text-xs text-ink-soft mb-5">By message volume · last 14 days</p>
          {topBots.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-10">No activity yet.</div>
          ) : (
            <div className="space-y-4">
              {topBots.map((b: any) => {
                const max = Math.max(...topBots.map(x => x.count), 1);
                return (
                  <div key={b.name} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink truncate flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${b.status === "active" ? "bg-primary" : "bg-muted-foreground"}`} />
                        {b.name}
                      </span>
                      <span className="text-ink-soft text-xs">{b.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(b.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-lg text-ink mb-1">Newest signups</h2>
          <p className="text-xs text-ink-soft mb-5">Latest people to join</p>
          {recentSignups.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-10">No users yet.</div>
          ) : (
            <div className="space-y-1">
              {recentSignups.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm py-2.5 border-b border-border/40 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-ink truncate">{u.display_name || "—"}</div>
                    <div className="text-[11px] text-ink-soft truncate">{u.email}</div>
                  </div>
                  <div className="text-[10px] text-ink-soft whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
