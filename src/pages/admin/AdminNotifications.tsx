import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Send, Trash2, Users, User as UserIcon, Globe } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type Audience = "all" | "plan" | "user";
type Plan = "free" | "starter" | "pro" | "business";

type Profile = { id: string; email: string | null; display_name: string | null };
type Notif = {
  id: string; title: string; body: string; audience: string;
  plan: string | null; user_id: string | null; created_at: string; type: string;
};

export default function AdminNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [plan, setPlan] = useState<Plan>("free");
  const [targetUser, setTargetUser] = useState<string>("");
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [recent, setRecent] = useState<Notif[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadRecent = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
    setRecent((data ?? []) as Notif[]);
    setRecentLoading(false);
  };

  const searchUsers = async (q: string) => {
    let query = supabase.from("profiles").select("id,email,display_name").limit(20);
    if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
    const { data } = await query;
    setUsers((data ?? []) as Profile[]);
  };

  useEffect(() => { loadRecent(); searchUsers(""); }, []);
  useEffect(() => { const t = setTimeout(() => searchUsers(userQuery), 300); return () => clearTimeout(t); }, [userQuery]);

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and message required");
    if (audience === "user" && !targetUser) return toast.error("Pick a user");
    setSending(true);
    const payload: any = {
      title: title.trim(),
      body: body.trim(),
      type: "admin",
      audience,
      created_by: user?.id,
      plan: audience === "plan" ? plan : null,
      user_id: audience === "user" ? targetUser : null,
    };
    const { error } = await supabase.from("notifications").insert(payload);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Notification sent");
    setTitle(""); setBody(""); setTargetUser("");
    loadRecent();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRecent((r) => r.filter((n) => n.id !== id));
  };

  const audIcon = (a: string) => a === "all" ? Globe : a === "plan" ? Users : UserIcon;

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Notifications</div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mt-1">Broadcast & direct message</h1>
        <p className="text-sm text-muted-foreground mt-1">Send announcements to all users, a plan tier, or a single account.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr] gap-4">
        <div className="bg-card rounded-3xl shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            <h2 className="font-semibold">Compose</h2>
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone (broadcast)</SelectItem>
                <SelectItem value="plan">By plan tier</SelectItem>
                <SelectItem value="user">Single user</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === "plan" && (
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {audience === "user" && (
            <div className="space-y-2">
              <Label>User</Label>
              <Input placeholder="Search by email or name…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
              <div className="max-h-44 overflow-y-auto border border-border/40 rounded-xl divide-y">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setTargetUser(u.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition ${targetUser === u.id ? "bg-muted" : ""}`}
                  >
                    <div className="font-medium truncate">{u.display_name || u.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </button>
                ))}
                {users.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground">No users</div>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What's the news?" />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} placeholder="Write the message…" />
          </div>

          <Button onClick={send} disabled={sending} className="w-full">
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send notification"}
          </Button>
        </div>

        <div className="bg-card rounded-3xl shadow-card p-5">
          <h2 className="font-semibold mb-3">Recent</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {recentLoading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-2xl p-3 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
            {!recentLoading && recent.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Nothing sent yet</div>}
            {recent.map((n) => {
              const Icon = audIcon(n.audience);
              return (
                <div key={n.id} className="border border-border/40 rounded-2xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="h-7 w-7 rounded-full bg-muted grid place-items-center shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {n.audience === "all" ? "Everyone" : n.audience === "plan" ? `Plan: ${n.plan}` : "Single user"} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
