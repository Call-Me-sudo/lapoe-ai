import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, CheckCircle2 } from "lucide-react";
import { SiTelegram } from "react-icons/si";
import { toast } from "sonner";
import { autoLinkTelegramIfPossible } from "@/lib/telegram";

export default function Settings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("display_name,telegram_username").eq("id", user.id).maybeSingle();
    setDisplayName(data?.display_name ?? "");
    setTelegramUsername(data?.telegram_username ?? null);
  };

  useEffect(() => {
    loadProfile();
    autoLinkTelegramIfPossible().then((r) => {
      if (r?.linked) {
        toast.success(`Telegram linked${r.username ? ` as @${r.username}` : ""}`);
        loadProfile();
      }
    }).catch(() => {});
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const generateCode = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-link-code");
    setGenerating(false);
    if (error) return toast.error(error.message);
    setCode(data.code);
  };

  return (
    <DashboardLayout>
      <PageHeader title="Settings" description="Your profile and integrations." />

      <div className="border border-border rounded-lg bg-card p-6 max-w-lg space-y-4 mb-6">
        <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} /></div>
        <Button onClick={save} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
      </div>

      <div className="border border-border rounded-lg bg-card p-6 max-w-lg">
        <div className="flex items-center gap-2 mb-3">
          <SiTelegram className="h-4 w-4 text-[#229ED9]" />
          <h2 className="text-base font-semibold text-ink">Telegram — LaPoe system bot</h2>
        </div>

        {telegramUsername ? (
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="text-ink font-medium">Linked as @{telegramUsername}</div>
              <p className="text-ink-soft mt-1">
                Open Telegram and send <code className="bg-paper-soft px-1.5 py-0.5 rounded">/help</code> to{" "}
                <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer" className="text-primary underline">@LaPoe_bot</a>
                {" "}to control your LaPoe workspace.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft mb-4">
              Link your Telegram account to control LaPoe from your phone. Get a code, then send it to{" "}
              <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer" className="text-primary underline">@LaPoe_bot</a>.
            </p>
            {code ? (
              <div className="bg-paper-soft border border-border rounded-md p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your one-time code</div>
                <div className="text-2xl font-semibold text-ink tracking-[0.3em] tabular-nums">{code}</div>
                <p className="text-xs text-ink-soft mt-3">
                  Open <a href="https://t.me/LaPoe_bot" target="_blank" rel="noreferrer" className="text-primary underline">@LaPoe_bot</a>{" "}
                  and send: <code className="bg-card px-1.5 py-0.5 rounded">/link {code}</code>
                </p>
                <p className="text-xs text-ink-soft mt-1">Expires in 15 minutes.</p>
              </div>
            ) : (
              <Button variant="warm" onClick={generateCode} disabled={generating}>
                <Link2 className="h-4 w-4" /> {generating ? "Generating…" : "Generate link code"}
              </Button>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
