import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Gift, Copy, Share2, Wallet, TrendingUp, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface CreditState {
  balance_tnd: number;
  total_earned_tnd: number;
  total_spent_tnd: number;
}

const generateCode = (userId: string) => {
  const seed = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SAM-${seed}`;
};

export default function RewardsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string>("");
  const [credits, setCredits] = useState<CreditState>({ balance_tnd: 0, total_earned_tnd: 0, total_spent_tnd: 0 });
  const [referrals, setReferrals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let { data: codeRow } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!codeRow) {
        const newCode = generateCode(user.id);
        const { data: inserted } = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id, code: newCode })
          .select("code")
          .single();
        codeRow = inserted;
      }
      setCode(codeRow?.code || "");

      const { data: creditRow } = await supabase
        .from("user_credits")
        .select("balance_tnd, total_earned_tnd, total_spent_tnd")
        .eq("user_id", user.id)
        .maybeSingle();
      if (creditRow) setCredits(creditRow);

      const [refsRes, txRes] = await Promise.all([
        supabase.from("referrals").select("*").eq("referrer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setReferrals(refsRes.data || []);
      setTransactions(txRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = code ? `https://samsari.tech/auth?ref=${code}` : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("rewards.copied"), description: `${label} ${t("rewards.copiedDesc")}` });
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Samsari",
          text: `Use my code ${code} to get 20 TND off your first stay on Samsari!`,
          url: referralLink,
        });
      } catch {}
    } else {
      copyToClipboard(referralLink, t("rewards.shareLink"));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Credit Balance Hero — stacks on mobile */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="h-4 w-4" /> {t("rewards.balance")}
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-primary">
                {formatPrice(credits.balance_tnd)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("rewards.applyAtCheckout")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:text-right">
              <div>
                <div className="text-muted-foreground flex items-center gap-1 sm:justify-end"><TrendingUp className="h-3 w-3" /> {t("rewards.earned")}</div>
                <div className="font-semibold">{formatPrice(credits.total_earned_tnd)}</div>
              </div>
              <div>
                <div className="text-muted-foreground sm:text-right">{t("rewards.spent")}</div>
                <div className="font-semibold">{formatPrice(credits.total_spent_tnd)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Link */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Gift className="h-5 w-5 text-primary shrink-0" />
            <span>{t("rewards.inviteTitle")}</span>
          </CardTitle>
          <CardDescription className="text-sm">
            {t("rewards.inviteSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("rewards.yourCode")}</label>
            <div className="flex gap-2">
              <Input value={code} readOnly className="font-mono font-semibold tracking-wider" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(code, t("rewards.yourCode"))} aria-label={t("rewards.copy")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("rewards.shareLink")}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={referralLink} readOnly className="text-xs flex-1 min-w-0" />
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(referralLink, t("rewards.shareLink"))} aria-label={t("rewards.copy")} className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button onClick={shareLink} className="flex-1 sm:flex-none">
                  <Share2 className="h-4 w-4 mr-2" /> {t("rewards.share")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> {t("rewards.referrals")} ({referrals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("rewards.noReferrals")}</p>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0 gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t("rewards.friendJoined")}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-medium ${r.status === "rewarded" ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {r.status === "rewarded" ? `+${formatPrice(r.reward_amount_tnd)}` : t("rewards.pendingBooking")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rewards.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0 gap-2">
                  <div className="min-w-0">
                    <div className="font-medium capitalize truncate">{tx.reason || tx.type}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy")}</div>
                  </div>
                  <div className={`font-semibold shrink-0 ${tx.amount_tnd > 0 ? "text-emerald-600" : "text-foreground"}`}>
                    {tx.amount_tnd > 0 ? "+" : ""}{formatPrice(Math.abs(tx.amount_tnd))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
