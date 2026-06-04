import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Bot = { id: string; name: string; tone: string | null; personality: string | null; system?: boolean };
type Msg = { role: "user" | "assistant"; content: string };
const SYSTEM_ASSISTANT: Bot = { id: "__lapoe_system_bot__", name: "LaPoe Assistant", tone: "friendly", personality: null, system: true };

export default function Playground() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("bots").select("id,name,tone,personality").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const next = data?.length ? data : [SYSTEM_ASSISTANT];
        setBots(next);
        if (next.length && !botId) setBotId(next[0].id);
      });
  }, [user, botId]);

  useEffect(() => { setMessages([]); }, [botId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [botId, sending]);

  const activeBot = bots.find(b => b.id === botId);

  const send = async () => {
    const text = input.trim();
    if (!text || !botId || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("bot-playground", {
        body: { bot_id: botId, system_bot: activeBot?.system === true, messages: next },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || "(no reply)";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to get reply");
      setMessages(messages); // revert
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Playground"
        description="Chat with your bot here before pushing it to Telegram. Messages here don't count toward your monthly quota."
        actions={
          <Button variant="outline" onClick={() => setMessages([])} disabled={messages.length === 0}>
            <RotateCcw className="h-4 w-4" /> Clear
          </Button>
        }
      />

      {bots.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-card p-12 text-center">
          <img src="/bot-icon.png" alt="LaPoe" className="h-10 w-10 rounded-full object-cover mx-auto mb-3" />
          <p className="text-muted-foreground">Connect your assistant first, then come back to preview it here.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-card shadow-card overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
          {/* Bot picker */}
          <div className="px-4 md:px-6 py-4 flex items-center gap-3">
            <img src="/bot-icon.png" alt="LaPoe" className="h-10 w-10 rounded-2xl object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger className="border-0 shadow-none bg-transparent px-0 h-auto font-semibold text-base text-foreground focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground capitalize truncate">
                {activeBot?.tone || "friendly"} · preview mode
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 bg-background/40">
            {messages.length === 0 && (
              <div className="h-full grid place-items-center text-center">
                <div className="max-w-xs space-y-2">
                  <div className="h-12 w-12 rounded-2xl bg-tile-yellow grid place-items-center mx-auto overflow-hidden">
                    <img src="/bot-icon.png" alt="LaPoe" className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Say hi to {activeBot?.name || "your bot"}</p>
                  <p className="text-xs text-muted-foreground">
                    Try the kind of questions your real users would ask. This preview uses the same tone, persona, rules and knowledge as Telegram.
                  </p>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <img src="/bot-icon.png" alt="" className="h-8 w-8 rounded-full object-cover shrink-0 mr-2 mt-0.5" />
                )}
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-foreground text-background rounded-3xl rounded-br-md"
                      : "text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <img src="/bot-icon.png" alt="" className="h-8 w-8 rounded-full object-cover shrink-0 mr-2 mt-0.5" />
                <div className="px-4 py-3 text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 md:p-4">
            <div className="flex items-end gap-2 rounded-3xl bg-background px-4 py-2.5 shadow-card focus-within:shadow-lift transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder={`Message ${activeBot?.name || "your bot"}…`}
                className="flex-1 resize-none bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground py-1.5 max-h-32"
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="h-9 w-9 grid place-items-center rounded-full bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
