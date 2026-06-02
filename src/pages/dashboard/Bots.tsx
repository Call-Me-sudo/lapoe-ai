import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot as BotIcon, Trash2, Edit3, ShieldAlert, CheckCircle2, AlertCircle, AtSign, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Bot = {
  id: string; name: string; description: string | null;
  status: "active" | "paused" | "stopped";
  telegram_bot_token: string | null;
  default_instructions: string | null;
  tone: string | null;
  personality: string | null;
  house_rules: string | null;
  welcome_message: string | null;
  bot_username: string | null;
  banned_words: string[] | null;
  anti_flood_enabled: boolean;
  anti_spam_enabled: boolean;
  flood_sensitivity: number;
};

type BotQuota = { plan: string; current_bots: number; max_bots: number; allowed: boolean };
type WorkspaceUsage = {
  plan: string;
  current_bots: number;
  max_bots: number;
  monthly_messages: number;
  max_monthly_messages: number;
  max_msgs_per_minute: number;
  period_end: string;
};

type RpcClient = typeof supabase & {
  rpc(fn: "my_bot_quota"): Promise<{ data: BotQuota[] | null; error: unknown }>;
  rpc(fn: "my_workspace_usage"): Promise<{ data: WorkspaceUsage[] | null; error: unknown }>;
};

const TONES = ["friendly", "professional", "witty", "strict", "hype"];

