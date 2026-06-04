import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, MoreVertical, Bot as BotIcon, MessageSquare, Copy, KeyRound,
  PauseCircle, ChevronRight, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/dashboard/ListSkeleton";

type Plan = "free" | "starter" | "pro" | "business";
const PLANS: Plan[] = ["free", "starter", "pro", "business"];

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  telegram_username: string | null;
  created_at: string;
  roles: string[];
  plan: Plan;
  bots: number;
  messages: number;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: subs }, { data: bots }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,telegram_username,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("subscriptions").select("user_id,plan,status").eq("status", "active"),
      supabase.from("bots").select("owner_id"),
      supabase.from("bot_messages").select("owner_id"),
    ]);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const a = roleMap.get(r.user_id) ?? [];
      a.push(r.role);
      roleMap.set(r.user_id, a);
    });
    const planMap = new Map<string, Plan>();
    (subs ?? []).forEach((s: any) => planMap.set(s.user_id, s.plan));
    const botMap = new Map<string, number>();
    (bots ?? []).forEach((b: any) => botMap.set(b.owner_id, (botMap.get(b.owner_id) ?? 0) + 1));
    const msgMap = new Map<string, number>();
    (msgs ?? []).forEach((m: any) => msgMap.set(m.owner_id, (msgMap.get(m.owner_id) ?? 0) + 1));

    setRows((profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      telegram_username: p.telegram_username,
      created_at: p.created_at,
      roles: roleMap.get(p.id) ?? [],
      plan: planMap.get(p.id) ?? "free",
      bots: botMap.get(p.id) ?? 0,
      messages: msgMap.get(p.id) ?? 0,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setPlan = async (userId: string, plan: Plan) => {
    const { error } = await supabase.from("subscriptions").insert({ user_id: userId, plan, status: "active" });
    if (error) return toast.error(error.message);
    toast.success(`Plan set to ${plan}`); load();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const sendReset = async (email: string | null) => {
    if (!email) return toast.error("No email on file");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Reset link sent to ${email}`);
  };

  const pauseAllBots = async (userId: string, name: string) => {
    if (!confirm(`Pause all bots owned by ${name}?`)) return;
    const { error } = await supabase.from("bots").update({ status: "paused" }).eq("owner_id", userId);
    if (error) return toast.error(error.message);
    toast.success("All bots paused"); load();
  };

  const grantOwner = async (userId: string) => {
    if (!confirm("Grant owner (full admin) access?")) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "owner" });
    if (error) return toast.error(error.message);
    toast.success("Owner granted"); load();
  };
  const revokeOwner = async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "owner");
    if (error) return toast.error(error.message);
    toast.success("Owner revoked"); load();
  };

  const filtered = useMemo(() => rows.filter(u =>
    !q ||
    u.email?.toLowerCase().includes(q.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(q.toLowerCase()) ||
    u.telegram_username?.toLowerCase().includes(q.toLowerCase())
  ), [rows, q]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</div>
        <h1 className="font-display text-3xl text-ink mt-1">Users</h1>
        <p className="text-sm text-ink-soft mt-1">{rows.length} accounts · manage plans, access, and bots</p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <Input placeholder="Search email, name, or @handle…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {loading && <TableSkeleton rows={6} cols={6} />}
      {!loading && filtered.length === 0 && <div className="surface-card p-8 text-center text-sm text-ink-soft">No users found.</div>}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <UserRow key={u.id} u={u}
            onPlan={setPlan} onCopy={copy} onReset={sendReset}
            onPauseAll={pauseAllBots} onGrantOwner={grantOwner} onRevokeOwner={revokeOwner} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Telegram</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Usage</th>
                <th className="text-left p-3">Roles</th>
                <th className="text-left p-3">Joined</th>
                <th className="text-right p-3">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium text-ink">{u.display_name || "—"}</div>
                    <div className="text-xs text-ink-soft">{u.email}</div>
                  </td>
                  <td className="p-3 text-ink-soft text-xs">{u.telegram_username ? `@${u.telegram_username}` : "—"}</td>
                  <td className="p-3">
                    <Select value={u.plan} onValueChange={(v) => setPlan(u.id, v as Plan)}>
                      <SelectTrigger className="h-8 w-[110px] capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-xs text-ink-soft">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><BotIcon className="h-3 w-3" />{u.bots}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{u.messages}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.length === 0 && <Badge variant="outline">user</Badge>}
                      {u.roles.map((r) => <Badge key={r} variant={r === "owner" ? "default" : "secondary"}>{r}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-ink-soft whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <ManageDialog u={u}
                      onPlan={setPlan} onCopy={copy} onReset={sendReset}
                      onPauseAll={pauseAllBots} onGrantOwner={grantOwner} onRevokeOwner={revokeOwner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

type Handlers = {
  onPlan: (id: string, plan: Plan) => void;
  onCopy: (text: string, label: string) => void;
  onReset: (email: string | null) => void;
  onPauseAll: (id: string, name: string) => void;
  onGrantOwner: (id: string) => void;
  onRevokeOwner: (id: string) => void;
};

function UserRow({ u, ...h }: { u: Row } & Handlers) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink truncate">{u.display_name || u.email?.split("@")[0] || "—"}</div>
          <div className="text-xs text-ink-soft truncate">{u.email}</div>
          {u.telegram_username && <div className="text-[11px] text-ink-soft mt-0.5">@{u.telegram_username}</div>}
        </div>
        <ManageDialog u={u} {...h} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <Badge variant="secondary" className="capitalize">{u.plan}</Badge>
          {u.roles.includes("owner") && <Badge variant="default">owner</Badge>}
        </div>
        <div className="text-[11px] text-ink-soft flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><BotIcon className="h-3 w-3" />{u.bots}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{u.messages}</span>
        </div>
      </div>
    </div>
  );
}

function ManageDialog({ u, onPlan, onCopy, onReset, onPauseAll, onGrantOwner, onRevokeOwner }: { u: Row } & Handlers) {
  const isOwner = u.roles.includes("owner");
  const name = u.display_name || u.email || "this user";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-muted text-ink-soft" aria-label="Manage">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base truncate">{name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="font-display text-lg text-ink">{u.bots}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">bots</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="font-display text-lg text-ink">{u.messages.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">msgs</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="font-display text-lg text-ink capitalize">{u.plan}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">plan</div>
            </div>
          </div>

          {/* Plan */}
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-soft mb-2">Change plan</div>
            <Select value={u.plan} onValueChange={(v) => onPlan(u.id, v as Plan)}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Quick tools */}
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-ink-soft mb-2">Tools</div>
            <Tool icon={<KeyRound className="h-4 w-4" />} label="Send password reset email" onClick={() => onReset(u.email)} disabled={!u.email} />
            <Tool icon={<PauseCircle className="h-4 w-4" />} label={`Pause all bots (${u.bots})`} onClick={() => onPauseAll(u.id, name)} disabled={u.bots === 0} />
            <Tool icon={<Copy className="h-4 w-4" />} label="Copy email" onClick={() => onCopy(u.email || "", "Email")} disabled={!u.email} />
            <Tool icon={<Copy className="h-4 w-4" />} label="Copy user ID" onClick={() => onCopy(u.id, "User ID")} />
          </div>

          {/* Owner access — quiet, with confirmation */}
          <div className="pt-3 border-t border-border/40">
            <div className="text-[11px] text-ink-soft mb-2">Workspace access</div>
            {isOwner ? (
              <Button size="sm" variant="outline" className="w-full" onClick={() => onRevokeOwner(u.id)}>
                <ShieldCheck className="h-3.5 w-3.5" /> Revoke owner access
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="w-full text-ink-soft" onClick={() => onGrantOwner(u.id)}>
                <ShieldCheck className="h-3.5 w-3.5" /> Grant owner (full admin)
              </Button>
            )}
          </div>

          <DialogFooter className="text-[10px] text-ink-soft justify-start">
            Joined {new Date(u.created_at).toLocaleDateString()}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tool({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-sm text-ink text-left transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-ink-soft">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-ink-soft" />
    </button>
  );
}
