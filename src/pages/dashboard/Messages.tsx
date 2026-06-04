import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Messages() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bot_messages")
      .select("*, bots(name), telegram_groups(name)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setMsgs(data ?? []));
  }, [user]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Messages"
        description="Live log of what LaPoe sees and sends. Newest first."
      />

      {msgs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <MessageSquare className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No activity yet. Once your bot is connected to Telegram, messages will appear here.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card divide-y divide-border">
          {msgs.map((m) => (
            <div key={m.id} className="p-4 flex gap-4">
              <Badge variant={m.direction === "inbound" ? "secondary" : "default"}>{m.direction}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-ink-soft">
                  {m.bots?.name || "LaPoe Assistant"} · {m.telegram_groups?.name || "DM"} · {m.telegram_user || "—"} · {new Date(m.created_at).toLocaleString()}
                </div>
                <p className="text-sm text-ink mt-1 break-words">{m.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
