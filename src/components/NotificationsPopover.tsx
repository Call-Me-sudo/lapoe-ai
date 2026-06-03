import { useEffect, useState } from "react";
import { Bell, Check, Megaphone, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

type N = {
  id: string;
  title: string;
  body: string;
  type: string;
  audience: string;
  link: string | null;
  created_at: string;
};

export default function NotificationsPopover() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [n, r] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("notification_reads").select("notification_id").eq("user_id", user.id),
    ]);
    setItems((n.data ?? []) as N[]);
    setReads(new Set((r.data ?? []).map((x: any) => x.notification_id)));
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = items.filter((i) => !reads.has(i.id)).length;

  const markAll = async () => {
    if (!user) return;
    const toMark = items.filter((i) => !reads.has(i.id));
    if (!toMark.length) return;
    await supabase.from("notification_reads").upsert(
      toMark.map((i) => ({ notification_id: i.id, user_id: user.id })),
      { onConflict: "notification_id,user_id" },
    );
    setReads(new Set([...reads, ...toMark.map((i) => i.id)]));
  };

  const markOne = async (id: string) => {
    if (!user || reads.has(id)) return;
    await supabase.from("notification_reads").insert({ notification_id: id, user_id: user.id });
    setReads(new Set([...reads, id]));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative grid place-items-center h-10 w-10 rounded-full bg-card shadow-card text-foreground hover:shadow-lift transition"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-foreground text-background text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll}>
              <Check className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No notifications yet
            </div>
          ) : (
            items.map((n) => {
              const isUnread = !reads.has(n.id);
              const isAdmin = n.type === "admin";
              return (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/60 transition ${isUnread ? "bg-muted/30" : ""}`}
                >
                  <span className={`h-8 w-8 shrink-0 rounded-full grid place-items-center ${isAdmin ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
                    {isAdmin ? (
                      <Megaphone className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground truncate">{n.title}</div>
                      {isUnread && <span className="h-2 w-2 rounded-full bg-foreground shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
