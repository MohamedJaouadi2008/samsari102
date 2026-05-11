import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface MFAChallengeProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Shown after a successful password login when the user has TOTP enrolled
 * but their session is at AAL1 (needs to step up to AAL2).
 */
export const MFAChallenge = ({ onSuccess, onCancel }: MFAChallengeProps) => {
  const { toast } = useToast();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast({ title: "MFA error", description: error.message, variant: "destructive" });
        onCancel();
        return;
      }
      const totp = data.totp.find((f) => f.status === "verified");
      if (!totp) {
        // No verified factor — nothing to challenge. Skip.
        onSuccess();
        return;
      }
      setFactorId(totp.id);
      setLoading(false);
    })();
  }, [onCancel, onSuccess, toast]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (error) throw error;
      toast({ title: "Verified", description: "Two-factor authentication successful." });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={handleVerify} disabled={code.length !== 6 || verifying} className="w-full">
          {verifying ? "Verifying..." : "Verify"}
        </Button>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            onCancel();
          }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cancel and sign out
        </button>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" /> Protected by TOTP
        </p>
      </CardContent>
    </Card>
  );
};