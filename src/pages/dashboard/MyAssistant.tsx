import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, Link2, BookOpen, Copy } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type Persona = {
  owner_id: string;
  display_name: string | null;
  tone: string;
  personality: string | null;
  welcome_message: string | null;
  house_rules: string | null;
};

type Usage = {
  plan: string;
  monthly_messages: number;
  max_monthly_messages: number;
  allowed: boolean;
};

const TONES = ["friendly", "professional", "witty", "strict", "hype"];

export default function MyAssistant() {
  const { user } = useAuth();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [tgLinked, setTgLinked] = useState(false);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: u }, { data: prof }, { count: kc }] = await Promise.all([
      supabase.from("system_bot_personas").select("*").eq("owner_id", user.id).maybeSingle(),
      (supabase as any).rpc("my_system_bot_usage"),
      supabase.from("profiles").select("telegram_username,telegram_user_id").eq("id", user.id).maybeSingle(),
      supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("scope", "system_bot"),
    ]);
    setPersona(p ?? { owner_id: user.id, display_name: "", tone: "friendly", personality: "", welcome_message: "", house_rules: "" });
    setUsage(Array.isArray(u) ? u[0] : u);
    setTgLinked(!!prof?.telegram_user_id);
    setKnowledgeCount(kc ?? 0);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user || !persona) return;
    setSaving(true);
    const { error } = await supabase.from("system_bot_personas").upsert({
      owner_id: user.id,
      display_name: persona.display_name || null,
      tone: persona.tone || "friendly",
      personality: persona.personality || null,
      welcome_message: persona.welcome_message || null,
      house_rules: persona.house_rules || null,
    }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const generateLinkCode = async () => {
    const { data, error } = await supabase.functions.invoke("generate-link-code");
    if (error) return toast.error(error.message);
    setLinkCode((data as any)?.code || null);
  };

  const isFree = (usage?.plan ?? "free") === "free";
  const pct = usage ? Math.min(100, Math.round((usage.monthly_messages / Math.max(1, usage.max_monthly_messages)) * 100)) : 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="My Assistant"
        description={isFree
          ? "Your free AI assistant on @LaPoe_bot. Set its voice, knowledge, and link your Telegram to start chatting."
          : "Your shared @LaPoe_bot persona. Your paid plan uses your custom bots — this is just an extra."}
      />

      {loading && !usage && (
        <div className="mb-6 border border-border rounded-lg bg-card p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-2 w-full" />
        </div>
      )}

      {usage && (
        <div className="mb-6 border border-border rounded-lg bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="text-sm text-ink-soft">
              <span className="capitalize text-ink font-medium">{usage.plan} plan</span>
              {isFree && " · resets on the 1st"}
            </div>
            {isFree && !usage.allowed && (
              <Button size="sm" onClick={() => (window.location.href = "/pricing")}>Upgrade for unlimited</Button>
            )}
          </div>
          <div className="flex justify-between text-xs text-ink-soft mb-1">
            <span>AI replies this month</span>
            <span>{usage.monthly_messages} / {usage.max_monthly_messages}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${!usage.allowed ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg p-5 bg-card">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
            <img src="/bot-icon.png" alt="" className="h-5 w-5 rounded" /> Persona
          </h3>
          <p className="text-xs text-ink-soft mb-4">Shapes how @LaPoe_bot speaks for you in DMs and your group.</p>
          {persona && (
            <div className="space-y-4">
              <div>
                <Label>Display name</Label>
                <Input
                  value={persona.display_name ?? ""}
                  onChange={(e) => setPersona({ ...persona, display_name: e.target.value })}
                  placeholder="e.g. Acme Support"
                  maxLength={80}
                />
              </div>
              <div>
                <Label>Tone</Label>
                <Select value={persona.tone} onValueChange={(v) => setPersona({ ...persona, tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Accordion type="single" collapsible className="border border-border rounded-md px-3 -mx-1">
                <AccordionItem value="advanced" className="border-0">
                  <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                    Advanced settings <span className="text-xs text-ink-soft font-normal ml-1">(optional)</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-1">
                    <div>
                      <Label>Personality</Label>
                      <Input
                        value={persona.personality ?? ""}
                        onChange={(e) => setPersona({ ...persona, personality: e.target.value })}
                        placeholder="Sassy librarian / no-nonsense ops manager / etc."
                        maxLength={500}
                      />
                    </div>
                    <div>
                      <Label>Welcome message (groups)</Label>
                      <Textarea
                        value={persona.welcome_message ?? ""}
                        onChange={(e) => setPersona({ ...persona, welcome_message: e.target.value })}
                        rows={2}
                        maxLength={500}
                        placeholder="Welcome {name}! Ask me anything about our community."
                      />
                    </div>
                    <div>
                      <Label>House rules</Label>
                      <Textarea
                        value={persona.house_rules ?? ""}
                        onChange={(e) => setPersona({ ...persona, house_rules: e.target.value })}
                        rows={3}
                        maxLength={1000}
                        placeholder="Never share pricing. Always offer the trial link."
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save persona"}</Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-border rounded-lg p-5 bg-card">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
              <Link2 className="h-5 w-5 text-primary" /> Connect Telegram
            </h3>
            <p className="text-xs text-ink-soft mb-4">Generate a code and send it to <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer" className="text-primary hover:underline">@LaPoe_bot</a> as <code className="text-[11px]">/link YOUR_CODE</code>.</p>
            {tgLinked ? (
              <Badge variant="default">✓ Linked</Badge>
            ) : linkCode ? (
              <div className="flex items-center gap-2">
                <code className="font-mono text-base bg-muted px-3 py-1.5 rounded">{linkCode}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(linkCode); toast.success("Copied"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /> Open bot</Button>
                </a>
              </div>
            ) : (
              <Button onClick={generateLinkCode} variant="outline" size="sm">Generate link code</Button>
            )}
          </div>

          <div className="border border-border rounded-lg p-5 bg-card">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
              <BookOpen className="h-5 w-5 text-primary" /> Knowledge
            </h3>
            <p className="text-xs text-ink-soft mb-4">
              {knowledgeCount > 0
                ? `${knowledgeCount} source${knowledgeCount === 1 ? "" : "s"} feed your assistant.`
                : "No knowledge yet. Without it your assistant can only chat in persona."}
            </p>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/dashboard/knowledge")}>
              Manage knowledge
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
