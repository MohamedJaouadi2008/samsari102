
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, MapPin, Home, CheckCircle, Shield, Calendar, Flag, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import Header from "./Header";
import Footer from "./Footer";
import VerifiedBadge from "./VerifiedBadge";
import { format } from "date-fns";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  reviewer_id: string;
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [profile, setProfile] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyRatings, setPropertyRatings] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [propertyReviews, setPropertyReviews] = useState<ReviewItem[]>([]);
  const [guestReviews, setGuestReviews] = useState<ReviewItem[]>([]);
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchUserProperties();
      fetchReviews();
      if (user && user.id !== userId) {
        checkBlockStatus();
      }
    }
  }, [userId, user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProperties = async () => {
    try {
      const { data, error } = await applyPublicPropertyFilter(
        supabase
          .from('properties')
          .select('*')
          .eq('host_id', userId)
      );
      
      if (error) throw error;
      setProperties(data || []);

      // Fetch ratings for each property
      if (data && data.length > 0) {
        const propertyIds = data.map(p => p.id);
        const { data: reviews } = await supabase
          .from('reviews')
          .select('property_id, rating')
          .in('property_id', propertyIds)
          .eq('status', 'approved');

        if (reviews) {
          const ratingsMap = new Map<string, { avg: number; count: number }>();
          const grouped = new Map<string, number[]>();
          reviews.forEach(r => {
            const existing = grouped.get(r.property_id) || [];
            existing.push(r.rating);
            grouped.set(r.property_id, existing);
          });
          grouped.forEach((ratings, propId) => {
            const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
            ratingsMap.set(propId, { avg: Math.round(avg * 100) / 100, count: ratings.length });
          });
          setPropertyRatings(ratingsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching user properties:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      // Fetch property reviews (reviews left on this user's properties)
      const { data: props } = await supabase
        .from('properties')
        .select('id')
        .eq('host_id', userId);

      const propertyIds = props?.map(p => p.id) || [];
      let propReviewsEnriched: ReviewItem[] = [];

      if (propertyIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('*')
          .in('property_id', propertyIds)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (reviews && reviews.length > 0) {
          const reviewerIds = [...new Set(reviews.map(r => r.user_id))];
          const { data: profiles } = await supabase
            .from('public_profiles')
            .select('id, full_name, avatar_url')
            .in('id', reviewerIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          propReviewsEnriched = reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            reviewer_name: profileMap.get(r.user_id)?.full_name || 'Guest',
            reviewer_avatar: profileMap.get(r.user_id)?.avatar_url || null,
            reviewer_id: r.user_id,
          }));

          setPropertyReviews(propReviewsEnriched);
        }
      }

      // Fetch guest reviews (reviews left about this user as a guest)
      const { data: gReviews } = await supabase
        .from('guest_reviews')
        .select('*')
        .eq('guest_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      let guestEnriched: ReviewItem[] = [];
      if (gReviews && gReviews.length > 0) {
        const hostIds = [...new Set(gReviews.map(r => r.host_id))];
        const { data: hostProfiles } = await supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url')
          .in('id', hostIds);

        const hostMap = new Map(hostProfiles?.map(p => [p.id, p]) || []);

        guestEnriched = gReviews.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer_name: hostMap.get(r.host_id)?.full_name || 'Host',
          reviewer_avatar: hostMap.get(r.host_id)?.avatar_url || null,
          reviewer_id: r.host_id,
        }));

        setGuestReviews(guestEnriched);
      }

      // Calculate combined review count and rating
      const allFetched = [...(propReviewsEnriched || []), ...guestEnriched];
      const totalCount = allFetched.length;
      setReviewCount(totalCount);
      if (totalCount > 0) {
        const avg = allFetched.reduce((sum, r) => sum + r.rating, 0) / totalCount;
        setRating(Math.round(avg * 100) / 100);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const checkBlockStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_user_id', userId)
      .maybeSingle();
    setIsBlocked(!!data);
  };

  const handleBlock = async () => {
    if (!user || !userId) return;
    try {
      if (isBlocked) {
        await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_user_id', userId);
        setIsBlocked(false);
        toast({ title: "Unblocked", description: `${profile?.full_name || 'User'} has been unblocked.` });
      } else {
        await supabase.from('user_blocks').insert({
          blocker_id: user.id,
          blocked_user_id: userId,
        });
        setIsBlocked(true);
        toast({ title: "Blocked", description: `${profile?.full_name || 'User'} has been blocked.` });
      }
    } catch (error) {
      console.error('Error toggling block:', error);
    }
  };

  const handleReport = async () => {
    if (!user || !userId || !reportReason) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: user.id,
        reported_user_id: userId,
        reason: reportReason,
        description: reportDescription.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Report Submitted", description: "Thank you for your report. Our team will review it." });
      setShowReportDialog(false);
      setReportReason("");
      setReportDescription("");
    } catch (error) {
      console.error('Error reporting user:', error);
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    } finally {
      setReportSubmitting(false);
    }
  };

  const allReviews = [...propertyReviews, ...guestReviews].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const reviewsPerPage = 3;
  const totalPages = Math.ceil(allReviews.length / reviewsPerPage);
  const visibleReviews = allReviews.slice(reviewPage * reviewsPerPage, (reviewPage + 1) * reviewsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse max-w-4xl mx-auto">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-muted rounded mb-4"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">User not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">Go Home</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const displayName = profile.full_name || profile.username || "User";
  const isVerified = profile.verification_status === "verified";
  const memberSince = profile.created_at ? format(new Date(profile.created_at), "yyyy") : null;
  const yearsOnPlatform = memberSince ? new Date().getFullYear() - parseInt(memberSince) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Profile card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
                    <AvatarImage src={profile.avatar_url || ""} alt={displayName} />
                    <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <h1 className="text-2xl font-bold mt-4">{displayName}</h1>
                <div className="flex items-center gap-2 flex-wrap justify-center mt-2">
                  {profile.is_host && <Badge variant="secondary">Host</Badge>}
                  {isVerified && <VerifiedBadge size="md" />}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 w-full">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{reviewCount}</p>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{rating > 0 ? `${rating.toFixed(2)}★` : '—'}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                </div>

                {yearsOnPlatform > 0 && (
                  <div className="text-center mt-2">
                    <p className="text-2xl font-bold">{yearsOnPlatform}</p>
                    <p className="text-xs text-muted-foreground">Years on Samsari</p>
                  </div>
                )}

                {isVerified && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-green-600 dark:text-green-400">
                    <Shield className="h-4 w-4" />
                    <span>Identity verified</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - About & Reviews */}
          <div className="lg:col-span-2 space-y-8">
            {/* About section */}
            <div>
              <h2 className="text-2xl font-bold mb-4">About {displayName}</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span>Member since {profile.created_at ? format(new Date(profile.created_at), "MMMM yyyy") : "recently"}</span>
                </div>
                {isVerified && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                    <span>Identity verified</span>
                  </div>
                )}
              </div>

              {profile.bio && (
                <>
                  <Separator className="my-4" />
                  <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
                </>
              )}
            </div>

            <Separator />

            {/* Properties section */}
            {properties.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-4">{displayName}'s Properties</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {properties.map((property) => (
                    <div 
                      key={property.id} 
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/property/${property.id}`)}
                    >
                      <div className="relative h-40 bg-muted">
                        {property.photos && Array.isArray(property.photos) && property.photos.length > 0 ? (
                          <img 
                            src={(property.photos[0] as any)?.url || "/placeholder.svg"} 
                            alt={property.title} 
                            className="object-cover w-full h-full" 
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <Home className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm truncate flex-1">{property.title}</h4>
                          {propertyRatings.get(property.id) && (
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{propertyRatings.get(property.id)!.avg.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground">({propertyRatings.get(property.id)!.count})</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {property.city}, {property.governorate}
                        </p>
                        <p className="font-medium text-sm mt-1">{formatPrice(property.price_per_night)}/night</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {properties.length > 0 && allReviews.length > 0 && <Separator />}

            {/* Reviews section */}
            {allReviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{displayName}'s reviews</h3>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={reviewPage === 0}
                        onClick={() => setReviewPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={reviewPage >= totalPages - 1}
                        onClick={() => setReviewPage(p => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {visibleReviews.map((review) => (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={review.reviewer_avatar || undefined} />
                          <AvatarFallback>{review.reviewer_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{review.reviewer_name}</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">
                              · {format(new Date(review.created_at), 'MMM yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground line-clamp-4">{review.comment}</p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Report / Block section */}
            {user && !isOwnProfile && (
              <>
                <Separator />
                <div className="space-y-3">
                  <button
                    onClick={() => setShowReportDialog(true)}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Flag className="h-4 w-4" />
                    Report {displayName}
                  </button>
                  <button
                    onClick={handleBlock}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Ban className="h-4 w-4" />
                    {isBlocked ? `Unblock ${displayName}` : `Block ${displayName}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {displayName}</DialogTitle>
            <DialogDescription>
              Help us understand what's happening. Your report will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="scam">Scam or fraud</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate behavior</SelectItem>
                  <SelectItem value="fake_profile">Fake profile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Details (optional)</Label>
              <Textarea
                placeholder="Provide additional details..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
            <Button onClick={handleReport} disabled={!reportReason || reportSubmitting}>
              {reportSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfile;
