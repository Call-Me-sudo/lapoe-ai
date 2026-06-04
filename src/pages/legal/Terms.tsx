import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Terms of Service — LaPoe"
        description="The terms governing your use of LaPoe, the calm AI desk clerk for Telegram communities."
        path="/legal/terms"
      />
      <SiteHeader />
      <main className="container max-w-3xl py-16 md:py-24">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mt-3">Last updated: June 4, 2026</p>

        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none text-foreground/90 space-y-6 leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">1. Agreement</h2>
            <p>By creating an account or using LaPoe ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. LaPoe is offered worldwide; local laws may add rights you cannot waive.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">2. The Service</h2>
            <p>LaPoe lets you connect a Telegram bot, upload knowledge, and let an AI assistant reply on your behalf inside your communities. You are responsible for the bot token you connect, the content you upload, and how your assistant behaves in your groups.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">3. Your account</h2>
            <p>You must be at least 13 years old (or the minimum digital-consent age in your country). Keep your credentials safe — you are responsible for activity under your account. We may suspend accounts that abuse the Service, threaten our infrastructure, or violate these terms.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">4. Acceptable use</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>No illegal content, harassment, hate speech, sexual content involving minors, or spam.</li>
              <li>No attempts to reverse engineer, overload, or scrape the Service.</li>
              <li>No use of LaPoe to send unsolicited messages or violate Telegram's Terms of Service.</li>
              <li>You must have the right to upload any knowledge content you provide.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">5. Plans and payment</h2>
            <p>Paid plans renew automatically until cancelled. Fees are non-refundable except where required by law. We may change pricing with reasonable notice; changes apply to the next billing cycle.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">6. AI output</h2>
            <p>AI assistants can be wrong. Output is generated based on your knowledge base and the conversation. You are responsible for reviewing critical responses and for any decision a community member makes based on a reply.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">7. Your content</h2>
            <p>You keep ownership of everything you upload. You grant LaPoe a limited licence to store, process, and serve that content solely to operate the Service for you. Delete content any time from your dashboard.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">8. Termination</h2>
            <p>You may close your account at any time. We may suspend or terminate the Service for violations of these terms, with notice where reasonable. On termination we delete your data per our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">9. Disclaimers</h2>
            <p>The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, LaPoe is not liable for indirect, incidental, or consequential damages, or for lost profits, data, or goodwill.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">10. Changes</h2>
            <p>We may update these terms. Material changes will be announced in-app or by email. Continued use after changes means you accept them.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mt-8 mb-3">11. Contact</h2>
            <p>Questions? Reach us through the in-app feedback channel or by email at <a href="mailto:business@starstore.app?subject=LaPoe%20support%20request&body=Hi%20LaPoe%20team%2C%0D%0A%0D%0A(Describe%20your%20question%20here)%0D%0A%0D%0A%E2%80%94%20Sent%20from%20https%3A%2F%2Flapoe-ai.vercel.app" className="text-primary underline">business@starstore.app</a>.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
