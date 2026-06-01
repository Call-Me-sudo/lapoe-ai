import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { autoLinkTelegramIfPossible } from "@/lib/telegram";
import { FcGoogle } from "react-icons/fc";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, rolesLoaded, isOwner } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // Wait for roles to resolve before redirecting so owners always land on /admin.
  useEffect(() => {
    if (!user || authLoading || !rolesLoaded) return;
    autoLinkTelegramIfPossible().catch(() => {});
    navigate(isOwner ? "/admin" : "/dashboard", { replace: true });
  }, [user, authLoading, rolesLoaded, isOwner, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Redirect handled by the effect above once roles load.
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper grid md:grid-cols-2">
      {/* Left — editorial */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-warm border-r border-border">
        <Link to="/" className="font-display text-2xl text-ink">KADE</Link>
        <div>
          <h2 className="font-display text-4xl text-ink text-balance leading-tight">
            "It reads the room before it speaks."
          </h2>
          <p className="text-ink-soft mt-4 max-w-md">
            A communications desk that sits politely behind your community, ready to help.
          </p>
        </div>
        <div className="text-xs text-ink-soft uppercase tracking-widest">Knowledge · Acquisition · Dynamic · Engagement</div>
      </div>

      {/* Right — form */}
      <div className="flex flex-col justify-center p-8 md:p-16">
        <div className="md:hidden mb-8">
          <Link to="/" className="font-display text-2xl text-ink">KADE</Link>
        </div>
        <div className="max-w-sm w-full mx-auto">
          <h1 className="font-display text-3xl text-ink mb-2">
            {mode === "signup" ? "Create your workspace" : "Welcome back"}
          </h1>
          <p className="text-ink-soft text-sm mb-8">
            {mode === "signup" ? "Start in seconds. No card required." : "Sign in to your dashboard."}
          </p>

          <Button variant="warm" className="w-full" onClick={handleGoogle} disabled={loading}>
            <FcGoogle className="h-4 w-4" />
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" maxLength={80} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" maxLength={255} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) return toast.error("Enter your email first");
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + "/reset-password",
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Reset link sent. Check your inbox.");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} maxLength={72} required />
            </div>
            <Button type="submit" variant="editorial" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-ink-soft mt-6 text-center">
            {mode === "signup" ? "Already have an account?" : "New to KADE?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="text-primary underline-offset-4 hover:underline">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="text-xs text-ink-soft mt-4 text-center">
            Telegram login coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
