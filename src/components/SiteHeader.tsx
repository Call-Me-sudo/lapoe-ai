import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-4 z-40 px-4">
      <div className="container max-w-5xl bg-card rounded-full shadow-card border border-border/40 flex h-14 items-center justify-between px-4 pl-5">
        <Link to="/" className="flex items-center gap-2">
          <img src="/bot-icon.png" alt="LaPoe" className="h-8 w-8 rounded-full object-cover" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">LaPoe</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <Link to="/#features" className="hover:text-foreground transition">Features</Link>
          <Link to="/#how" className="hover:text-foreground transition">How it works</Link>
          <Link to="/pricing" className="hover:text-foreground transition">Pricing</Link>
          <Link to="/docs" className="hover:text-foreground transition">Docs</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              <Button variant="default" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="hidden sm:inline-flex">Log in</Button>
              <Button variant="default" size="sm" onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
