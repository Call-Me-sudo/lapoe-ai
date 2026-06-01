import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SiStripe } from "react-icons/si";

export default function Billing() {
  const { user } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setSub(data));
  }, [user]);

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Could not open portal. Set up Stripe first.");
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Billing" description="Manage your plan and subscription." />

      <div className="border border-border rounded-lg bg-card p-6 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</div>
            <div className="text-2xl font-semibold text-ink mt-1 capitalize">{sub?.plan ?? "free"}</div>
            <div className="text-sm text-muted-foreground mt-1">Status: <span className="capitalize">{sub?.status ?? "active"}</span></div>
          </div>
          <Button asChild><Link to="/pricing">Change plan</Link></Button>
        </div>
        {sub?.stripe_customer_id && (
          <div className="mt-6 pt-6 border-t border-border">
            <Button variant="outline" onClick={openPortal} disabled={loading}>
              {loading ? "Opening…" : "Manage subscription"}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
