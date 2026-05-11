
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle, XCircle, Clock, User, Home, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReviewWithDetails {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  user_id: string;
  property_id: string;
  booking_id: string;
  reviewed_at: string | null;
  reviewer_name?: string;
  property_title?: string;
  host_name?: string;
}

const ReviewModerationDashboard = () => {
  const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch related profiles and properties
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const propertyIds = [...new Set((data || []).map(r => r.property_id))];

      const [profilesRes, propertiesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", userIds.length ? userIds : ['']),
        supabase.from("properties").select("id, title, host_id").in("id", propertyIds.length ? propertyIds : [''])
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));
      const propertiesMap = new Map((propertiesRes.data || []).map(p => [p.id, p]));

      // Get host names
      const hostIds = [...new Set((propertiesRes.data || []).map(p => p.host_id))];
      const { data: hostProfiles } = await supabase.from("profiles").select("id, full_name").in("id", hostIds.length ? hostIds : ['']);
      const hostMap = new Map((hostProfiles || []).map(p => [p.id, p.full_name]));

      const enriched = (data || []).map(r => {
        const prop = propertiesMap.get(r.property_id);
        return {
          ...r,
          reviewer_name: profilesMap.get(r.user_id) || "Unknown User",
          property_title: prop?.title || "Unknown Property",
          host_name: prop ? (hostMap.get(prop.host_id) || "Unknown Host") : "Unknown Host",
        };
      });

      setReviews(enriched);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reviewId: string, action: "approved" | "rejected") => {
    setProcessingId(reviewId);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({
          status: action,
          admin_notes: adminNotes[reviewId] || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;

      toast({
        title: action === "approved" ? "Review Approved" : "Review Rejected",
        description: `The review has been ${action}.`,
      });

      setAdminNotes(prev => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
      fetchReviews();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update review",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = reviews.filter(r => r.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Review Moderation
            {filter === "pending" && pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} pending</Badge>
            )}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No {filter !== "all" ? filter : ""} reviews</p>
          </div>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{review.reviewer_name}</span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Home className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{review.property_title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Host: {review.host_name} · {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    {statusBadge(review.status)}
                  </div>
                </div>

                {review.comment && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">{review.comment}</p>
                    </div>
                  </div>
                )}

                {review.admin_notes && review.status !== "pending" && (
                  <p className="text-xs text-muted-foreground italic">Admin notes: {review.admin_notes}</p>
                )}

                {review.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Admin Notes (optional)</Label>
                    <Textarea
                      placeholder="Add notes about this review..."
                      value={adminNotes[review.id] || ""}
                      onChange={(e) => setAdminNotes(prev => ({ ...prev, [review.id]: e.target.value }))}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(review.id, "approved")}
                        disabled={processingId === review.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(review.id, "rejected")}
                        disabled={processingId === review.id}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewModerationDashboard;
