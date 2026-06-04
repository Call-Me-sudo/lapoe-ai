import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="container max-w-5xl mt-24 mb-8">
      <div className="bg-card rounded-3xl shadow-card p-8 md:p-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <img src="/bot-icon.png" alt="LaPoe" className="h-8 w-8 rounded-full object-cover" />
            <div className="font-display text-lg font-bold text-foreground">LaPoe</div>
          </div>
          <p className="text-muted-foreground mt-3 max-w-xs">
            Poe · Language into existence — the calm desk for your Telegram community.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3 text-foreground">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/#features" className="hover:text-foreground">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link to="/docs" className="hover:text-foreground">Docs</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3 text-foreground">Account</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Log in</Link></li>
            <li><Link to="/auth?mode=signup" className="hover:text-foreground">Sign up</Link></li>
          </ul>
        </div>
        <div className="md:text-right">
          <div className="font-semibold mb-3 text-foreground">Legal</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/legal/terms" className="hover:text-foreground">Terms of Service</Link></li>
            <li><Link to="/legal/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/legal/privacy#california-ccpa--cpra" className="hover:text-foreground">Your privacy rights</Link></li>
          </ul>
          <div className="text-muted-foreground mt-4 text-xs">© {new Date().getFullYear()} LaPoe</div>
        </div>
      </div>
    </footer>
  );
}
