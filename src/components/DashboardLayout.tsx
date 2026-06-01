import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import {
  LayoutDashboard, Bot, Users, BookOpen, MessageSquare, CreditCard, Settings,
  LogOut, Menu, X, Search, Bell, ChevronDown, Sparkles, HelpCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight text-ink">KADE</span>
        </Link>
        <button
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-ink"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((g) => (
          <div key={g.label}>
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-ink-soft hover:text-ink hover:bg-accent"
                    }`
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

      <div className="border-t border-border p-3">
        <a
          href="mailto:support@kade.app"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-soft hover:text-ink hover:bg-accent"
        >
          <HelpCircle className="h-4 w-4" /> Help & support
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-soft">
      <div className="md:grid md:grid-cols-[248px_1fr] md:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:block border-r border-border bg-card sticky top-0 h-screen">
          {Sidebar}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[82%] max-w-xs bg-card border-r border-border animate-in slide-in-from-left">
              {Sidebar}
            </aside>
          </>
        )}

        <div className="flex flex-col min-w-0">
          {/* App header */}
          <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 md:px-6 border-b border-border bg-card/80 backdrop-blur">
            <button
              className="md:hidden p-2 -ml-2 text-ink"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-ink truncate">{pageTitle}</h1>
            </div>

            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm text-muted-foreground w-64">
                <Search className="h-4 w-4" />
                <span className="truncate">Search…</span>
              </div>

              <Button variant="ghost" size="icon" aria-label="Notifications" className="text-ink-soft">
                <Bell className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md pl-1 pr-2 py-1 hover:bg-accent transition">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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

          <main className="flex-1 overflow-x-hidden">
            <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
