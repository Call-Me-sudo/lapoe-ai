import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import {
  LayoutDashboard, Bot, Users, BookOpen, MessageSquare, CreditCard, Settings,
  LogOut, Menu, X, Bell, Sparkles, HelpCircle, QrCode, PlayCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationsPopover from "@/components/NotificationsPopover";

import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof Bot; label: string; end?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Overview", end: true }],
  },
  {
    label: "Automation",
    items: [
      { to: "/dashboard/bots", icon: Bot, label: "Bots" },
      { to: "/dashboard/playground", icon: PlayCircle, label: "Playground" },
      { to: "/dashboard/groups", icon: Users, label: "Groups" },
      { to: "/dashboard/knowledge", icon: BookOpen, label: "Knowledge" },
    ],
  },
  {
    label: "Activity",
    items: [{ to: "/dashboard/messages", icon: MessageSquare, label: "Messages" }],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/billing", icon: CreditCard, label: "Billing" },
      { to: "/dashboard/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/bots": "Bots",
  "/dashboard/playground": "Playground",
  "/dashboard/groups": "Groups",
  "/dashboard/knowledge": "Knowledge",
  "/dashboard/messages": "Messages",
  "/dashboard/billing": "Billing",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = titles[pathname] ?? "Workspace";
  const initials = (user?.email?.[0] || "U").toUpperCase();

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-16 flex items-center justify-between px-5">
        <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-tile-green text-tile-green-foreground grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">LaPoe</span>
        </Link>
        <button
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {navGroups.map((g) => (
          <div key={g.label}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {g.label}
            </div>
            <div className="space-y-1">
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )
                  }
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{n.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <a
          href="mailto:support@lapoe.app"
          className="flex items-center gap-3 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <HelpCircle className="h-4 w-4" /> Help & support
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="md:grid md:grid-cols-[260px_1fr] md:min-h-screen">
        {/* Desktop sidebar — floating white pill rail */}
        <aside className="hidden md:block sticky top-0 h-screen p-4">
          <div className="h-full bg-card rounded-3xl shadow-card overflow-hidden flex flex-col">
            {Sidebar}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <aside className="md:hidden fixed inset-y-3 left-3 z-50 w-[80%] max-w-xs bg-card rounded-3xl shadow-lift animate-in slide-in-from-left overflow-hidden flex flex-col">
              {Sidebar}
            </aside>
          </>
        )}

        <div className="flex flex-col min-w-0">
          {/* App header — light, no border */}
          <header className="sticky top-0 z-30 h-16 flex items-center gap-2 px-4 md:px-8 bg-background/80 backdrop-blur">
            <button
              className="md:hidden p-2 -ml-2 text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-display text-lg md:text-xl font-bold text-foreground truncate">{pageTitle}</h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="hidden sm:grid place-items-center h-10 w-10 rounded-full bg-card shadow-card text-foreground hover:shadow-lift transition" aria-label="QR">
                <QrCode className="h-4 w-4" />
              </button>
              <NotificationsPopover />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid place-items-center h-10 w-10 rounded-full overflow-hidden hover:opacity-90 transition" aria-label="Account">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm bg-tile-pink text-tile-pink-foreground font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuLabel className="truncate font-normal text-xs text-muted-foreground">
                    {user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard/billing")}>
                    <CreditCard className="h-4 w-4" /> Billing
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden pb-8">
            <div className="px-4 md:px-8 py-4 md:py-6 max-w-6xl w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
