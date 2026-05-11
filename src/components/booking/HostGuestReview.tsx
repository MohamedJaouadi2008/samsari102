import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface HostGuestReviewProps {
  bookingId: string;
  guestId: string;
  guestName: string;
  propertyId: string;
}

const HostGuestReview = ({ bookingId, guestId, guestName, propertyId }: HostGuestReviewProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    checkExistingReview();
  }, [bookingId]);

  const checkExistingReview = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("guest_reviews")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("host_id", user.id)
      .maybeSingle();
    if (data) setAlreadyReviewed(true);
  };

  const submitReview = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("guest_reviews").insert({
        booking_id: bookingId,
        property_id: propertyId,
        host_id: user.id,
        guest_id: guestId,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: guestId,
        type: 'guest_reviewed',
        title: t('hgr.notif_title'),
        message: t('hgr.notif_msg', { rating }),
        link: `/user/${guestId}`,
      });

      toast({ title: t('hgr.submitted'), description: t('hgr.submitted_desc', { name: guestName }) });
      setAlreadyReviewed(true);
    } catch (error: any) {
      console.error("Error submitting guest review:", error);
      toast({ title: "Error", description: t('hgr.failed'), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyReviewed) {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        {t('hgr.already_reviewed', { name: guestName })}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      <h4 className="font-medium text-sm">{t('hgr.rate', { name: guestName })}</h4>
      <div className="space-y-2">
        <Label className="text-xs">{t('hgr.rating')}</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-5 w-5 cursor-pointer ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
              onClick={() => setRating(star)}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('hgr.comment_optional')}</Label>
        <Textarea
          placeholder={t('hgr.comment_ph', { name: guestName })}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="text-sm"
          rows={2}
        />
      </div>
      <Button size="sm" onClick={submitReview} disabled={!rating || submitting}>
        {submitting ? t('hgr.submitting') : t('hgr.submit')}
      </Button>
    </div>
  );
};

export default HostGuestReview;
