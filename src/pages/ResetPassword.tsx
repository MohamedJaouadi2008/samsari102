import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const type = searchParams.get("type");
    if (accessToken && type === "recovery") {
      setIsResetMode(true);
    }
  }, [searchParams]);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast({ title: "Verification required", description: "Please complete the CAPTCHA.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });
      if (error) throw error;
      setEmailSent(true);
      toast({ title: "Email Sent", description: "Check your inbox for the password reset link or code." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send reset email", variant: "destructive" });
      setCaptchaToken("");
      setWidgetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({ title: "Invalid Code", description: t('reset.enter_code_desc'), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "recovery" });
      if (error) throw error;
      setIsResetMode(true);
      setShowOtpInput(false);
      toast({ title: "Code Verified", description: "You can now set your new password." });
    } catch (error: any) {
      toast({ title: "Invalid Code", description: error.message || "The code is invalid or expired.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password Updated", description: "Your password has been successfully reset." });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Email sent confirmation with OTP option
  if (emailSent && !isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <Link to="/" className="flex items-center justify-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">Samsari</span>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t('reset.check_email')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('reset.email_sent_to')} <strong>{email}</strong>
              </p>
              {!showOtpInput ? (
                <>
                  <Button onClick={() => setShowOtpInput(true)} className="w-full mb-4" variant="default">
                    <KeyRound className="h-4 w-4 mr-2" />
                    {t('reset.enter_code')}
                  </Button>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('reset.didnt_receive')}{" "}
                    <button onClick={() => setEmailSent(false)} className="text-primary hover:underline">
                      {t('reset.try_again')}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">{t('reset.enter_code_desc')}</p>
                  <div className="flex justify-center mb-4">
                    <InputOTP maxLength={6} value={otpCode} onChange={(value) => setOtpCode(value)}>
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
                  <Button onClick={handleVerifyOtp} className="w-full" disabled={loading || otpCode.length !== 6}>
                    {loading ? t('reset.verifying') : t('reset.verify')}
                  </Button>
                  <button onClick={() => setShowOtpInput(false)} className="text-sm text-muted-foreground hover:underline">
                    Cancel
                  </button>
                </div>
              )}
              <Button variant="outline" onClick={() => navigate("/auth")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('reset.back_to_signin')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reset password form
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <Link to="/" className="flex items-center justify-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">Samsari</span>
            </Link>
            <h2 className="mt-6 text-3xl font-bold text-foreground">{t('reset.new_password_title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('reset.new_password_subtitle')}</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">{t('reset.new_password')}</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('reset.new_password_placeholder')} required minLength={6} />
                </div>
                <div>
                  <Label htmlFor="confirm-password">{t('reset.confirm_password')}</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('reset.confirm_placeholder')} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('reset.updating') : t('reset.update_password')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Request reset email form
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <Link to="/" className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">Samsari</span>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-foreground">{t('reset.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('reset.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('reset.email_label')}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('reset.email_placeholder')} required />
              </div>
              <TurnstileWidget
                key={widgetKey}
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('reset.sending') : t('reset.send_link')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/auth" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t('reset.back_to_signin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
