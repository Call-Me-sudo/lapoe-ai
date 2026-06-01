import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({ password: z.string().min(6, "At least 6 characters").max(72) });

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase redirects with #access_token=...&type=recovery. The client picks it up
    // automatically; we just confirm a session exists before allowing the update.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else {
        toast.error("Reset link expired or invalid. Request a new one.");
        navigate("/auth", { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Signing you in…");
    navigate("/dashboard", { replace: true });
  };

  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-ink-soft">Checking link…</div>;
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-paper-soft">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
        <h1 className="text-xl font-semibold text-ink">Set a new password</h1>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            maxLength={72}
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
