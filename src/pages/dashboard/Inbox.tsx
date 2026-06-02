import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Inbox as InboxIcon, MessageCircleQuestion, X, Check } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  bot_id: string;
  question: string;
  asker: string | null;
  ask_count: number;
  status: "pending" | "answered" | "dismissed";
  answer: string | null;
  created_at: string;
  updated_at: string;
  bots?: { name: string } | null;
};

export default function Inbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"pending" | "answered" | "dismissed">("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("unanswered_questions")
      .select("*, bots(name)")
      .eq("owner_id", user.id)
      .eq("status", filter)
      .order("ask_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    setItems((data as any[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, filter]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unanswered-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "unanswered_questions", filter: `owner_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [user, filter]);

  const dismiss = async (id: string) => {
    await supabase.from("unanswered_questions").update({ status: "dismissed" }).eq("id", id);
    toast.success("Dismissed");
    load();
  };

  const answer = async (it: Item) => {
    const ans = (drafts[it.id] || "").trim();
    if (!ans) return toast.error("Type an answer first");
    setBusy(it.id);
    const { data: src, error } = await supabase
      .from("knowledge_sources")
      .insert({
        owner_id: user!.id,
        bot_id: it.bot_id,
        kind: "text",
        title: it.question.slice(0, 180),
        content: `Q: ${it.question}\nA: ${ans}`,
      })
      .select("id")
      .single();

    if (error) { setBusy(null); return toast.error(error.message); }

    await supabase.from("unanswered_questions").update({
      status: "answered",
      answer: ans,
      answered_at: new Date().toISOString(),
    }).eq("id", it.id);

    supabase.functions.invoke("index-knowledge", { body: { source_id: src!.id } }).catch(() => {});
    setBusy(null);
    setDrafts(prev => { const n = { ...prev }; delete n[it.id]; return n; });
    toast.success("Saved to Knowledge — your bot will use it next time");
    load();
  };

  const reopen = async (id: string) => {
    await supabase.from("unanswered_questions").update({ status: "pending" }).eq("id", id);
    load();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Inbox"
        description="Questions your bot couldn't answer. Reply once and the answer becomes permanent knowledge."
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["pending", "answered", "dismissed"] as const).map(s => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <InboxIcon className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">
            {filter === "pending" ? "No unanswered questions — nice." : `No ${filter} items.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-tile-yellow/30 text-foreground grid place-items-center shrink-0">
                  <MessageCircleQuestion className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink font-medium break-words">{it.question}</p>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{it.bots?.name || "Bot"}</span>
                    {it.asker && <span>asked by {it.asker}</span>}
                    {it.ask_count > 1 && <Badge variant="secondary" className="text-[10px]">asked {it.ask_count}×</Badge>}
                    <span>{new Date(it.updated_at).toLocaleString()}</span>
                  </div>
                  {it.answer && (
                    <p className="text-xs text-ink-soft mt-2 italic border-l-2 border-border pl-2">
                      Your answer: {it.answer}
                    </p>
                  )}
                </div>
              </div>

              {filter === "pending" && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Type the answer — it will be saved as knowledge so the bot learns it permanently."
                    value={drafts[it.id] || ""}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [it.id]: e.target.value }))}
                    rows={2}
                    maxLength={4000}
                  />
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => dismiss(it.id)} className="gap-1">
                      <X className="h-4 w-4" /> Dismiss
                    </Button>
                    <Button size="sm" onClick={() => answer(it)} disabled={busy === it.id} className="gap-1">
                      <Check className="h-4 w-4" /> {busy === it.id ? "Saving…" : "Answer & teach"}
                    </Button>
                  </div>
                </div>
              )}

              {filter !== "pending" && (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => reopen(it.id)}>Move to pending</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
