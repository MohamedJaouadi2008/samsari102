import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Ban, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface BanWarningDialogProps {
  userId: string | null;
  onAcknowledged: () => void;
}

interface UserStatus {
  is_banned: boolean;
  banned_reason: string | null;
  warning_count: number;
  last_warning_reason: string | null;
  last_warning_at: string | null;
}

interface ExistingAppeal {
  id: string;
  status: string;
  created_at: string;
}

export const BanWarningDialog = ({ userId, onAcknowledged }: BanWarningDialogProps) => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [existingAppeal, setExistingAppeal] = useState<ExistingAppeal | null>(null);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  useEffect(() => {
    if (userId) {
      checkUserStatus();
    }
  }, [userId]);

  const checkUserStatus = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_banned, banned_reason, warning_count, last_warning_reason, last_warning_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user status:', error);
        return;
      }

      if (data) {
        setUserStatus(data as UserStatus);
        
        // Show dialog if banned
        if (data.is_banned) {
          // Check for existing appeal
          const { data: appealData } = await supabase
            .from('ban_appeals')
            .select('id, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (appealData) {
            setExistingAppeal(appealData);
          }
          
          setOpen(true);
          return;
        }

        // Show dialog if there's a new warning that hasn't been acknowledged
        const lastAcknowledged = localStorage.getItem(`warning_ack_${userId}`);
        const lastWarningTime = data.last_warning_at ? new Date(data.last_warning_at).getTime() : 0;
        const lastAckTime = lastAcknowledged ? parseInt(lastAcknowledged, 10) : 0;

        if (data.warning_count > 0 && lastWarningTime > lastAckTime) {
          setOpen(true);
        }
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const handleAcknowledge = async () => {
    if (!userStatus || !userId) return;
    
    setLoading(true);

    try {
      if (userStatus.is_banned) {
        // Sign out the banned user
        await signOut();
      } else {
        // Mark warning as acknowledged in localStorage
        localStorage.setItem(`warning_ack_${userId}`, Date.now().toString());
        setOpen(false);
        onAcknowledged();
      }
    } catch (error) {
      console.error('Error acknowledging:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!userId || !appealReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for your appeal",
        variant: "destructive"
      });
      return;
    }

    setSubmittingAppeal(true);

    try {
      const { error } = await supabase
        .from('ban_appeals')
        .insert({
          user_id: userId,
          appeal_reason: appealReason.trim()
        });

      if (error) throw error;

      toast({
        title: "Appeal Submitted",
        description: "Your appeal has been submitted and will be reviewed by our team."
      });

      setShowAppealForm(false);
      setExistingAppeal({
        id: 'new',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error submitting appeal:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit appeal",
        variant: "destructive"
      });
    } finally {
      setSubmittingAppeal(false);
    }
  };

  if (!userStatus) return null;

  const isBanned = userStatus.is_banned;
  const warningCount = userStatus.warning_count || 0;
  const strikesRemaining = 3 - warningCount;
  const hasAppealed = existingAppeal !== null;
  const appealStatus = existingAppeal?.status;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBanned ? (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                You Have Been Banned
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                You have Been Warned
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isBanned ? (
              "Your account has been permanently banned from using this platform."
            ) : (
              `This is ${warningCount === 1 ? 'the first' : warningCount === 2 ? 'the second' : `strike ${warningCount}`} strike. ${strikesRemaining > 0 ? `On ${strikesRemaining === 1 ? 'the next' : `${strikesRemaining} more`} strike${strikesRemaining > 1 ? 's' : ''} you will be permanently banned from using this platform.` : 'This is your final warning.'}`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">Reason</Label>
            <Textarea
              readOnly
              value={isBanned ? (userStatus.banned_reason || 'No reason provided') : (userStatus.last_warning_reason || 'No reason provided')}
              className="mt-2 resize-none bg-muted"
              rows={3}
            />
          </div>

          {/* Appeal Section - Only for banned users */}
          {isBanned && (
            <div className="border-t pt-4">
              {hasAppealed ? (
                <div className="text-sm">
                  <p className="font-medium">Appeal Status</p>
                  <p className="text-muted-foreground mt-1">
                    {appealStatus === 'pending' && "Your appeal is under review. You will be notified of the decision."}
                    {appealStatus === 'approved' && "Your appeal has been approved! Please log in again."}
                    {appealStatus === 'rejected' && "Your appeal has been rejected."}
                  </p>
                </div>
              ) : showAppealForm ? (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Why should we lift your ban?</Label>
                  <Textarea
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="Explain why you believe your ban should be reconsidered..."
                    className="resize-none"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAppealForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitAppeal}
                      disabled={submittingAppeal || !appealReason.trim()}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {submittingAppeal ? "Submitting..." : "Submit Appeal"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAppealForm(true)}
                  className="w-full"
                >
                  Appeal This Decision
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            onClick={handleAcknowledge}
            disabled={loading}
            variant={isBanned ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {loading ? "Processing..." : isBanned ? "I Understand" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BanWarningDialog;
