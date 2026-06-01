import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ActionRow from "@/components/ActionRow";
import IconTile from "@/components/IconTile";
import { MessagesSquare, Shield, BookOpen, Users, Sparkles, Settings2, ArrowUpRight, QrCode } from "lucide-react";

const features = [
  { icon: MessagesSquare, tone: "blue" as const, title: "Conversations, not commands", body: "Reads context, replies like a thoughtful teammate, knows when to stay quiet." },
  { icon: BookOpen, tone: "green" as const, title: "Reads your blogs & docs", body: "Point it at your sources. It cites them when it answers." },
  { icon: Shield, tone: "pink" as const, title: "Group administration", body: "Add, remove, mute, warn, pin, schedule — enforce rules everywhere." },
  { icon: Users, tone: "violet" as const, title: "Multi-bot, multi-group", body: "One workspace for every community you run." },
  { icon: Sparkles, tone: "amber" as const, title: "AI included, no setup", body: "Powerful models built in — nothing to configure, just turn it on." },
  { icon: Settings2, tone: "gray" as const, title: "Live admin desk", body: "Watch replies in real time. Step in, take over, hand back." },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="container max-w-5xl pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card shadow-card text-xs font-medium text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-tile-green-foreground" />
            New · Knowledge Acquisition & Dynamic Engagement
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.02] text-foreground text-balance tracking-tight">
            A calm communications desk for your <span className="text-tile-blue-foreground">Telegram</span> community.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            KADE answers from your blog and group history, moderates with rules you set, and works alongside you — not in place of you.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Button asChild variant="default" size="xl">
              <Link to="/auth?mode=signup">Start free <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="warm" size="xl">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free plan · No card required · Bring your own OpenAI key</p>
        </div>

        {/* Phone-style preview card */}
        <div className="mt-16 max-w-md mx-auto">
          <div className="bg-card rounded-3xl shadow-card overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-tile-pink text-tile-pink-foreground grid place-items-center font-bold">JW</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Your workspace</div>
                  <div className="text-xs text-muted-foreground">Live</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="grid place-items-center h-9 w-9 rounded-full bg-muted text-foreground"><QrCode className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="divide-y divide-border/60">
              {features.slice(0, 4).map((f) => (
                <ActionRow key={f.title} icon={f.icon} tone={f.tone} title={f.title} description={f.body} showChevron />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container max-w-5xl py-16 md:py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3 font-semibold">Features</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance tracking-tight">
            Everything a careful community manager needs.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card rounded-3xl shadow-card p-6">
              <IconTile icon={f.icon} tone={f.tone} size="lg" />
              <h3 className="font-display font-bold text-lg text-foreground mt-5 mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container max-w-5xl py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3 font-semibold">How it works</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance tracking-tight">
              Set up in an afternoon. Refine forever.
            </h2>
          </div>
          <div className="bg-card rounded-3xl shadow-card divide-y divide-border/60 overflow-hidden">
            {[
              ["01", "Create your bot in Telegram", "Paste the bot token into KADE — that's it.", "blue"],
              ["02", "Add knowledge & rules", "Drop blog URLs, write house rules, define tone.", "green"],
              ["03", "Add to a group", "Invite KADE. Promote to admin for moderation.", "pink"],
              ["04", "Watch the desk", "See every message in your dashboard. Step in anytime.", "violet"],
            ].map(([n, t, d, tone]) => (
              <div key={n as string} className="flex items-center gap-4 px-5 py-4">
                <div className={`h-11 w-11 rounded-2xl grid place-items-center font-display font-bold bg-tile-${tone} text-tile-${tone}-foreground`}>{n}</div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container max-w-5xl pb-16">
        <div className="rounded-3xl bg-foreground text-background p-10 md:p-16 text-center shadow-pill">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-balance max-w-2xl mx-auto tracking-tight">
            Your community deserves a calm, well-read desk clerk.
          </h2>
          <p className="text-background/70 mt-4 max-w-xl mx-auto">
            Try KADE free. Upgrade when your community grows.
          </p>
          <Button asChild variant="warm" size="xl" className="mt-8">
            <Link to="/auth?mode=signup">Create your workspace <ArrowUpRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
