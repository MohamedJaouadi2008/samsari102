import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface PendingReview {
  booking_id: string;
  property_id: string;
  property_title: string;
  check_out_date: string;
}

const DISMISS_KEY = "samsari:dismissed-review-nudges";

const getDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
};

const PostStayReviewNudge = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingReview | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const dismissed = getDismissed();

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, property_id, check_out_date, properties(title)")
        .eq("guest_id", user.id)
        .in("status", ["checked_out", "settlement_pending", "dispute_window", "settled"])
        .not("actual_check_out", "is", null)
        .order("actual_check_out", { ascending: false })
        .limit(10);

      if (!bookings?.length) return;

      const candidate = bookings.find((b) => !dismissed.includes(b.id));
      if (!candidate) return;

      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", candidate.id)
        .maybeSingle();

      if (existingReview) return;

      setPending({
        booking_id: candidate.id,
        property_id: candidate.property_id,
        property_title: (candidate.properties as any)?.title || t('nudge.your_stay'),
        check_out_date: candidate.check_out_date,
      });
    };
    load();
  }, [user, t]);

  const dismiss = () => {
    if (!pending) return;
    const list = getDismissed();
    list.push(pending.booking_id);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(list));
    setPending(null);
  };

  if (!pending) return null;

  return (
    <Card className="p-4 mb-4 bg-gradient-to-r from-primary/5 to-primary/15 border-primary/30 relative">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label={t('nudge.dismiss')}
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Star className="w-5 h-5 text-primary fill-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{t('nudge.title', { property: pending.property_title })}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('nudge.desc')}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => navigate(`/booking/${pending.booking_id}?review=1`)}
          >
            {t('nudge.cta')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PostStayReviewNudge;
