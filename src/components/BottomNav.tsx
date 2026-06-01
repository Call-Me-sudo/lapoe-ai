import { NavLink } from "react-router-dom";
import { Home, Bot, MessageSquare, Settings, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; icon: LucideIcon; label: string; end?: boolean };

const items: Item[] = [
  { to: "/dashboard", icon: Home, label: "Home", end: true },
  { to: "/dashboard/bots", icon: Bot, label: "Bots" },
  { to: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav({ items: custom }: { items?: Item[] }) {
  const nav = custom ?? items;
  return (
    <div className="md:hidden fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
      <nav
        className="pointer-events-auto mx-auto max-w-md flex items-center justify-between gap-1 px-2 py-2 rounded-full bg-muted/90 backdrop-blur shadow-pill border border-border/60"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-full text-[11px] font-medium transition-all",
                isActive
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <n.icon className="h-5 w-5" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
