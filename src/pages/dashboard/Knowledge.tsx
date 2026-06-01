import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Knowledge() {
  const { user } = useAuth();
  const [bots, setBots] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ bot_id: "", kind: "url" as "url" | "text", title: "", content: "", source_url: "" });

  const load = async () => {
    if (!user) return;
    const [bs, ks] = await Promise.all([
      supabase.from("bots").select("id,name").eq("owner_id", user.id),
      supabase.from("knowledge_sources").select("*, bots(name)").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setBots(bs.data ?? []); setItems(ks.data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const reindex = async (source_id: string) => {
    setBusy(source_id);
    const { error } = await supabase.functions.invoke("index-knowledge", { body: { source_id } });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Indexed"); load();
  };

  const save = async () => {
    if (!user || !form.bot_id || !form.title.trim()) return toast.error("Bot and title required");
    const { data, error } = await supabase.from("knowledge_sources").insert({ ...form, owner_id: user.id }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Source added — indexing…");
    setOpen(false);
    setForm({ bot_id: "", kind: "url", title: "", content: "", source_url: "" });
    if (data?.id) supabase.functions.invoke("index-knowledge", { body: { source_id: data.id } }).then(() => load());
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this source?")) return;
    await supabase.from("knowledge_sources").delete().eq("id", id); load();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Knowledge"
        description="Add URLs or paste text. Each source is chunked and embedded so the bot retrieves only what's relevant."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={bots.length === 0}><Plus className="h-4 w-4" /> Add source</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a knowledge source</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Bot</Label>
                  <Select value={form.bot_id} onValueChange={(v) => setForm({ ...form, bot_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a bot" /></SelectTrigger>
                    <SelectContent>{bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.kind} onValueChange={(v: any) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="url">URL</SelectItem><SelectItem value="text">Plain text</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} /></div>
                {form.kind === "url" ? (
                  <div><Label>URL</Label><Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://yourblog.com/article" /></div>
                ) : (
                  <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} maxLength={20000} /></div>
                )}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Add &amp; index</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <BookOpen className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No sources yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((k) => (
            <div key={k.id} className="border border-border rounded-lg p-4 bg-card flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">{k.title}</span>
                  {k.indexed_at
                    ? <Badge variant="default" className="text-[10px]">indexed · {k.chunk_count} chunks</Badge>
                    : <Badge variant="secondary" className="text-[10px]">pending</Badge>}
                  {k.indexing_error && <Badge variant="destructive" className="text-[10px]">error</Badge>}
                </div>
                <div className="text-xs text-ink-soft mt-1">{k.bots?.name} · {k.kind}</div>
                {k.source_url && <a href={k.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block truncate">{k.source_url}</a>}
                {k.indexing_error && <p className="text-xs text-destructive mt-1">{k.indexing_error}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => reindex(k.id)} disabled={busy === k.id}>
                  <RefreshCw className={`h-4 w-4 ${busy === k.id ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
