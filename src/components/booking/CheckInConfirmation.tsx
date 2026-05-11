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
import { CheckCircle, AlertTriangle, Home, UserCheck, Lock, Info, Clock } from 'lucide-react';
import EvidencePhotoUpload from './EvidencePhotoUpload';

interface CheckInConfirmationProps {
  bookingId: string;
  role: 'host' | 'guest';
  hostConfirmed: boolean;
  guestConfirmed: boolean;
  onConfirmed: () => void;
  checkInCountdown?: { days: number; hours: number; minutes: number } | null;
}

const CheckInConfirmation: React.FC<CheckInConfirmationProps> = ({
  bookingId,
  role,
  hostConfirmed,
  guestConfirmed,
  onConfirmed,
  checkInCountdown
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCountdownPopup, setShowCountdownPopup] = useState(false);
  const [conditionStatus, setConditionStatus] = useState<'ok' | 'issues'>('ok');
  const [issuesDescription, setIssuesDescription] = useState('');
  const [issuesPhotos, setIssuesPhotos] = useState<string[]>([]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-check-in', {
        body: {
          bookingId,
          role,
          conditionOk: role === 'guest' ? conditionStatus === 'ok' : undefined,
          issuesFound: role === 'guest' ? conditionStatus === 'issues' : undefined,
          issuesDescription: role === 'guest' && conditionStatus === 'issues' ? issuesDescription : undefined,
          issuesPhotos: role === 'guest' && conditionStatus === 'issues' ? issuesPhotos : undefined
        }
      });

      if (error) throw error;

      toast({
        title: conditionStatus === 'issues' ? t('cic.toast.dispute_submitted') : t('cic.toast.confirmed'),
        description: data.message
      });

      if (data.requiresRemainingPayment) {
        toast({
          title: t('cic.toast.payment_required'),
          description: t('cic.toast.payment_required_desc'),
        });
      }

      if (data.checkInDispute) {
        toast({
          title: t('cic.toast.dispute_filed'),
          description: t('cic.toast.dispute_filed_desc'),
        });
      }

      onConfirmed();
    } catch (error: any) {
      console.error('Error confirming check-in:', error);
      toast({
        title: "Error",
        description: error.message || t('cic.toast.failed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const alreadyConfirmed = role === 'host' ? hostConfirmed : guestConfirmed;
  const otherPartyConfirmed = role === 'host' ? guestConfirmed : hostConfirmed;
  const canSubmitIssue = conditionStatus === 'issues' 
    ? issuesDescription.trim().length > 0 && issuesPhotos.length >= 1
    : true;

  if (alreadyConfirmed) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{t('cic.you_confirmed_checkin')}</span>
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
            {role === 'host' ? <UserCheck className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            {role === 'host' ? t('cic.confirm_arrival') : t('cic.confirm_condition')}
          </CardTitle>
          <CardDescription>
            {role === 'host' ? t('cic.confirm_arrival_desc') : t('cic.confirm_condition_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">{t('cic.dual_required')}</p>
              <p>{t('cic.dual_required_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {otherPartyConfirmed ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{role === 'host' ? t('cic.guest_confirmed') : t('cic.host_confirmed')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>{role === 'host' ? t('cic.waiting_guest_short') : t('cic.waiting_host_short')}</span>
              </div>
            )}
          </div>

          {role === 'guest' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('cic.condition_label')}</Label>
                <RadioGroup value={conditionStatus} onValueChange={(v) => setConditionStatus(v as 'ok' | 'issues')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ok" id="condition-ok" />
                    <Label htmlFor="condition-ok" className="font-normal flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {t('cic.condition_ok')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="issues" id="condition-issues" />
                    <Label htmlFor="condition-issues" className="font-normal flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      {t('cic.condition_issues')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {conditionStatus === 'issues' && (
                <div className="space-y-4">
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-orange-800 dark:text-orange-200">{t('cic.document_title')}</p>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">{t('cic.document_intro')}</p>
                        <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 list-disc ml-5 space-y-1">
                          <li><strong>{t('cic.option_checkin_wait')}</strong> {t('cic.option_checkin_wait_desc')}</li>
                          <li><strong>{t('cic.option_no_checkin')}</strong> {t('cic.option_no_checkin_desc')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('cic.describe_issues')}</Label>
                    <Textarea
                      value={issuesDescription}
                      onChange={(e) => setIssuesDescription(e.target.value)}
                      placeholder={t('cic.describe_issues_ph')}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('cic.upload_evidence')}</Label>
                    <EvidencePhotoUpload
                      bookingId={bookingId}
                      uploadType="dispute-evidence"
                      photos={issuesPhotos}
                      onPhotosChange={setIssuesPhotos}
                      minPhotos={1}
                      maxPhotos={10}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <Button 
            onClick={() => {
              if (checkInCountdown) {
                setShowCountdownPopup(true);
              } else {
                setShowConfirmDialog(true);
              }
            }}
            className="w-full"
            variant={conditionStatus === 'issues' ? 'destructive' : 'default'}
            disabled={loading || !canSubmitIssue}
          >
            {role === 'host' 
              ? t('cic.confirm_arrived')
              : conditionStatus === 'issues' 
                ? t('cic.submit_dispute')
                : t('cic.confirm_checkin')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showCountdownPopup} onOpenChange={setShowCountdownPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('cic.not_yet_available')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{t('cic.not_yet_desc')}</p>
                {checkInCountdown && (
                  <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-4">
                    <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">{t('cic.opens_in')}</p>
                    <div className="flex gap-4 justify-center">
                      {checkInCountdown.days > 0 && (
                        <div className="text-center">
                          <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.days}</span>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{t('cic.units.days')}</p>
                        </div>
                      )}
                      <div className="text-center">
                        <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.hours}</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{t('cic.units.hours')}</p>
                      </div>
                      <div className="text-center">
                        <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkInCountdown.minutes}</span>
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
              {role === 'guest' && conditionStatus === 'issues' 
                ? t('cic.dialog_dispute_title')
                : t('cic.dialog_confirm_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {role === 'host' 
                ? t('cic.dialog_host_q')
                : conditionStatus === 'ok'
                  ? t('cic.dialog_guest_ok')
                  : t('cic.dialog_guest_issues')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cic.dialog_cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm} 
              disabled={loading}
              className={conditionStatus === 'issues' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {loading 
                ? t('cic.dialog_processing')
                : conditionStatus === 'issues' 
                  ? t('cic.submit_dispute')
                  : t('cic.dialog_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CheckInConfirmation;