export default function Bots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [quota, setQuota] = useState<BotQuota | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [deleteBot, setDeleteBot] = useState<Bot | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", telegram_bot_token: "",
    tone: "friendly", personality: "",
  });

  const load = useCallback(async () => {
    if (!user) return;
    const client = supabase as RpcClient;
    const [{ data }, { data: quotaRows }, { data: usageRows }] = await Promise.all([
      supabase.from("bots").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      client.rpc("my_bot_quota"),
      client.rpc("my_workspace_usage"),
    ]);
    setBots(data ?? []);
    setQuota(Array.isArray(quotaRows) ? quotaRows[0] ?? null : quotaRows ?? null);
    setUsage(Array.isArray(usageRows) ? usageRows[0] ?? null : usageRows ?? null);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setForm({
      name: "", description: "", telegram_bot_token: "",
      tone: "friendly", personality: "",
    });
    setEditing(null);
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    if (!editing && quota && !quota.allowed) {
      return toast.error(`Your ${quota.plan} plan allows ${quota.max_bots} bot${quota.max_bots === 1 ? "" : "s"}.`, {
        action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
      });
    }

    const payload = { ...form };


    if (editing) {
      const { error } = await supabase.from("bots").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Bot updated");
    } else {
      const { error } = await supabase.from("bots").insert({ ...payload, owner_id: user.id, status: "active" });
      if (error) {
        if (error.message?.includes("PLAN_LIMIT_BOTS")) {
          return toast.error("You've hit your plan's bot limit. Upgrade to add more.", {
            action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
          });
        }
        return toast.error(error.message);
      }
      toast.success("Bot created and activated");
    }
    setOpen(false); reset(); load();
  };

  const remove = async () => {
    if (!deleteBot) return;
    const { error } = await supabase.from("bots").delete().eq("id", deleteBot.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); setDeleteBot(null); load();
  };

  const toggleStatus = async (b: Bot) => {
    const next = b.status === "active" ? "paused" : "active";
    await supabase.from("bots").update({ status: next }).eq("id", b.id);
    load();
  };

  const startEdit = (b: Bot) => {
    setEditing(b);
    setForm({
      name: b.name, description: b.description ?? "",
      telegram_bot_token: b.telegram_bot_token ?? "",
      tone: b.tone ?? "friendly",
      personality: b.personality ?? "",
    });
    setOpen(true);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Bots"
        description="Powered by KADE's shared AI. Configure tone & rules here, or DM your bot with /help."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button disabled={!!quota && !quota.allowed} title={quota && !quota.allowed ? "Upgrade to create more bots" : undefined}>
                <Plus className="h-4 w-4" />
                New bot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit bot" : "Create a bot"}</DialogTitle>
                <DialogDescription>
                  Just a name and a Telegram token to start — sensible defaults handle the rest. You can fine-tune anytime from Telegram (<code className="text-[11px]">/help</code>) or in Advanced.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bot-name">Name</Label>
                  <Input id="bot-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="e.g. Acme Support" />
                </div>
                <div>
                  <Label htmlFor="bot-token">Telegram Bot Token</Label>
                  <Input id="bot-token" value={form.telegram_bot_token} onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })} placeholder="123456:ABC-DEF…" />
                  <p className="text-xs text-ink-soft mt-1">Get one free from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a>.</p>
                </div>
                <div>
                  <Label htmlFor="bot-description">What does this bot help with? <span className="text-ink-soft font-normal">(optional)</span></Label>
                  <Input id="bot-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} placeholder="Customer support for our SaaS" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bot-tone">Tone</Label>
                    <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                      <SelectTrigger id="bot-tone"><SelectValue /></SelectTrigger>
                      <SelectContent>{TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bot-personality">Personality <span className="text-ink-soft font-normal">(optional)</span></Label>
                    <Input id="bot-personality" value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} maxLength={500} placeholder="Sassy librarian" />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-paper-soft p-3 text-xs text-ink-soft flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-ink font-medium">Smart defaults applied:</span> anti-spam & anti-flood on, moderation on, replies in the user's language. Per-group rules, banned words and welcome message live in <strong>Groups → Configure</strong>.
                  </div>
                </div>
              </div>


              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save changes" : "Create bot"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {usage && (() => {
        const botPct = Math.min(100, Math.round((usage.current_bots / Math.max(1, usage.max_bots)) * 100));
        const msgPct = Math.min(100, Math.round((usage.monthly_messages / Math.max(1, usage.max_monthly_messages)) * 100));
        const atBotCap = !!quota && !quota.allowed;
        const resetDate = new Date(usage.period_end).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <div className="mb-6 border border-border rounded-lg bg-card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="text-sm text-ink-soft">
                <span className="capitalize text-ink font-medium">{usage.plan} plan</span> · resets {resetDate}
              </div>
              {atBotCap && (
                <Button size="sm" onClick={() => (window.location.href = "/pricing")}>Upgrade plan</Button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-ink-soft mb-1">
                  <span>Bots</span>
                  <span>{usage.current_bots} / {usage.max_bots}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${atBotCap ? "bg-destructive" : "bg-primary"}`} style={{ width: `${botPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink-soft mb-1">
                  <span>Messages this month</span>
                  <span>{usage.monthly_messages.toLocaleString()} / {usage.max_monthly_messages.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${msgPct >= 100 ? "bg-destructive" : msgPct >= 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${msgPct}%` }} />
                </div>
              </div>
            </div>
            {atBotCap && (
              <p className="text-xs text-ink-soft mt-3">
                You've reached the bot limit for the {usage.plan} plan. <a href="/pricing" className="text-primary hover:underline">See plans →</a>
              </p>
            )}
          </div>
        );
      })()}

      {bots.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <BotIcon className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No bots yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bots.map((b) => {
            const connected = !!b.telegram_bot_token;
            return (
              <div key={b.id} className="border border-border rounded-lg p-4 bg-card flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <BotIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-ink truncate">{b.name}</h3>
                      <Badge variant={b.status === "active" ? "default" : "secondary"} className="capitalize text-[10px]">{b.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {b.bot_username ? (
                        <a href={`https://t.me/${b.bot_username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                          <AtSign className="h-3 w-3" />{b.bot_username}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" /> not connected
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {connected
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          : <AlertCircle className="h-3 w-3 text-amber-600" />}
                        {connected ? "Token ok" : "Token missing"}
                      </span>
                      <span className="capitalize">{b.tone || "friendly"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(b)}>{b.status === "active" ? "Pause" : "Activate"}</Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(b)} aria-label="Edit bot"><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteBot(b)} aria-label="Delete bot"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteBot} onOpenChange={(o) => { if (!o) setDeleteBot(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteBot?.name}”?</DialogTitle>
            <DialogDescription>
              This will permanently remove the bot, its groups, rules and logs.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-paper-soft p-3 text-xs text-ink-soft flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-ink font-medium">Your monthly message count will not reset.</span>{" "}
              Messages already sent this month are tied to your account, not this bot.
              They reset on the 1st of each month.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBot(null)}>Cancel</Button>
            <Button variant="destructive" onClick={remove}>Delete bot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
