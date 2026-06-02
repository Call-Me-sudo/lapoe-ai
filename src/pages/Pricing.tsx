import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  {
    id: "free", name: "Free", price: "$0", per: "forever",
    desc: "Try LaPoe on a single small group.",
    features: ["1 bot", "1 group", "100 messages logged", "AI replies included"],
    cta: "Start free",
  },
  {
    id: "starter", name: "Starter", price: "$19", per: "per month",
    desc: "For one community manager.",
    features: ["3 bots", "10 groups", "10,000 messages logged", "Knowledge sources", "Email support"],
    cta: "Choose Starter", featured: false,
  },
  {
    id: "pro", name: "Pro", price: "$49", per: "per month",
    desc: "For active multi-group communities.",
    features: ["10 bots", "Unlimited groups", "100,000 messages logged", "Advanced rules", "Priority support"],
    cta: "Choose Pro", featured: true,
  },
  {
    id: "business", name: "Business", price: "$149", per: "per month",
    desc: "For agencies and large workspaces.",
    features: ["Unlimited bots", "Unlimited groups", "Unlimited messages", "Team seats", "Dedicated support"],
    cta: "Choose Business",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const choose = async (planId: string) => {
    if (!user) { window.location.href = "/auth?mode=signup"; return; }
    if (planId === "free") { window.location.href = "/dashboard"; return; }
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { plan: planId } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Stripe isn't configured yet. Add your Stripe key in settings to enable checkout.");
    } finally { setLoading(null); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container max-w-6xl py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3 font-semibold">Pricing</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground text-balance tracking-tight">Simple plans. Grow when you're ready.</h1>
          <p className="text-muted-foreground mt-4">AI replies are included on every plan — no API keys to manage.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-3xl p-7 flex flex-col ${p.featured ? "bg-foreground text-background shadow-pill" : "bg-card shadow-card"}`}>
              {p.featured && <div className="text-[10px] uppercase tracking-[0.16em] mb-2 font-semibold opacity-80">Most popular</div>}
              <h3 className="font-display text-xl font-bold">{p.name}</h3>
              <div className="mt-3"><span className="font-display text-4xl font-bold">{p.price}</span> <span className={`text-sm ${p.featured ? "opacity-70" : "text-muted-foreground"}`}>{p.per}</span></div>
              <p className={`text-sm mt-2 ${p.featured ? "opacity-80" : "text-muted-foreground"}`}>{p.desc}</p>
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><Check className={`h-4 w-4 mt-0.5 shrink-0 ${p.featured ? "" : "text-tile-green-foreground"}`} /> {f}</li>
                ))}
              </ul>
              <Button
                onClick={() => choose(p.id)}
                disabled={loading === p.id}
                variant={p.featured ? "warm" : "default"}
                className="mt-6 w-full"
                size="lg"
              >
                {loading === p.id ? "Loading…" : p.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Stripe billing — cancel anytime. <Link to="/auth" className="text-foreground hover:underline font-medium">Already a customer?</Link>
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}

