import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import VerifiedBadge from "@/components/VerifiedBadge";
import SuperhostBadge from "@/components/SuperhostBadge";

interface HostProfileCardProps {
  hostId: string;
  propertyTitle?: string;
}

interface HostProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  created_at: string;
  is_host: boolean;
  is_superhost?: boolean;
}

const HostProfileCard = ({ hostId, propertyTitle }: HostProfileCardProps) => {
  const navigate = useNavigate();
  const [host, setHost] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    fetchHostProfile();
  }, [hostId]);

  const fetchHostProfile = async () => {
    try {
      // Fetch superhost flag separately (public column)
      const { data: shData } = await supabase
        .from("profiles")
        .select("is_superhost")
        .eq("id", hostId)
        .maybeSingle();
      const isSuperhost = !!shData?.is_superhost;

      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url, verification_status, created_at, is_host")
        .eq("id", hostId)
        .maybeSingle();

      if (error) {
        const { data: profileData } = await supabase
          .rpc("get_public_profile", { profile_id: hostId });
        
        if (profileData && profileData.length > 0) {
          setHost({
            id: profileData[0].id,
            full_name: profileData[0].username,
            avatar_url: profileData[0].avatar_url,
            verification_status: profileData[0].verification_status,
            created_at: profileData[0].created_at,
            is_host: profileData[0].is_host,
            is_superhost: isSuperhost,
          });
        }
      } else if (data) {
        setHost({
          id: data.id || "",
          full_name: data.username,
          avatar_url: data.avatar_url,
          verification_status: data.verification_status,
          created_at: data.created_at || new Date().toISOString(),
          is_host: data.is_host || false,
          is_superhost: isSuperhost,
        });
      }
    } catch (error) {
      console.error("Error fetching host profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-16 w-16 bg-muted rounded-full"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-1/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!host) {
    return null;
  }

  const isVerified = host.verification_status === "verified";
  const memberSince = host.created_at 
    ? format(new Date(host.created_at), "MMMM yyyy")
    : "Recently joined";
  const isDemoProperty = propertyTitle?.includes('— by Samsari');
  const displayName = isDemoProperty ? "Samsari" : (host.full_name || "Host");
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar 
            className="h-16 w-16 border-2 border-background shadow-md cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/user/${hostId}`)}
          >
            <AvatarImage src={host.avatar_url || undefined} alt={displayName} />
            <AvatarFallback className="text-xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Host Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 
                className="font-semibold text-lg truncate cursor-pointer hover:underline"
                onClick={() => navigate(`/user/${hostId}`)}
              >
                Hosted by {displayName}
              </h3>
              {isVerified && <VerifiedBadge size="sm" />}
              {host.is_superhost && <SuperhostBadge size="sm" />}
            </div>

            <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Member since {memberSince}</span>
              </div>
              </div>

            {/* Trust indicators */}
            {isVerified && (
              <div className="flex items-center gap-1 mt-3 text-sm text-green-600 dark:text-green-400">
                <Shield className="h-4 w-4" />
                <span>Identity verified</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HostProfileCard;
