import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="container max-w-5xl mt-24 mb-8">
      <div className="bg-card rounded-3xl shadow-card p-8 md:p-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-foreground text-background grid place-items-center">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="font-display text-lg font-bold text-foreground">LaPoe</div>
          </div>
          <p className="text-muted-foreground mt-3 max-w-xs">
            Knowledge Acquisition & Dynamic Engagement — the calm desk for your Telegram community.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3 text-foreground">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/#features" className="hover:text-foreground">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3 text-foreground">Account</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Log in</Link></li>
            <li><Link to="/auth?mode=signup" className="hover:text-foreground">Sign up</Link></li>
          </ul>
        </div>
        <div className="text-muted-foreground md:text-right">
          © {new Date().getFullYear()} LaPoe
        </div>
      </div>
    </footer>
  );
}
