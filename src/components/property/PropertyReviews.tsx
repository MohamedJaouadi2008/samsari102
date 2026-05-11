
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { reviewSchema } from "@/lib/validation";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import VerifiedBadge from "@/components/VerifiedBadge";

type Review = Tables<"reviews">;

interface ReviewWithProfile extends Review {
  reviewer_name?: string;
  reviewer_avatar?: string;
  reviewer_id?: string;
  reviewer_verified?: boolean;
}

interface PropertyReviewsProps {
  propertyId: string;
}

const PropertyReviews = ({ propertyId }: PropertyReviewsProps) => {
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
    checkReviewEligibility();
  }, [propertyId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("property_id", propertyId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch reviewer profiles
      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const profiles: Record<string, { name: string; avatar: string | null; verified: boolean }> = {};
      
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("public_profiles")
          .select("id, full_name, avatar_url, verification_status")
          .in("id", userIds);
        
        profileData?.forEach(p => {
          profiles[p.id!] = {
            name: p.full_name || "Guest",
            avatar: p.avatar_url,
            verified: p.verification_status === "verified",
          };
        });
      }

      const enrichedReviews: ReviewWithProfile[] = (data || []).map(r => ({
        ...r,
        reviewer_name: profiles[r.user_id]?.name || "Guest",
        reviewer_avatar: profiles[r.user_id]?.avatar || undefined,
        reviewer_id: r.user_id,
        reviewer_verified: profiles[r.user_id]?.verified || false,
      }));

      setReviews(enrichedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkReviewEligibility = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, status, actual_check_out")
        .eq("property_id", propertyId)
        .eq("guest_id", user.id);

      if (error) throw error;

      const eligibleBookings = bookings?.filter(booking => 
        ['checked_out', 'settlement_pending', 'dispute_window', 'settled'].includes(booking.status) && booking.actual_check_out
      );

      const { data: existingReviews } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("property_id", propertyId)
        .eq("user_id", user.id);

      const reviewedBookingIds = existingReviews?.map(r => r.booking_id) || [];
      const unreviewed = eligibleBookings?.filter(b => !reviewedBookingIds.includes(b.id));

      setCanReview((unreviewed?.length || 0) > 0);
    } catch (error) {
      console.error("Error checking review eligibility:", error);
    }
  };

  const submitReview = async () => {
    try {
      const validated = reviewSchema.parse({ rating, comment });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication Required", description: "Please log in to leave a review", variant: "destructive" });
        return;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("property_id", propertyId)
        .eq("guest_id", user.id)
        .in("status", ['checked_out', 'settlement_pending', 'dispute_window', 'settled'])
        .limit(1);

      if (!bookings || bookings.length === 0) {
        toast({ title: "No Eligible Booking", description: "You need to complete a stay to leave a review", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("reviews")
        .insert({
          booking_id: bookings[0].id,
          property_id: propertyId,
          user_id: user.id,
          rating: validated.rating,
          comment: validated.comment || null
        });

      if (error) throw error;

      toast({ title: "Review Submitted", description: "Your review is pending admin approval." });
      setComment("");
      setRating(0);
      setCanReview(false);
      fetchReviews();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({ title: "Error", description: error.errors?.[0]?.message || "Failed to submit review", variant: "destructive" });
    }
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
        <CardContent><p>Loading reviews...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card id="reviews">
      <CardHeader>
        <CardTitle>Reviews & Ratings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.length > 0 ? (
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{averageRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
          </div>
        ) : (
          <div className="text-center py-6 bg-muted/50 rounded-lg">
            <Star className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-lg mb-1">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to stay here and share your experience!</p>
          </div>
        )}
        
        <Separator />
        
        {canReview && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium">Leave a Review</h4>
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 cursor-pointer ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <Button onClick={submitReview} disabled={!rating}>Submit Review</Button>
          </div>
        )}
        
        {reviews.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Reviews</h4>
            {reviews.map((review) => (
              <div key={review.id} className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                    onClick={() => review.reviewer_id && navigate(`/user/${review.reviewer_id}`)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={review.reviewer_avatar} />
                      <AvatarFallback>{review.reviewer_name?.charAt(0) || "G"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">{review.reviewer_name}</span>
                        {review.reviewer_verified && <VerifiedBadge size="xs" showLabel={false} />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertyReviews;
