import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Rocket, Bot, BookOpen, Users, Shield, MessageSquare,
  CreditCard, Code2, HelpCircle, Sparkles,
} from "lucide-react";

type Section = {
  id: string;
  title: string;
  icon: typeof Bot;
  body: JSX.Element;
};

const sections: Section[] = [
  {
    id: "introduction",
    title: "Introduction",
    icon: Sparkles,
    body: (
      <>
        <p>
          <strong>LaPoe</strong> is a multi-tenant Telegram assistant platform. You create a bot
          on Telegram, paste the token into LaPoe, point it at your knowledge sources, and invite
          it to your groups. LaPoe reads the room, replies like a thoughtful teammate, moderates
          when asked, and gives you a full audit trail in the dashboard.
        </p>
        <p>
          There are two kinds of bots on the platform:
        </p>
        <ul>
          <li>
            <strong>User bots</strong> — your own bots, created via{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>.
            LaPoe polls Telegram on their behalf and replies using your persona, knowledge, and rules.
          </li>
          <li>
            <strong>The system bot</strong> (<code>@LaPoe_bot</code>) — a shared, general-purpose
            group bot. Add it to any group for Rose-style moderation, and use it from DM as a
            control center for your LaPoe account.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "quickstart",
    title: "Quickstart",
    icon: Rocket,
    body: (
      <>
        <ol>
          <li>
            <strong>Create an account</strong> on <Link to="/auth?mode=signup">lapoe.app</Link>.
            Free plan, no card required.
          </li>
          <li>
            <strong>Create a Telegram bot</strong>. Open{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>,
            send <code>/newbot</code>, follow the prompts, and copy the token.
          </li>
          <li>
            <strong>Add the bot to LaPoe</strong>. Go to{" "}
            <Link to="/dashboard/bots">Dashboard → Bots</Link>, click <em>New bot</em>, paste the
            token, and save. LaPoe starts polling within a minute.
          </li>
          <li>
            <strong>Train it.</strong> In <Link to="/dashboard/knowledge">Knowledge</Link>, drop
            in URLs, paste text, or write house rules. LaPoe indexes them automatically.
          </li>
          <li>
            <strong>Invite your bot to a Telegram group</strong> and promote it to admin if you
            want it to moderate.
          </li>
          <li>
            <strong>Test it</strong> in{" "}
            <Link to="/dashboard/playground">Playground</Link> before shipping to your community.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "bots",
    title: "Bots",
    icon: Bot,
    body: (
      <>
        <p>
          Each bot has a persona, a knowledge scope, and a set of house rules. You can run several
          bots from one workspace — for example one for support and one for community chat — each
          with its own tone of voice.
        </p>
        <h4>Persona</h4>
        <p>
          A short system prompt. Keep it warm and specific:
        </p>
        <pre><code>{`You are LaPoe for [Your Community].
Be warm, concise, and cite sources when you can.`}</code></pre>
        <h4>House rules</h4>
        <p>
          Plain-text rules the bot is expected to enforce and reference. Used both as moderation
          guidance and as something the bot can quote when asked "what are the rules?".
        </p>
      </>
    ),
  },
  {
    id: "knowledge",
    title: "Knowledge",
    icon: BookOpen,
    body: (
      <>
        <p>
          LaPoe answers from a knowledge base you control. Sources can be:
        </p>
        <ul>
          <li><strong>URLs</strong> — blog posts, docs, landing pages. Re-indexed on a schedule.</li>
          <li><strong>Pasted text</strong> — FAQs, internal notes, transcripts.</li>
          <li><strong>House rules</strong> — short policy snippets the bot can quote verbatim.</li>
        </ul>
        <p>
          Sources are chunked and indexed for retrieval. When a user asks a question, LaPoe pulls
          the most relevant chunks and the AI cites them in the reply. Questions that nothing in
          the knowledge base covers are saved to{" "}
          <Link to="/dashboard/inbox">Inbox</Link> so you can answer them once and turn the
          answer into a new source.
        </p>
      </>
    ),
  },
  {
    id: "groups",
    title: "Groups & replies",
    icon: Users,
    body: (
      <>
        <p>In a group, a user bot will reply when:</p>
        <ul>
          <li>It is mentioned (<code>@yourbot</code>)</li>
          <li>Someone replies to one of its messages</li>
          <li>A greeting or direct question is addressed to it</li>
          <li>A question matches something in its knowledge base</li>
        </ul>
        <p>
          Otherwise it stays quiet. Groups are auto-registered on first message and listed under{" "}
          <Link to="/dashboard/groups">Groups</Link>, where you can rename, disable, or change
          which bot owns the group.
        </p>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation",
    icon: Shield,
    body: (
      <>
        <p>
          Toggle moderation per bot. When on, the bot enforces anti-spam, anti-flood, and
          banned-word rules. Group admins (and the linked bot owner) can also run:
        </p>
        <pre><code>{`/ban     /unban    /kick
/mute    /unmute   /warn
/del     /pin      /unpin`}</code></pre>
        <p>
          Every action is logged. Review history in{" "}
          <Link to="/dashboard/messages">Messages</Link> with the moderation filter on.
        </p>
        <h4>System bot extras</h4>
        <p>
          For richer Rose-style features — rules, welcomes, filters, notes, locks, scheduled
          announcements — add <code>@LaPoe_bot</code> to your group. It runs as a separate bot
          with its own command surface and does not conflict with your own bots.
        </p>
      </>
    ),
  },
  {
    id: "dm-policy",
    title: "Bot DM policy",
    icon: MessageSquare,
    body: (
      <>
        <p>
          <strong>User bots never accept configuration in their own DMs — not even from the owner.</strong>
          {" "}This is deliberate. It prevents probing strangers from discovering admin
          surface area, eliminates self-reply loops, and keeps configuration auditable in
          one place.
        </p>
        <p>The only commands a user bot accepts in DM are:</p>
        <ul>
          <li><code>/start</code>, <code>/help</code> — friendly intro</li>
          <li><code>/feedback &lt;text&gt;</code> — leaves a note for the bot owner</li>
          <li><code>/donate</code> — support the bot owner (coming soon)</li>
        </ul>
        <p>
          Everything else in DM falls through to AI chat. Configuration belongs in the dashboard
          or in <code>@LaPoe_bot</code>.
        </p>
      </>
    ),
  },
  {
    id: "system-bot",
    title: "System bot (@LaPoe_bot)",
    icon: Sparkles,
    body: (
      <>
        <p>
          <code>@LaPoe_bot</code> is the shared system bot. It serves two purposes:
        </p>
        <ol>
          <li>
            <strong>General-purpose group bot</strong> — rules, welcomes, filters, warns,
            mutes/bans, notes, locks. Add it to any group and promote to admin.
          </li>
          <li>
            <strong>Account control</strong> — once you link your Telegram user via{" "}
            <code>/link</code>, you can manage your LaPoe account and user bots from a Telegram
            DM with <code>@LaPoe_bot</code>.
          </li>
        </ol>
        <p>
          Linking codes are generated in{" "}
          <Link to="/dashboard/settings">Dashboard → Settings</Link>.
        </p>
      </>
    ),
  },
  {
    id: "billing",
    title: "Billing & plans",
    icon: CreditCard,
    body: (
      <>
        <p>
          LaPoe has four tiers: Free, Starter, Pro, and Business. Plans differ on number of bots,
          number of groups, and monthly logged messages. See{" "}
          <Link to="/pricing">pricing</Link> for the current breakdown.
        </p>
        <p>
          Billing runs on Stripe. Manage your subscription, change plan, or download invoices
          from <Link to="/dashboard/billing">Dashboard → Billing</Link>. Usage is metered monthly
          and visible on the same page.
        </p>
      </>
    ),
  },
  {
    id: "stack",
    title: "Stack & security",
    icon: Code2,
    body: (
      <>
        <ul>
          <li><strong>Frontend</strong> — React 18, Vite, TypeScript, Tailwind, shadcn/ui</li>
          <li><strong>Backend</strong> — Lovable Cloud (auth, database, edge functions, storage)</li>
          <li><strong>AI</strong> — Lovable AI Gateway with Google Gemini for chat and embeddings</li>
          <li><strong>Retrieval</strong> — Postgres full-text search over indexed chunks</li>
          <li><strong>Telegram</strong> — long-polling (<code>getUpdates</code>) on a cron schedule</li>
          <li><strong>Payments</strong> — Stripe</li>
        </ul>
        <p>
          Bot tokens are stored server-side and only used by the polling worker. Dashboard
          sessions are secured with standard auth. Role checks run through a SECURITY DEFINER
          function — roles are never read from the client. All bot actions are written to an
          audit log.
        </p>
      </>
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    icon: HelpCircle,
    body: (
      <>
        <h4>My bot replies to <em>hi</em> as if it were spam.</h4>
        <p>
          Fixed. Short greetings are never flagged as spam — the anti-spam filter only fires on
          repeated longer messages from the same user within a short window.
        </p>
        <h4>My bot did not send a welcome message to a new member.</h4>
        <p>
          Welcomes always fire now, even without a custom template. The default is{" "}
          <code>Welcome {"{name}"} to {"{group}"}! 👋</code>. Customise it per bot or per group
          from the dashboard.
        </p>
        <h4>Can I configure my bot by DM-ing it?</h4>
        <p>
          No — by design. See <a href="#dm-policy">Bot DM policy</a>. Use the dashboard or{" "}
          <code>@LaPoe_bot</code>.
        </p>
        <h4>How do I get help?</h4>
        <p>
          Email <a href="mailto:support@lapoe.app">support@lapoe.app</a>.
        </p>
      </>
    ),
  },
];

export default function Docs() {
  const [active, setActive] = useState(sections[0].id);

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

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="container max-w-6xl pt-12 md:pt-16 pb-6">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3 font-semibold">
            Documentation
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Everything you need to ship LaPoe to your community.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Set up your first bot, train it on your knowledge, and let it answer with citations —
            calmly, and only when it should.
          </p>
        </div>
      </section>

      <section className="container max-w-6xl pb-24 grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Sidebar TOC */}
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 px-3">
              On this page
            </div>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
                    active === s.id
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {sections.map((s) => (
            <Card key={s.id} id={s.id} className="p-6 md:p-8 scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-2xl bg-secondary grid place-items-center">
                  <s.icon className="h-5 w-5 text-foreground" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">{s.title}</h2>
              </div>
              <div className="prose-docs">{s.body}</div>
            </Card>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
