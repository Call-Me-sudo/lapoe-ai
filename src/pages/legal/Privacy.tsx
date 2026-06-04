import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy — LaPoe"
        description="How LaPoe collects, uses, and protects your data. GDPR, UK GDPR, CCPA/CPRA, and global privacy rights."
        path="/legal/privacy"
      />
      <SiteHeader />
      <main className="container max-w-3xl py-16 md:py-24">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-3">Last updated: June 4, 2026</p>

        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none text-foreground/90 space-y-6 leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">Summary</h2>
            <p>We collect the minimum we need to run your AI desk clerk: account info, the Telegram bot token you connect, the knowledge you upload, and message metadata. We never sell your personal information. You can export or delete your data anytime.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">1. Who we are</h2>
            <p>LaPoe ("we", "us") is the data controller for the personal information you provide directly. For messages your community members send to your bot, you are the controller and we act as a processor on your behalf.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">2. What we collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account:</strong> email, display name, password hash, OAuth identifiers if you use Google sign-in.</li>
              <li><strong>Bot config:</strong> Telegram bot token, group/channel IDs, persona and instructions.</li>
              <li><strong>Knowledge:</strong> documents and text you upload.</li>
              <li><strong>Messages:</strong> incoming Telegram updates routed through your bot, the AI replies, and moderation metadata.</li>
              <li><strong>Billing:</strong> handled by our payment processor; we store only customer/subscription IDs and plan state.</li>
              <li><strong>Technical:</strong> IP address, user agent, and request logs for security and abuse prevention.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">3. How we use it</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Operate your bot and generate replies.</li>
              <li>Provide your dashboard, billing, and support.</li>
              <li>Detect abuse, debug issues, and improve reliability.</li>
              <li>Send transactional emails (account, billing, security).</li>
            </ul>
            <p>We process AI prompts through third-party model providers (e.g. Google, OpenAI). Providers process content under their enterprise data terms and do not train on it.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">4. Legal bases (GDPR / UK GDPR)</h2>
            <p>Contract (to deliver the Service), legitimate interests (security, product improvement), consent (optional cookies, marketing), and legal obligation (tax, fraud).</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">5. Sharing</h2>
            <p>We share data only with vetted processors: cloud hosting and database, AI model providers, email delivery, payment processing, and analytics. We do not sell or "share" personal information for cross-context behavioural advertising as defined by the CCPA/CPRA.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">6. International transfers</h2>
            <p>LaPoe is a worldwide service. Your data may be processed in the EU, US, and other regions where our providers operate. Where required, we rely on Standard Contractual Clauses or equivalent safeguards.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">7. Retention</h2>
            <p>Account and bot config: until you delete them. Message logs: up to 12 months unless you set a shorter retention. Backups: rotated within 30 days. Billing records: kept as required by tax law (typically 7 years).</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">8. Your rights</h2>
            <p>Depending on where you live, you have the right to access, correct, delete, restrict, port, or object to processing of your data, and to withdraw consent. Most actions are self-serve in your dashboard. For anything else, contact us and we will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">9. California (CCPA / CPRA)</h2>
            <p>California residents have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Know what personal information we collect and how we use it.</li>
              <li>Request access to or deletion of your personal information.</li>
              <li>Correct inaccurate personal information.</li>
              <li>Limit use of sensitive personal information.</li>
              <li>Opt out of sale or sharing — <strong>we do not sell or share personal information</strong> as those terms are defined under CCPA/CPRA.</li>
              <li>Non-discrimination for exercising your rights.</li>
            </ul>
            <p>To exercise these rights, email us or use the data controls in your dashboard. We will verify your identity before fulfilling sensitive requests. You can authorize an agent to act for you.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">10. Children</h2>
            <p>LaPoe is not directed to children under 13 (or the applicable digital-consent age). We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">11. Security</h2>
            <p>We use TLS in transit, encryption at rest, role-based access controls, and audit logging. No system is perfectly secure; we will notify affected users of any qualifying breach as required by law.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">12. Changes</h2>
            <p>We will post updates here and, for material changes, notify you in-app or by email before they take effect.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">13. Contact</h2>
            <p>For privacy requests or questions, reach us via the in-app feedback channel or by email at <a href="mailto:business@starstore.app?subject=LaPoe%20privacy%20request&body=Hi%20LaPoe%20team%2C%0D%0A%0D%0A(Describe%20your%20request%20here)%0D%0A%0D%0A%E2%80%94%20Sent%20from%20https%3A%2F%2Flapoe-ai.vercel.app" className="text-primary underline">business@starstore.app</a>.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
