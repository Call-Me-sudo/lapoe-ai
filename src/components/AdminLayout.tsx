import { Link, NavLink, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import {
  Shield, LayoutDashboard, Users, Bot as BotIcon, MessageSquare,
  Activity, AlertTriangle, LogOut, Menu, X, Megaphone, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/bots", icon: BotIcon, label: "User bots" },
  { to: "/admin/system-bot", icon: Sparkles, label: "System bot" },
  { to: "/admin/messages", icon: MessageSquare, label: "Messages" },
  { to: "/admin/notifications", icon: Megaphone, label: "Notifications" },
  { to: "/admin/moderation", icon: AlertTriangle, label: "Moderation" },
  { to: "/admin/activity", icon: Activity, label: "Live activity" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarBody = (
    <>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="h-8 w-8 rounded-full bg-foreground text-background grid place-items-center">
              <Shield className="h-4 w-4" />
            </span>
            <div>
              <div className="font-display text-lg font-bold text-foreground leading-none">LaPoe</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1">Control room</div>
            </div>
          </Link>
          <button className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition",
                isActive ? "bg-foreground text-background shadow-pill" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <div className="text-xs text-muted-foreground truncate mb-2">{user?.email}</div>
        <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); navigate("/"); }}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur">
        <button onClick={() => setMobileOpen(true)} className="grid place-items-center h-10 w-10 rounded-full bg-card shadow-card text-foreground" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-foreground" />
          <span className="font-display text-base font-bold text-foreground">LaPoe Admin</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="md:grid md:grid-cols-[260px_1fr] md:min-h-screen">
        <aside className="hidden md:block sticky top-0 h-screen p-4">
          <div className="h-full bg-card rounded-3xl shadow-card flex flex-col overflow-hidden">{SidebarBody}</div>
        </aside>

        {mobileOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <aside className="md:hidden fixed inset-y-3 left-3 z-50 w-[80%] max-w-xs bg-card rounded-3xl shadow-lift flex flex-col animate-in slide-in-from-left overflow-hidden">
              {SidebarBody}
            </aside>
          </>
        )}

        <main className="overflow-x-hidden">
          <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
