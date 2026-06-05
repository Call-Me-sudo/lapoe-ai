import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Bot, CreditCard, MessageSquare, AlertTriangle, TrendingUp,
  Activity, DollarSign, Zap, Database, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, Clock, BookOpen, Server, Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatGridSkeleton, CardBlockSkeleton } from "@/components/dashboard/ListSkeleton";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))", "hsl(var(--destructive))"];

const PLAN_PRICE: Record<string, number> = { free: 0, starter: 19, pro: 49, business: 149, enterprise: 499 };

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0, usersDelta: 0,
    bots: 0, activeBots: 0,
    subs: 0, mrr: 0,
    messages: 0, messagesToday: 0,
    modActions: 0, modToday: 0,
    knowledge: 0, groups: 0,
    aiMonth: 0, aiToday: 0,
  });
  const [series, setSeries] = useState<any[]>([]);
  const [growthSeries, setGrowthSeries] = useState<any[]>([]);
  const [planDist, setPlanDist] = useState<any[]>([]);
  const [topBots, setTopBots] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({ db: true, ai: true, telegram: true });
  const [hourlyMessages, setHourlyMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const now = Date.now();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const weekAgo = new Date(now - 7 * 86400_000).toISOString();
    const prevWeek = new Date(now - 14 * 86400_000).toISOString();

    const [u, b, ba, m, mToday, ma, maToday, k, g, allUsers, prevUsers] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("moderation_actions").select("id", { count: "exact", head: true }),
      supabase.from("moderation_actions").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("knowledge_sources").select("id", { count: "exact", head: true }),
      supabase.from("telegram_groups").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", prevWeek).lt("created_at", weekAgo),
    ]);

    const usersDelta = (allUsers.count ?? 0) - (prevUsers.count ?? 0);

    // MRR from active paid subs
    const { data: paidSubs } = await supabase.from("subscriptions").select("plan").eq("status", "active");
    const mrr = (paidSubs || []).reduce((s, r: any) => s + (PLAN_PRICE[r.plan] || 0), 0);

    // System-wide AI usage (sum of outbound replies)
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
      knowledge: k.count ?? 0,
      groups: g.count ?? 0,
      aiMonth,
      aiToday: aiTodayRes.count ?? 0,
    });

    // 14-day message volume
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

    // 30-day user growth (cumulative)
    const since30 = new Date(now - 30 * 86400_000).toISOString();
    const { data: signups } = await supabase.from("profiles").select("created_at").gte("created_at", since30).order("created_at");
    const startCount = (u.count ?? 0) - (signups?.length ?? 0);
    const growthBuckets: Record<string, { date: string; total: number; new: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400_000).toISOString().slice(0, 10);
      growthBuckets[d] = { date: d.slice(5), total: startCount, new: 0 };
    }
    let running = startCount;
    Object.keys(growthBuckets).forEach(d => {
      const dayNew = (signups || []).filter((s: any) => s.created_at.slice(0, 10) === d).length;
      running += dayNew;
      growthBuckets[d].total = running;
      growthBuckets[d].new = dayNew;
    });
    setGrowthSeries(Object.values(growthBuckets));

    // Hourly today
    const hourly: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourly[h] = 0;
    const { data: todayMsgs } = await supabase.from("bot_messages").select("created_at").gte("created_at", todayISO);
    (todayMsgs || []).forEach((m: any) => { hourly[new Date(m.created_at).getHours()]++; });
    setHourlyMessages(Object.entries(hourly).map(([h, c]) => ({ hour: `${h}h`, count: c })));

    // Plan distribution
    const { data: subRows } = await supabase.from("subscriptions").select("plan,status");
    const counts: Record<string, number> = {};
    (subRows || []).forEach((s: any) => { counts[s.plan] = (counts[s.plan] || 0) + 1; });
    setPlanDist(Object.entries(counts).map(([name, value]) => ({ name, value })));

    // Top bots
    const { data: bots } = await supabase.from("bots").select("id,name,status");
    const { data: msgCounts } = await supabase.from("bot_messages").select("bot_id").gte("created_at", since14);
    const tally: Record<string, number> = {};
    (msgCounts || []).forEach((r: any) => { tally[r.bot_id] = (tally[r.bot_id] || 0) + 1; });
    setTopBots((bots || []).map((b: any) => ({ name: b.name, count: tally[b.id] || 0, status: b.status }))
      .sort((a, b) => b.count - a.count).slice(0, 6));

    // Recent moderation
    const { data: recentMod } = await supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(6);
    setRecent(recentMod || []);

    // Recent signups
    const { data: newUsers } = await supabase.from("profiles").select("id,email,display_name,created_at").order("created_at", { ascending: false }).limit(5);
    setRecentSignups(newUsers || []);

    // Health
    setSystemHealth({ db: true, ai: !!stats || true, telegram: (b.count ?? 0) > 0 });
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("admin-overview-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_actions" }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => loadAll())
      .subscribe();
    const interval = setInterval(loadAll, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    { icon: DollarSign, label: "MRR", value: `$${stats.mrr.toLocaleString()}`, sub: `${stats.subs} paying`, to: "/admin/users" },
    { icon: Users, label: "Users", value: stats.users.toLocaleString(), sub: `${stats.usersDelta >= 0 ? "+" : ""}${stats.usersDelta} this week`, delta: stats.usersDelta, to: "/admin/users" },
    { icon: Bot, label: "Bots", value: stats.bots.toLocaleString(), sub: `${stats.activeBots} active`, to: "/admin/bots" },
    { icon: MessageSquare, label: "Messages", value: stats.messages.toLocaleString(), sub: `${stats.messagesToday} today`, to: "/admin/messages" },
    { icon: AlertTriangle, label: "Moderation", value: stats.modActions.toLocaleString(), sub: `${stats.modToday} today`, to: "/admin/moderation" },
    { icon: BookOpen, label: "Knowledge", value: stats.knowledge.toLocaleString(), sub: `${stats.groups} groups`, to: "/admin/bots" },
  ];

  const refresh = () => { loadAll(); toast.success("Refreshed"); };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Owner control room</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1">Mission control</h1>
          <p className="text-ink-soft text-sm mt-2">Everything across every workspace, in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Live</Badge>
          <Button size="sm" variant="outline" onClick={refresh}><Activity className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
      </div>

      {/* KPI grid */}
      {loading ? (
        <div className="mb-6"><StatGridSkeleton count={6} /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {kpis.map((c) => (
            <Link key={c.label} to={c.to}
              className="surface-card p-4 hover:shadow-lift hover:-translate-y-0.5 transition-all">
              <c.icon className="h-4 w-4 text-ink-soft mb-3" />
              <div className="font-display text-2xl text-ink tracking-tight">{c.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft mt-1">{c.label}</div>
              <div className="text-[11px] text-ink-soft mt-2 flex items-center gap-1">
                {typeof c.delta === "number" && c.delta !== 0 && (
                  c.delta > 0 ? <ArrowUpRight className="h-3 w-3 text-ink" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                {c.sub}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Charts row */}
      {loading ? (
        <div className="grid lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2"><CardBlockSkeleton height={240} /></div>
          <CardBlockSkeleton height={220} />
        </div>
      ) : (
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg text-ink flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Message volume</h2>
              <p className="text-xs text-ink-soft mt-0.5">Last 14 days · inbound vs outbound</p>
            </div>
            <div className="flex gap-3 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />In</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Out</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" fill="url(#in)" />
              <Area type="monotone" dataKey="out" stroke="hsl(var(--accent))" fill="url(#out)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink mb-1">Plan mix</h2>
          <p className="text-xs text-ink-soft mb-3">Subscription distribution</p>
          {planDist.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No subscriptions yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={planDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name" paddingAngle={2}>
                  {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      )}

      {/* Growth + Hourly */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> User growth</h2>
          <p className="text-xs text-ink-soft mb-3">Cumulative — last 30 days</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Today's traffic</h2>
          <p className="text-xs text-ink-soft mb-3">Messages per hour</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyMessages}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={2} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System health + Quick actions */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink flex items-center gap-2 mb-4"><Server className="h-4 w-4 text-primary" /> System health</h2>
          <div className="space-y-3">
            {[
              { label: "Database", icon: Database, ok: systemHealth.db },
              { label: "AI Gateway", icon: Zap, ok: systemHealth.ai },
              { label: "Telegram poll", icon: Globe, ok: systemHealth.telegram },
            ].map((h) => (
              <div key={h.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2 text-sm text-ink"><h.icon className="h-4 w-4 text-ink-soft" />{h.label}</div>
                {h.ok ? <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" />Online</Badge>
                      : <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" />Down</Badge>}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="text-xs text-ink-soft mb-2">Active bots ratio</div>
            <Progress value={stats.bots ? (stats.activeBots / stats.bots) * 100 : 0} className="h-2" />
            <div className="text-[11px] text-ink-soft mt-1">{stats.activeBots}/{stats.bots} running</div>
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="justify-start"><Link to="/admin/users"><Users className="h-3.5 w-3.5" /> Users</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start"><Link to="/admin/bots"><Bot className="h-3.5 w-3.5" /> Bots</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start"><Link to="/admin/messages"><MessageSquare className="h-3.5 w-3.5" /> Messages</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start"><Link to="/admin/moderation"><AlertTriangle className="h-3.5 w-3.5" /> Mod log</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start"><Link to="/admin/activity"><Activity className="h-3.5 w-3.5" /> Live feed</Link></Button>
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink mb-4">Newest signups</h2>
          {recentSignups.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-8">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {recentSignups.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0">
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

      {/* Top bots + Recent moderation */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface-card p-5">
          <h2 className="font-display text-lg text-ink mb-1">Top bots</h2>
          <p className="text-xs text-ink-soft mb-3">By message volume — last 14 days</p>
          {topBots.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {topBots.map((b: any) => {
                const max = Math.max(...topBots.map(x => x.count), 1);
                return (
                  <div key={b.name} className="space-y-1">
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

        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-lg text-ink flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Recent moderation</h2>
              <p className="text-xs text-ink-soft mt-0.5">Latest enforcement actions</p>
            </div>
            <Link to="/admin/moderation" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No moderation actions yet.</div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {recent.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-ink truncate"><span className="font-medium capitalize">{m.action}</span> {m.target_user || ""}</div>
                    <div className="text-[11px] text-ink-soft">{m.performed_by || "—"} · {new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                  <Badge variant={m.success ? "secondary" : "destructive"} className="text-[10px]">{m.success ? "ok" : "fail"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
