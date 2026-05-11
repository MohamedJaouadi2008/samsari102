
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { signInSchema, signUpSchema } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { MFAChallenge } from "@/components/auth/MFAChallenge";

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [signInToken, setSignInToken] = useState<string>("");
  const [signUpToken, setSignUpToken] = useState<string>("");
  const [signInWidgetKey, setSignInWidgetKey] = useState(0);
  const [signUpWidgetKey, setSignUpWidgetKey] = useState(0);
  
  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });
  
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: ""
  });
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (error) {
        toast({
          title: "Google sign in failed",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (user && !mfaRequired) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location, mfaRequired]);

  const checkMfaAfterLogin = async () => {
    // After password login, see if AAL needs to step up
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    if (data.nextLevel === "aal2" && data.currentLevel === "aal1") {
      setMfaRequired(true);
      return true;
    }
    return false;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const validated = signInSchema.parse(signInData);
      const { error } = await signIn(validated.email, validated.password, signInToken);
      
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive"
        });
        setSignInToken("");
        setSignInWidgetKey((k) => k + 1);
      } else {
        await checkMfaAfterLogin();
      }
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.errors?.[0]?.message || "Invalid input",
        variant: "destructive"
      });
      setSignInToken("");
      setSignInWidgetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const validated = signUpSchema.parse(signUpData);
      const { error } = await signUp(validated.email, validated.password, validated.fullName, signUpToken);
      
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
        setSignUpToken("");
        setSignUpWidgetKey((k) => k + 1);
      } else {
        // Capture referral code from URL if present
        const refCode = new URLSearchParams(location.search).get("ref");
        if (refCode) {
          try {
            await supabase.functions.invoke("process-referral-signup", { body: { referralCode: refCode } });
          } catch (e) {
            console.warn("Referral capture failed:", e);
          }
        }
        toast({
          title: t('auth.welcome_toast'),
          description: t('auth.welcome_toast_desc')
        });
        navigate('/profile', { replace: true });
      }
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.errors?.[0]?.message || "Invalid input",
        variant: "destructive"
      });
      setSignUpToken("");
      setSignUpWidgetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  if (user && !mfaRequired) return null;

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <Link to="/" className="flex items-center justify-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-primary">Samsari</span>
            </Link>
          </div>
          <MFAChallenge
            onSuccess={() => {
              setMfaRequired(false);
              const from = location.state?.from?.pathname || "/";
              navigate(from, { replace: true });
            }}
            onCancel={() => setMfaRequired(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <Link to="/" className="flex items-center justify-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">Samsari</span>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            {t('auth.welcome')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.subtitle')}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t('auth.signin_tab')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.signup_tab')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">{t('auth.email_label')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">{t('auth.password_label')}</Label>
                      <Link to="/reset-password" className="text-xs text-primary hover:underline">
                        {t('auth.forgot_password')}
                      </Link>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-center">
                    <TurnstileWidget
                      key={`signin-${signInWidgetKey}`}
                      onVerify={setSignInToken}
                      onError={() => {
                        setSignInToken("");
                        setSignInWidgetKey((k) => k + 1);
                      }}
                      onExpire={() => {
                        setSignInToken("");
                        setSignInWidgetKey((k) => k + 1);
                      }}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !signInToken}>
                    {loading ? t('auth.signing_in') : t('auth.sign_in_btn')}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t('auth.or_continue_with')}</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {googleLoading ? t('auth.signing_in') : t('auth.google_signin')}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">{t('auth.full_name')}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">{t('auth.email_label')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">{t('auth.password_label')}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-center">
                    <TurnstileWidget
                      key={`signup-${signUpWidgetKey}`}
                      onVerify={setSignUpToken}
                      onError={() => {
                        setSignUpToken("");
                        setSignUpWidgetKey((k) => k + 1);
                      }}
                      onExpire={() => {
                        setSignUpToken("");
                        setSignUpWidgetKey((k) => k + 1);
                      }}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !signUpToken}>
                    {loading ? t('auth.creating_account') : t('auth.sign_up_btn')}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t('auth.or_continue_with')}</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {googleLoading ? t('auth.signing_in') : t('auth.google_signin')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
