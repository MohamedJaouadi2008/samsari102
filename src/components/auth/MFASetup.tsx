import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Smartphone, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";

type Factor = { id: string; status: string; friendly_name?: string };

/**
 * TOTP MFA enrollment + management.
 * SMS / Phone MFA is intentionally not exposed yet — it requires the
 * Supabase Phone provider to be configured (Twilio/MessageBird/Vonage).
 * When that's enabled in the dashboard, add a sibling enroll flow with
 * `factorType: 'phone'`.
 */
export const MFASetup = () => {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors(data.totp || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
      });
      if (error) throw error;
      setEnrollFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e: any) {
      toast({ title: "Enrollment failed", description: e.message, variant: "destructive" });
      setEnrolling(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollFactorId || code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (chErr) throw chErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: ch.id,
        code,
      });
      if (error) throw error;
      toast({ title: "MFA enabled", description: "Two-factor authentication is now active on your account." });
      setEnrolling(false);
      setEnrollFactorId(null);
      setQr(null);
      setSecret(null);
      setCode("");
      await refresh();
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const cancelEnroll = async () => {
    if (enrollFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollFactorId });
    }
    setEnrolling(false);
    setEnrollFactorId(null);
    setQr(null);
    setSecret(null);
    setCode("");
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm("Disable two-factor authentication? Your account will be less secure.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "MFA disabled" });
      await refresh();
    }
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMFA = verifiedFactors.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
          {hasMFA && <Badge variant="secondary" className="ml-2">Enabled</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            {qr && (
              <>
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.).
                </p>
                <div className="flex justify-center bg-white p-4 rounded-lg border">
                  <img src={qr} alt="MFA QR code" className="w-48 h-48" />
                </div>
                {secret && (
                  <div className="text-xs text-center text-muted-foreground">
                    Or enter this secret manually:{" "}
                    <code className="bg-muted px-2 py-1 rounded font-mono select-all">{secret}</code>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-center block">Enter the 6-digit code from your app</Label>
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
                </div>
                <div className="flex gap-2">
                  <Button onClick={verifyEnroll} disabled={code.length !== 6 || verifying} className="flex-1">
                    {verifying ? "Verifying..." : "Verify & Enable"}
                  </Button>
                  <Button onClick={cancelEnroll} variant="outline">Cancel</Button>
                </div>
              </>
            )}
          </div>
        ) : hasMFA ? (
          <>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is protecting your account. You'll be asked for a code each time you sign in.
            </p>
            {verifiedFactors.map((f) => (
              <div key={f.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{f.friendly_name || "Authenticator app"}</p>
                    <p className="text-xs text-muted-foreground">TOTP</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeFactor(f.id)}>
                  <ShieldOff className="h-4 w-4 mr-1" /> Disable
                </Button>
              </div>
            ))}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security. You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
            </p>
            <Button onClick={startEnroll}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Enable Two-Factor Authentication
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};