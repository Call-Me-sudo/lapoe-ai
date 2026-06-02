import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Bot, Users, MessageSquare, BookOpen, Inbox, Ticket, Activity,
  CheckCircle2, AlertTriangle, Link2, ChevronRight, BarChart3, TrendingUp,
  Library, ArrowUpRight, Zap, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Stats = { bots: number; groups: number; messages: number; knowledge: number };
type Usage = {
  plan: string;
  current_bots: number;
  max_bots: number;
  monthly_messages: number;
  max_monthly_messages: number;
};
type RecentMsg = {
  id: string;
  created_at: string;
  direction: string | null;
};

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ bots: 0, groups: 0, messages: 0, knowledge: 0 });
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recent, setRecent] = useState<RecentMsg[]>([]);
  const [unanswered, setUnanswered] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sinceISO = new Date(Date.now() - 29 * 86400000).toISOString();
      const [b, g, m, k, usageRows, recentMsgs, unansweredRes] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        (supabase as unknown as { rpc: (n: string) => Promise<{ data: Usage[] | null }> }).rpc("my_workspace_usage"),
        supabase.from("bot_messages")
          .select("id, created_at, direction")
          .eq("owner_id", user.id)
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("bot_messages")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("direction", "inbound")
          .gte("created_at", sinceISO),
      ]);
      setStats({ bots: b.count ?? 0, groups: g.count ?? 0, messages: m.count ?? 0, knowledge: k.count ?? 0 });
      setUsage(Array.isArray(usageRows.data) ? usageRows.data[0] ?? null : null);
      setRecent((recentMsgs.data as RecentMsg[] | null) ?? []);
      setUnanswered(unansweredRes.count ?? 0);
    })();
  }, [user]);

  // Build last 30-day chart
  const chartData = useMemo(() => {
    const days: { day: string; inbound: number; outbound: number; label: string }[] = [];
    const map: Record<string, { inbound: number; outbound: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      map[key] = { inbound: 0, outbound: 0 };
      const label = i % 4 === 0 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
      days.push({ day: key, inbound: 0, outbound: 0, label });
    }
    recent.forEach((m) => {
      const key = (m.created_at || "").slice(0, 10);
      if (!map[key]) return;
      if (m.direction === "inbound") map[key].inbound += 1;
      else map[key].outbound += 1;
    });
    return days.map((d) => ({ ...d, inbound: map[d.day].inbound, outbound: map[d.day].outbound }));
  }, [recent]);

  const totalInbound = chartData.reduce((s, d) => s + d.inbound, 0);
  const totalOutbound = chartData.reduce((s, d) => s + d.outbound, 0);
  const resolutionRate = totalInbound > 0 ? Math.round((totalOutbound / totalInbound) * 100) : 0;

  const quickActions = [
    { icon: MessageSquare, label: "Live conversations", value: `${stats.groups} connected`, to: "/dashboard/messages" },
    { icon: Inbox, label: "Inbound questions", value: `${unanswered} this month`, to: "/dashboard/messages" },
    { icon: Bot, label: "LaPoe AI agent", value: `${stats.bots} active`, to: "/dashboard/bots" },
    { icon: BookOpen, label: "Knowledge sources", value: `${stats.knowledge} indexed`, to: "/dashboard/knowledge" },
    { icon: Users, label: "Telegram groups", value: `${stats.groups} linked`, to: "/dashboard/groups" },
  ];

  const projectStatus = [
    { icon: Bot, label: "Bot workspace", sub: user?.email ?? "", state: stats.bots > 0 ? "ok" : "warn" },
    { icon: BookOpen, label: "Knowledge base", sub: stats.knowledge > 0 ? "Indexed and ready" : "Add your first source", state: stats.knowledge > 0 ? "ok" : "warn" },
    { icon: Link2, label: "Telegram groups", sub: stats.groups > 0 ? `${stats.groups} connected` : "Connect a group", state: stats.groups > 0 ? "ok" : "warn" },
  ];

  return (
    <DashboardLayout>
      {/* Top banner */}
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
        <Library className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-ink flex-1">
          LaPoe can answer in 40+ languages and learn from your blogs. Add more knowledge to boost reply quality.
        </p>
        <Button asChild size="sm" variant="default" className="hidden sm:inline-flex">
          <Link to="/dashboard/knowledge">Add knowledge</Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        {/* LEFT column */}
        <div className="min-w-0 space-y-5">
          {/* Quick actions */}
          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Quick actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 hover:border-primary/40 hover:shadow-soft transition"
                >
                  <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <a.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{a.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.value}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </Link>
              ))}
            </div>
          </section>

          {/* Performance */}
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-ink">Performance</h3>
              </div>
              <span className="text-xs text-muted-foreground">Last 30 days</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <Metric label="Inbound" value={totalInbound} hint="Questions received" />
              <Metric label="Replies" value={totalOutbound} hint="Sent by LaPoe" />
              <Metric label="Resolution rate" value={`${resolutionRate}%`} hint="Replied / inbound" />
            </div>

            <div className="px-2 py-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={0}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="inbound" fill="hsl(var(--muted-foreground) / 0.4)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="outbound" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* News / tips */}
          <section>
            <h3 className="text-sm font-semibold text-ink mb-3">Tips & updates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Library, title: "Train LaPoe on your blog", body: "Paste a URL — LaPoe will index and cite it.", to: "/dashboard/knowledge", cta: "Add a source" },
                { icon: Activity, title: "See replies in real time", body: "Every reply is logged with full context.", to: "/dashboard/messages", cta: "Open inbox" },
                { icon: TrendingUp, title: "Scale your community", body: "Upgrade to lift bot and message limits.", to: "/pricing", cta: "See plans" },
              ].map((c) => (
                <Link
                  key={c.title}
                  to={c.to}
                  className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition flex flex-col"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center mb-3">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-ink">{c.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.body}</p>
                  <span className="text-xs text-primary mt-3 inline-flex items-center gap-1 group-hover:underline">
                    {c.cta} <ArrowUpRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT column */}
        <aside className="space-y-5 min-w-0">
          {/* Project status */}
          <section className="rounded-lg border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-ink">Project status</h3>
            </div>
            <ul className="divide-y divide-border">
              {projectStatus.map((p) => (
                <li key={p.label} className="px-4 py-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted text-ink-soft grid place-items-center shrink-0">
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{p.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.sub}</div>
                  </div>
                  {p.state === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-1" />
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Current usage */}
          <section className="rounded-lg border border-border bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Current usage</h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{usage?.plan ?? "free"}</span>
            </div>
            <div className="px-4 py-4 space-y-5">
              <UsageRow
                label="Bots"
                sub={`${usage?.current_bots ?? 0} / ${usage?.max_bots ?? 1}`}
                value={usage?.current_bots ?? 0}
                max={usage?.max_bots ?? 1}
              />
              <UsageRow
                label="Replies this month"
                sub={`${(usage?.monthly_messages ?? 0).toLocaleString()} / ${(usage?.max_monthly_messages ?? 0).toLocaleString()}`}
                value={usage?.monthly_messages ?? 0}
                max={usage?.max_monthly_messages ?? 1}
              />
              <Button asChild variant="default" size="sm" className="w-full">
                <Link to="/pricing"><Zap className="h-3.5 w-3.5" /> Upgrade plan</Link>
              </Button>
            </div>
          </section>

          <Link
            to="/dashboard/settings"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-ink-soft hover:text-ink hover:border-primary/40 transition"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help & onboarding</span>
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Link>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-ink tabular-nums mt-0.5">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function UsageRow({ label, sub, value, max }: { label: string; sub: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-ink">{label}</span>
        <span className="text-muted-foreground tabular-nums">{sub}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
