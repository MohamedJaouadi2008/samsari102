import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { changePasswordSchema } from "@/lib/validation";
import { useLanguage } from "@/contexts/LanguageContext";

const ChangePassword = () => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = changePasswordSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword
      });

      const { error } = await supabase.auth.updateUser({
        password: validated.newPassword
      });

      if (error) throw error;

      toast({
        title: t('prof.success'),
        description: t('cp.success')
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: t('prof.error'),
        description: error.errors?.[0]?.message || error.message || t('cp.fail'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lock className="h-5 w-5" />
          <span>{t('cp.title')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <Label htmlFor="current_password">{t('cp.current')}</Label>
            <Input
              id="current_password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="new_password">{t('cp.new')}</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <Label htmlFor="confirm_password">{t('cp.confirm')}</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? t('cp.updating') : t('cp.update')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ChangePassword;
