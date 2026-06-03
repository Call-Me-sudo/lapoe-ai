import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Rocket,
  Bot,
  BookOpen,
  Users,
  ShieldCheck,
  MessageSquare,
  CreditCard,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ArrowUp,
  Menu,
  X,
  Search,
} from "lucide-react";

type Section = {
  id: string;
  title: string;
  blurb: string;
  icon: typeof Bot;
  body: JSX.Element;
};

const sections: Section[] = [
  {
    id: "introduction",
    title: "Welcome to LaPoe",
    blurb: "What LaPoe is and who it's for.",
    icon: Sparkles,
    body: (
      <>
        <p>
          LaPoe is a calm, on-brand assistant for your Telegram community. You bring a bot,
          point it at your knowledge — your website, docs, FAQs, house rules — and LaPoe
          handles the rest: warm replies, gentle moderation, and a clean record of every
          conversation.
        </p>
        <p>
          It is built for founders, community managers, and support teams who want their
          Telegram presence to feel thoughtful and consistent, without hiring a round-the-clock
          team.
        </p>
        <div className="bg-muted/40 border rounded-2xl p-5 mt-6">
          <p className="text-sm font-semibold text-foreground mb-2">In one paragraph</p>
          <p className="text-sm text-muted-foreground leading-relaxed m-0">
            Add your bot, train it on what you already publish, invite it to your groups, and
            review everything from one dashboard. LaPoe replies when it's helpful, stays quiet
            when it isn't, and never goes off-message.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "quickstart",
    title: "Get started",
    blurb: "Your first bot, live in under five minutes.",
    icon: Rocket,
    body: (
      <>
        <p className="text-muted-foreground">A short, guided setup. No coding required.</p>
        <ol className="space-y-4 mt-5">
          {[
            <>Create your free LaPoe account at <Link to="/auth?mode=signup" className="underline underline-offset-2 text-primary">lapoe-ai.vercel.app</Link>. No card needed.</>,
            <>Open Telegram and create a bot through <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline underline-offset-2 text-primary">@BotFather</a>. Copy the token it gives you.</>,
            <>In LaPoe, go to <Link to="/dashboard/bots" className="underline underline-offset-2 text-primary">Bots</Link> and add a new bot. Paste the token and save.</>,
            <>Open <Link to="/dashboard/knowledge" className="underline underline-offset-2 text-primary">Knowledge</Link> and drop in your website URL, FAQs, or house rules. LaPoe learns from them automatically.</>,
            <>Invite your bot to a Telegram group and, if you'd like it to moderate, make it an admin.</>,
            <>Preview replies in <Link to="/dashboard/playground" className="underline underline-offset-2 text-primary">Playground</Link> before going live.</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold grid place-items-center mt-0.5">{i + 1}</span>
              <span className="text-sm leading-relaxed pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    id: "bots",
    title: "Your bots",
    blurb: "Persona, voice, and house rules.",
    icon: Bot,
    body: (
      <>
        <p>
          Every bot has a persona and a set of house rules. Keep the persona short and
          specific — a sentence or two that describes who the bot is, who it serves, and how
          it should sound.
        </p>
        <p>
          House rules are the things you'd tell a new community manager on their first day:
          how to greet people, what topics to redirect, what to never engage with. LaPoe
          follows them and can quote them back when members ask.
        </p>
        <p>
          You can run several bots from one workspace — one for support, one for community
          chat, one for announcements — each with its own voice.
        </p>
      </>
    ),
  },
  {
    id: "knowledge",
    title: "Knowledge",
    blurb: "Teach LaPoe what you already know.",
    icon: BookOpen,
    body: (
      <>
        <p>LaPoe answers from a knowledge base you control. You can add:</p>
        <ul>
          <li><strong>Website pages and blog posts</strong> — just paste the URL.</li>
          <li><strong>FAQs, internal notes, transcripts</strong> — paste them as text.</li>
          <li><strong>House rules and policies</strong> — short snippets the bot can quote.</li>
        </ul>
        <p>
          When LaPoe doesn't know an answer, the question is saved to your{" "}
          <Link to="/dashboard/inbox" className="underline underline-offset-2 text-primary">Inbox</Link>. Answer it once,
          turn the answer into a source, and the bot will handle the next person who asks.
        </p>
      </>
    ),
  },
  {
    id: "groups",
    title: "Groups and replies",
    blurb: "When LaPoe speaks, and when it doesn't.",
    icon: Users,
    body: (
      <>
        <p>In a group, your bot replies when:</p>
        <ul>
          <li>Someone mentions it directly</li>
          <li>Someone replies to one of its messages</li>
          <li>A clear question is addressed to it</li>
          <li>A question matches something in your knowledge base</li>
        </ul>
        <p>
          The rest of the time, it stays quiet. New groups appear automatically in{" "}
          <Link to="/dashboard/groups" className="underline underline-offset-2 text-primary">Groups</Link>, where you can
          rename them, pause them, or assign a different bot.
        </p>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation",
    blurb: "Keep your community calm and on-topic.",
    icon: ShieldCheck,
    body: (
      <>
        <p>
          Turn moderation on per bot. LaPoe handles spam, flooding, and banned words quietly
          in the background. Admins can also take direct action — ban, mute, warn, delete,
          pin — and every action is logged for review.
        </p>
        <p>
          Need richer group tools like welcomes, filters, scheduled announcements, and
          locks? Add <strong>@LaPoe_bot</strong> to your group. It runs alongside your own
          bot without getting in its way.
        </p>
      </>
    ),
  },
  {
    id: "dm-policy",
    title: "How DMs work",
    blurb: "What your bot does in private chats.",
    icon: MessageSquare,
    body: (
      <>
        <p>
          To keep your bot safe and predictable, it only responds to a small set of commands
          when someone messages it privately:
        </p>
        <ul>
          <li><code>/start</code> and <code>/help</code> — a friendly introduction</li>
          <li><code>/feedback</code> — leaves a note for you, the bot owner</li>
          <li><code>/donate</code> — lets fans support you (coming soon)</li>
        </ul>
        <p>
          Anything else gets a polite "please use the website or the group" reply. All
          configuration happens in your dashboard — never in a private chat with the bot.
        </p>
      </>
    ),
  },
  {
    id: "system-bot",
    title: "The LaPoe bot",
    blurb: "A shared bot for groups and account control.",
    icon: Sparkles,
    body: (
      <>
        <p>
          <strong>@LaPoe_bot</strong> is a shared assistant we run for everyone. It does
          two things:
        </p>
        <ol>
          <li>
            <strong>Group tools.</strong> Add it to any group and promote it to admin to get
            welcomes, rules, filters, notes, locks, warns, and mutes — the everyday tools
            community managers need.
          </li>
          <li>
            <strong>Account control from Telegram.</strong> Once you link your Telegram
            account in <Link to="/dashboard/settings" className="underline underline-offset-2 text-primary">Settings</Link>,
            you can manage your LaPoe account and your bots from a private chat with
            @LaPoe_bot.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "billing",
    title: "Plans and billing",
    blurb: "Pick the plan that fits your community.",
    icon: CreditCard,
    body: (
      <>
        <p>
          LaPoe comes in four plans — Free, Starter, Pro, and Business — that grow with the
          size of your community. See the current details on the{" "}
          <Link to="/pricing" className="underline underline-offset-2 text-primary">pricing page</Link>.
        </p>
        <p>
          Manage your subscription, switch plans, and download invoices from{" "}
          <Link to="/dashboard/billing" className="underline underline-offset-2 text-primary">Billing</Link>. Your usage
          this month is shown on the same page, so there are no surprises.
        </p>
      </>
    ),
  },
  {
    id: "faq",
    title: "Frequently asked",
    blurb: "Quick answers to common questions.",
    icon: HelpCircle,
    body: (
      <>
        <h4>Will my bot reply to every "hi"?</h4>
        <p>No. Short greetings are safe and never flagged. LaPoe only replies when it has something useful to add.</p>
        <h4>Can I customize the welcome message?</h4>
        <p>Yes. Set a custom welcome per bot or per group in your dashboard. Otherwise a friendly default is used.</p>
        <h4>Can I configure my bot by chatting with it privately?</h4>
        <p>No — by design. All configuration lives in the dashboard or in @LaPoe_bot, so settings stay safe and auditable.</p>
        <h4>Is my community's data private?</h4>
        <p>Yes. Your knowledge, conversations, and settings are yours. We don't share them or use them to train shared models.</p>
        <h4>How do I get help?</h4>
        <p>Email <a href="mailto:support@lapoe.app" className="underline underline-offset-2 text-primary">support@lapoe.app</a>. We reply within one business day.</p>
      </>
    ),
  },
];

export default function Docs() {
  const [active, setActive] = useState(sections[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Help Center — LaPoe"
        description="Everything you need to set up, train, and run LaPoe in your Telegram community. Quickstart guides, moderation, knowledge base, plans, and FAQs."
        path="/docs"
        keywords="LaPoe help, Telegram bot guide, community moderation, knowledge base, support"
      />

      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="container max-w-6xl flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src="/bot-icon.png" alt="LaPoe" className="h-7 w-7 rounded-lg" />
            <span className="font-display font-semibold text-foreground text-base">
              LaPoe <span className="text-muted-foreground font-normal">Help Center</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button size="sm" className="hidden md:flex" asChild>
              <Link to="/auth?mode=signup">Get started</Link>
            </Button>
            <button
              className="md:hidden p-2 hover:bg-muted rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => handleNavClick(s.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  active === s.id
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.title}
              </button>
            ))}
            <div className="pt-3 border-t mt-2 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link to="/auth?mode=signup">Get started</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container max-w-5xl py-14 md:py-20 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background border border-border/60 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Help Center
          </span>
          <h1 className="mt-5 font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            How can we help?
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Guides, answers, and best practices for running LaPoe in your community.
          </p>

          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the help center…"
              className="w-full h-12 pl-11 pr-4 rounded-full bg-card border border-border/60 shadow-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
            />
          </div>
        </div>
      </section>

      {/* Topic grid */}
      <section className="container max-w-6xl py-12 md:py-16">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground mb-6">
          Browse topics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => handleNavClick(s.id)}
              className="group text-left"
            >
              <Card className="p-5 h-full border border-border/60 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center shrink-0">
                    <s.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.blurb}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-80 group-hover:opacity-100 transition">
                  Read more
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Card>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-10">
              No topics match "{query}". Try a different search.
            </p>
          )}
        </div>
      </section>

      {/* Full content */}
      <section className="container max-w-6xl pb-16">
        <div className="grid gap-10 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
          <aside className="hidden md:block">
            <div className="sticky top-20">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 px-3">
                On this page
              </div>
              <nav className="flex flex-col gap-0.5">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleNavClick(s.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                      active === s.id
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <s.icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-8 px-3">
                <div className="bg-muted/50 rounded-2xl p-5 border border-border/60">
                  <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                    Need a hand?
                  </p>
                  <p className="text-sm text-foreground mb-3">
                    Our team replies within one business day.
                  </p>
                  <a
                    href="mailto:support@lapoe.app"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    support@lapoe.app
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {sections.map((s) => (
              <Card
                key={s.id}
                id={s.id}
                className="p-7 md:p-9 scroll-mt-24 border border-border/60"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center shrink-0">
                    <s.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
                      {s.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{s.blurb}</p>
                  </div>
                </div>
                <div className="prose-docs">{s.body}</div>
              </Card>
            ))}

            {/* CTA */}
            <Card className="p-8 md:p-10 border border-border/60 bg-gradient-to-br from-secondary/40 to-background text-center">
              <h3 className="font-display text-2xl font-semibold text-foreground">
                Still have a question?
              </h3>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                We're a small team and we read every message. Tell us what you're trying to do and we'll help.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <Button asChild>
                  <a href="mailto:support@lapoe.app">Contact support</a>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/auth?mode=signup">Start free</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform grid place-items-center"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <SiteFooter />
    </div>
  );
}
