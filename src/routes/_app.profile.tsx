import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTrades, fmtCurrency } from "@/lib/trades";
import { PageHeader } from "@/components/app/PageHeader";
import { MetricCard } from "@/components/app/MetricCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogOut, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const { trades, clear } = useTrades();
  const nav = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;

  const save = () => {
    updateProfile({ name, email });
    toast.success("Profile updated");
  };

  return (
    <>
      <PageHeader title="Profile" subtitle="Account & trading preferences" />
      <div className="p-8 max-w-4xl space-y-6">
        {/* Hero */}
        <div className="metric-card p-6 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "var(--gradient-primary)", maskImage: "linear-gradient(to right, black, transparent)" }} />
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-3xl font-bold text-primary-foreground shrink-0 relative">
            {(user?.name || "T").charAt(0).toUpperCase()}
          </div>
          <div className="relative">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                Pro Trader
              </span>
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                Demo
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="All-time P&L" value={fmtCurrency(totalPnL)} tone={totalPnL >= 0 ? "profit" : "loss"} />
          <MetricCard label="Total Trades" value={trades.length} />
          <MetricCard label="Wins" value={wins} tone="profit" />
          <MetricCard label="Losses" value={trades.length - wins} tone="loss" />
        </div>

        {/* Edit */}
        <div className="metric-card p-6">
          <h3 className="text-xs uppercase tracking-widest font-semibold mb-5">Account Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="n" className="text-xs uppercase tracking-wider text-muted-foreground">Display Name</Label>
              <Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="bg-input/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input/50" />
            </div>
          </div>
          <Button onClick={save}><Save className="h-3.5 w-3.5 mr-2" />Save Changes</Button>
        </div>

        {/* Danger */}
        <div className="metric-card p-6 border-loss/30">
          <h3 className="text-xs uppercase tracking-widest font-semibold mb-3 text-loss">Danger Zone</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => {
              if (confirm("Clear all trades? This cannot be undone.")) {
                clear(); toast.success("All trades cleared");
              }
            }}>Clear All Trades</Button>
            <Button variant="outline" onClick={() => { logout(); nav({ to: "/login" }); }}>
              <LogOut className="h-3.5 w-3.5 mr-2" />Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
