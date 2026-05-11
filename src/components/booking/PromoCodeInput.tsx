import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export interface AppliedPromo {
  id: string;
  code: string;
  discount_amount: number;
  description?: string;
}

interface Props {
  bookingAmount: number;
  applied: AppliedPromo | null;
  onApply: (promo: AppliedPromo) => void;
  onRemove: () => void;
}

export default function PromoCodeInput({ bookingAmount, applied, onApply, onRemove }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { data: promo, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", trimmed)
        .eq("active", true)
        .maybeSingle();

      if (error || !promo) {
        toast({ title: t('promo.invalid'), description: t('promo.invalid_desc'), variant: "destructive" });
        return;
      }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        toast({ title: t('promo.expired'), variant: "destructive" });
        return;
      }
      if (promo.max_uses && promo.uses_count >= promo.max_uses) {
        toast({ title: t('promo.fully_redeemed'), description: t('promo.fully_redeemed_desc'), variant: "destructive" });
        return;
      }
      if (promo.min_booking_amount && bookingAmount < Number(promo.min_booking_amount)) {
        toast({ title: t('promo.min_not_met'), description: t('promo.min_not_met_desc', { amount: promo.min_booking_amount }), variant: "destructive" });
        return;
      }

      const discount = promo.discount_type === "percent"
        ? Math.round(bookingAmount * (Number(promo.discount_value) / 100))
        : Math.min(Number(promo.discount_value), bookingAmount);

      onApply({
        id: promo.id,
        code: promo.code,
        discount_amount: discount,
        description: promo.description || undefined,
      });
      setCode("");
      toast({ title: t('promo.applied_toast'), description: t('promo.saved', { amount: discount }) });
    } finally {
      setLoading(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-600" />
          <div>
            <div className="font-semibold text-emerald-800 dark:text-emerald-300">{t('promo.applied', { code: applied.code })}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400">{t('promo.savings', { amount: applied.discount_amount })}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5" /> {t('promo.label')}
      </label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={t('promo.placeholder')}
          className="font-mono uppercase"
          onKeyDown={e => e.key === "Enter" && handleApply()}
        />
        <Button variant="outline" onClick={handleApply} disabled={loading || !code.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('promo.apply')}
        </Button>
      </div>
    </div>
  );
}
