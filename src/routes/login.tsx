import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email || !password) {
      setErr("Email and password required");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      nav({ to: "/dashboard" });
    } catch (e: any) {
      setErr(e?.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="metric-card p-8 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-12 w-12 rounded-lg bg-secondary border border-border flex items-center justify-center mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">QuantJournal</h1>
            <p className="text-sm text-muted-foreground mt-1">Trade. Review. Improve.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input id="email" type="email" placeholder="trader@fund.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="bg-input/50" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="pwd" type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} className="bg-input/50" />
            </div>
            {err && <p className="text-sm text-loss">{err}</p>}
            <Button type="submit" disabled={loading} className="w-full uppercase tracking-wider font-semibold">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">Demo mode — use any email/password to explore.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
