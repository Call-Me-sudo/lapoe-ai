import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Settings as SettingsIcon, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/dashboard/ListSkeleton";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ rules: "", welcome_message: "", moderation_enabled: true, banned_words: "" });

  const load = async () => {
    if (!user) return;
    const [customGroups, systemGroups] = await Promise.all([
      supabase.from("telegram_groups")
        .select("*, bots(name, bot_username)")
        .eq("owner_id", user.id).order("last_seen_at", { ascending: false }),
      supabase.from("system_bot_groups")
        .select("*")
        .eq("linked_owner_id", user.id).order("updated_at", { ascending: false }),
    ]);
    const custom = (customGroups.data ?? []).map((g: any) => ({ ...g, source: "custom" }));
    const system = (systemGroups.data ?? []).map((g: any) => ({
      ...g,
      id: `system-${g.chat_id}`,
      source: "system",
      name: g.title || `chat:${g.chat_id}`,
      telegram_chat_id: String(g.chat_id),
      bots: { name: "LaPoe", bot_username: "LaPoe_bot" },
      last_seen_at: g.updated_at,
    }));
    setGroups([...system, ...custom]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    // Refresh group names from Telegram on mount and every 60s
    const refresh = async () => {
      try {
        await supabase.functions.invoke("refresh-group-names");
        load();
      } catch { /* ignore */ }
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [user]);


  const startEdit = (g: any) => {
    setEditing(g);
    setForm({
      rules: g.rules ?? "",
      welcome_message: g.welcome_message ?? "",
      moderation_enabled: g.moderation_enabled ?? true,
      banned_words: (g.banned_words || []).join(", "),
    });
  };

  const save = async () => {
    if (!editing) return;
    const payload = {
      rules: form.rules,
      welcome_message: form.welcome_message,
      moderation_enabled: form.moderation_enabled,
      banned_words: form.banned_words.split(",").map(w => w.trim()).filter(Boolean),
    };
    const { error } = editing.source === "system"
      ? await supabase.from("system_bot_groups").update(payload).eq("chat_id", editing.chat_id)
      : await supabase.from("telegram_groups").update(payload).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Group updated");
    setEditing(null); load();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Telegram groups"
        description="Add your bot to a Telegram group from inside Telegram. LaPoe detects it automatically and lists it here."
      />

      <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 mb-6 flex gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-ink">
          <strong>How to add your bot to a group:</strong>
          <ol className="list-decimal pl-5 mt-1 space-y-0.5 text-ink-soft">
            <li>Open the group in Telegram</li>
            <li>Tap members → <em>Add member</em> → search your bot's @username</li>
            <li>Make the bot an admin if you want it to moderate</li>
            <li>Send any message in the group — it will appear here within ~60s</li>
          </ol>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <Users className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No groups detected yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{g.name}</span>
                    {g.is_auto && <Badge variant="secondary" className="text-[10px]">auto-detected</Badge>}
                    <Badge variant={g.moderation_enabled ? "default" : "outline"} className="text-[10px]">
                      {g.moderation_enabled ? "mod on" : "mod off"}
                    </Badge>
                  </div>
                  <div className="text-xs text-ink-soft mt-1">
                    Bot: {g.bots?.name} {g.bots?.bot_username && `(@${g.bots.bot_username})`} · Chat ID: {g.telegram_chat_id || "—"}
                    {g.last_seen_at && <> · Last seen: {new Date(g.last_seen_at).toLocaleString()}</>}
                  </div>
                  {g.rules && <p className="text-sm text-ink-soft mt-2 max-w-2xl line-clamp-2">{g.rules}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => startEdit(g)}><SettingsIcon className="h-3.5 w-3.5" /> Configure</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {editing?.name}</DialogTitle>
            <DialogDescription>Update group-specific rules, welcome message and moderation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Moderation enabled</Label>
              <Switch checked={form.moderation_enabled} onCheckedChange={(v) => setForm({ ...form, moderation_enabled: v })} />
            </div>
            <div>
              <Label>Group rules (used by AI)</Label>
              <p className="text-xs text-ink-soft mt-1 mb-1.5">These instructions guide how the AI behaves and responds in this group. Pick an example or write your own.</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  "Be friendly but firm. No off-topic discussions after 10 PM. Always greet new members by name.",
                  "Keep conversations professional. Warn users before taking moderation actions. Answer questions in concise bullet points.",
                  "Encourage positive vibes. Remove any toxic messages. Share a fun fact when asked.",
                  "Strict community: no spam, no promotions. Auto-delete messages with suspicious links.",
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setForm((prev: any) => ({ ...prev, rules: ex }))}
                    className="text-[10px] px-2 py-1 rounded-full border border-border bg-paper-soft text-ink-soft hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {ex.split(". ")[0]}…
                  </button>
                ))}
              </div>
              <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={4} maxLength={2000} placeholder="Write your own rules, or click an example above…" />
            </div>
            <div>
              <Label>Welcome message (overrides bot default)</Label>
              <Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} rows={2} maxLength={1000} placeholder="Hey {name}, welcome!" />
            </div>
            <div>
              <Label>Banned words (comma separated)</Label>
              <Textarea value={form.banned_words} onChange={(e) => setForm({ ...form, banned_words: e.target.value })} rows={2} maxLength={1000} placeholder="spam, crypto, scam" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
