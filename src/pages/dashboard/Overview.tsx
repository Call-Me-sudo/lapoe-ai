import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Bot, Users, MessageSquare, BookOpen, ArrowUpRight, Plus,
  Sparkles, Activity, CheckCircle2, Circle, TrendingUp, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Stats = { bots: number; groups: number; messages: number; knowledge: number };

type RecentMsg = {
  id: string;
  content: string | null;
  direction: string | null;
  created_at: string;
  bots?: { name: string } | null;
  telegram_groups?: { name: string } | null;
};

type Usage = {
  plan: string;
  current_bots: number;
  max_bots: number;
  monthly_messages: number;
  max_monthly_messages: number;
};

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ bots: 0, groups: 0, messages: 0, knowledge: 0 });
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recent, setRecent] = useState<RecentMsg[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, g, m, k, usageRows, recentMsgs] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        (supabase as unknown as { rpc: (n: string) => Promise<{ data: Usage[] | null }> }).rpc("my_workspace_usage"),
        supabase.from("bot_messages")
          .select("id, content, direction, created_at, bots(name), telegram_groups(name)")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      setStats({ bots: b.count ?? 0, groups: g.count ?? 0, messages: m.count ?? 0, knowledge: k.count ?? 0 });
      setUsage(Array.isArray(usageRows.data) ? usageRows.data[0] ?? null : null);
      setRecent((recentMsgs.data as RecentMsg[] | null) ?? []);
    })();
  }, [user]);

  const tiles = [
    { label: "Bots", value: stats.bots, icon: Bot, to: "/dashboard/bots", accent: "text-primary bg-primary/10" },
    { label: "Groups", value: stats.groups, icon: Users, to: "/dashboard/groups", accent: "text-emerald-600 bg-emerald-500/10" },
    { label: "Knowledge", value: stats.knowledge, icon: BookOpen, to: "/dashboard/knowledge", accent: "text-amber-600 bg-amber-500/10" },
    { label: "Messages", value: stats.messages, icon: MessageSquare, to: "/dashboard/messages", accent: "text-violet-600 bg-violet-500/10" },
  ];

  const checklist = useMemo(
    () => [
      { done: stats.bots > 0, label: "Create your first bot", to: "/dashboard/bots" },
      { done: stats.groups > 0, label: "Connect a Telegram group", to: "/dashboard/groups" },
      { done: stats.knowledge > 0, label: "Add knowledge sources", to: "/dashboard/knowledge" },
      { done: stats.messages > 0, label: "See your first message", to: "/dashboard/messages" },
    ],
    [stats]
  );
  const completed = checklist.filter((c) => c.done).length;
  const onboardingDone = completed === checklist.length;

  const msgPct = usage ? Math.min(100, Math.round((usage.monthly_messages / Math.max(1, usage.max_monthly_messages)) * 100)) : 0;
  const botPct = usage ? Math.min(100, Math.round((usage.current_bots / Math.max(1, usage.max_bots)) * 100)) : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const name = user?.email?.split("@")[0] ?? "there";

  return (
    <DashboardLayout>
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-ink">
            {greeting}, <span className="capitalize">{name}</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm"><Link to="/dashboard/bots"><Plus className="h-4 w-4" /> New bot</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/dashboard/knowledge"><BookOpen className="h-4 w-4" /> Add knowledge</Link></Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition"
          >
            <div className="flex items-start justify-between">
              <div className={`h-9 w-9 rounded-md grid place-items-center ${t.accent}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-ink tabular-nums">{t.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-5 mt-5">
        {/* Onboarding */}
        <section className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Get set up</h3>
                <p className="text-xs text-muted-foreground">{completed} of {checklist.length} steps complete</p>
              </div>
            </div>
            <div className="hidden sm:block w-32"><Progress value={(completed / checklist.length) * 100} className="h-1.5" /></div>
          </div>

          {onboardingDone ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 text-emerald-700 px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Workspace ready. Keep tuning your bots in Bots.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link to={c.to} className="flex items-center gap-3 py-3 hover:bg-accent/40 -mx-1 px-1 rounded transition">
                    {c.done
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={`text-sm flex-1 ${c.done ? "text-muted-foreground line-through" : "text-ink"}`}>{c.label}</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Usage */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-violet-500/10 text-violet-600 grid place-items-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Usage</h3>
                <p className="text-xs text-muted-foreground capitalize">{usage?.plan ?? "free"} plan</p>
              </div>
            </div>
            <Link to="/dashboard/billing" className="text-xs text-primary hover:underline">Manage</Link>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Bots</span>
                <span className="text-ink tabular-nums">{usage?.current_bots ?? 0} / {usage?.max_bots ?? 1}</span>
              </div>
              <Progress value={botPct} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Messages this month</span>
                <span className="text-ink tabular-nums">
                  {(usage?.monthly_messages ?? 0).toLocaleString()} / {(usage?.max_monthly_messages ?? 0).toLocaleString()}
                </span>
              </div>
              <Progress value={msgPct} className="h-1.5" />
            </div>
          </div>

          {msgPct >= 80 && (
            <Link to="/pricing" className="mt-4 flex items-center gap-2 text-xs text-primary hover:underline">
              <Zap className="h-3.5 w-3.5" /> Upgrade for more capacity
            </Link>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section className="mt-5 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
          </div>
          <Link to="/dashboard/messages" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet. Once your bot starts chatting, you'll see messages here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((m) => {
              const inbound = m.direction === "inbound";
              return (
                <li key={m.id} className="px-5 py-3 flex items-start gap-3">
                  <div className={`h-7 w-7 rounded-full grid place-items-center shrink-0 mt-0.5 ${
                    inbound ? "bg-muted text-ink-soft" : "bg-primary/10 text-primary"
                  }`}>
                    {inbound ? <MessageSquare className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="text-ink font-medium">{m.bots?.name ?? "Bot"}</span>
                      <span>·</span>
                      <span className="truncate">{m.telegram_groups?.name ?? "Direct message"}</span>
                      <span>·</span>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-ink mt-0.5 line-clamp-2 break-words">{m.content ?? "—"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </DashboardLayout>
  );
}
