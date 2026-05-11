import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, AlertTriangle, LogOut, Lock, Info, Camera, Clock } from 'lucide-react';
import EvidencePhotoUpload from './EvidencePhotoUpload';

interface CheckOutConfirmationProps {
  bookingId: string;
  role: 'host' | 'guest';
  hostConfirmed: boolean;
  guestConfirmed: boolean;
  onConfirmed: () => void;
  checkOutCountdown?: { days: number; hours: number; minutes: number } | null;
}

const CheckOutConfirmation: React.FC<CheckOutConfirmationProps> = ({
  bookingId,
  role,
  hostConfirmed,
  guestConfirmed,
  onConfirmed,
  checkOutCountdown
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountdownPopup, setShowCountdownPopup] = useState(false);
  const [damageStatus, setDamageStatus] = useState<'ok' | 'damage'>('ok');
  const [damageDescription, setDamageDescription] = useState('');
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const [propertyConditionOk, setPropertyConditionOk] = useState(true);

  const hasMinimumPhotos = damagePhotos.length >= 1;
  const canSubmitDamage = damageStatus === 'damage' && damageDescription.trim().length >= 10 && hasMinimumPhotos;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-check-out', {
        body: {
          bookingId,
          role,
          propertyConditionOk: role === 'guest' ? propertyConditionOk : damageStatus === 'ok',
          damageReported: role === 'host' ? damageStatus === 'damage' : false,
          damageDescription: role === 'host' && damageStatus === 'damage' ? damageDescription : undefined,
          damagePhotos: role === 'host' && damageStatus === 'damage' ? damagePhotos : undefined
        }
      });

      if (error) throw error;

      toast({ title: t('cic.toast.confirmed'), description: data.message });

      if (data.disputeMode) {
        toast({
          title: t('coc.toast.dispute_filed'),
          description: t('coc.toast.dispute_filed_desc'),
          variant: "destructive"
        });
      }

      onConfirmed();
    } catch (error: any) {
      console.error('Error confirming check-out:', error);
      toast({
        title: "Error",
        description: error.message || t('coc.toast.failed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const alreadyConfirmed = role === 'host' ? hostConfirmed : guestConfirmed;
  const otherPartyConfirmed = role === 'host' ? guestConfirmed : hostConfirmed;

  if (alreadyConfirmed) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{t('coc.you_confirmed_checkout')}</span>
          </div>
          {!otherPartyConfirmed && (
            <p className="text-sm text-muted-foreground mt-2">
              {role === 'host' ? t('cic.waiting_for_guest') : t('cic.waiting_for_host')}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            {role === 'host' ? t('coc.confirm_condition') : t('coc.confirm_checkout')}
          </CardTitle>
          <CardDescription>
            {role === 'host' ? t('coc.host_desc') : t('coc.guest_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">{t('coc.funds_release')}</p>
              <p>{role === 'host' ? t('coc.funds_release_host_desc') : t('coc.funds_release_guest_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {otherPartyConfirmed ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{role === 'host' ? t('coc.guest_checked_out') : t('coc.host_checked_out')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>{role === 'host' ? t('cic.waiting_guest_short') : t('cic.waiting_host_short')}</span>
              </div>
            )}
          </div>

          {role === 'host' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('cic.condition_label')}</Label>
                <RadioGroup value={damageStatus} onValueChange={(v) => setDamageStatus(v as 'ok' | 'damage')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ok" id="damage-ok" />
                    <Label htmlFor="damage-ok" className="font-normal flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {t('coc.condition_ok')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="damage" id="damage-yes" />
                    <Label htmlFor="damage-yes" className="font-normal flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      {t('coc.damage_found')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {damageStatus === 'damage' && (
                <div className="space-y-4 border-l-2 border-destructive pl-4">
                  <div className="space-y-2">
                    <Label>{t('coc.describe_damage')} <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={damageDescription}
                      onChange={(e) => setDamageDescription(e.target.value)}
                      placeholder={t('coc.describe_damage_ph')}
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('coc.chars_min', { count: damageDescription.length })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      {t('coc.photo_evidence')} <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">{t('coc.photo_required')}</p>
                    <EvidencePhotoUpload
                      bookingId={bookingId}
                      uploadType="damage-claims"
                      photos={damagePhotos}
                      onPhotosChange={setDamagePhotos}
                      minPhotos={1}
                      maxPhotos={10}
                      disabled={loading}
                    />
                  </div>

                  {!hasMinimumPhotos && (
                    <div className="bg-destructive/10 p-3 rounded-lg">
                      <p className="text-sm text-destructive font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {t('coc.photo_required_warn')}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-destructive">{t('coc.false_warning')}</p>
                </div>
              )}
            </div>
          )}

          {role === 'guest' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                {t('coc.guest_confirm_label')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('coc.guest_confirm_desc')}</p>
            </div>
          )}

          <Button 
            onClick={() => {
              if (checkOutCountdown) {
                setShowCountdownPopup(true);
              } else {
                setShowConfirmDialog(true);
              }
            }}
            className="w-full"
            variant={role === 'host' && damageStatus === 'damage' ? 'destructive' : 'default'}
            disabled={loading || (role === 'host' && damageStatus === 'damage' && !canSubmitDamage)}
          >
            {role === 'host' 
              ? (damageStatus === 'damage' ? t('coc.report_damage') : t('coc.confirm_release'))
              : t('coc.confirm_checkout')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showCountdownPopup} onOpenChange={setShowCountdownPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('coc.not_yet_available')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{t('coc.not_yet_desc')}</p>
                {checkOutCountdown && (
                  <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-4">
                    <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">{t('coc.opens_in')}</p>
                    <div className="flex gap-4 justify-center">
                      {checkOutCountdown.days > 0 && (
                        <div className="text-center">
                          <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.days}</span>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{t('cic.units.days')}</p>
                        </div>
                      )}
                      <div className="text-center">
                        <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.hours}</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{t('cic.units.hours')}</p>
                      </div>
                      <div className="text-center">
                        <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkOutCountdown.minutes}</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{t('cic.units.mins')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cic.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {role === 'host' && damageStatus === 'damage' 
                ? t('coc.report_damage')
                : t('coc.confirm_checkout')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {role === 'host' 
                ? damageStatus === 'damage'
                  ? t('coc.dialog_damage_summary', { count: damagePhotos.length })
                  : t('coc.dialog_ok_summary')
                : t('coc.dialog_guest_summary')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cic.dialog_cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm} 
              disabled={loading}
              className={role === 'host' && damageStatus === 'damage' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {loading ? t('cic.dialog_processing') : t('cic.dialog_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CheckOutConfirmation;
