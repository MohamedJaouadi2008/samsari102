import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Shield, Camera, CheckCircle2, Circle, Clock, FileSearch, Gavel } from 'lucide-react';
import EvidencePhotoUpload from './EvidencePhotoUpload';

interface DisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingStatus?: string;
  propertyTitle: string;
  onDisputeFiled: () => void;
}

const DISPUTE_REASON_VALUES = [
  { value: 'property_not_as_described', tKey: 'dispute.reason.not_as_described' },
  { value: 'cleanliness_issues', tKey: 'dispute.reason.cleanliness' },
  { value: 'amenities_missing', tKey: 'dispute.reason.amenities' },
  { value: 'safety_concerns', tKey: 'dispute.reason.safety' },
  { value: 'host_behavior', tKey: 'dispute.reason.host' },
  { value: 'early_checkout_forced', tKey: 'dispute.reason.early_checkout' },
  { value: 'other', tKey: 'dispute.reason.other' },
];

const DISPUTEABLE_STATUSES = ['checked_out', 'settlement_pending', 'dispute_window'];

const DisputeDialog: React.FC<DisputeDialogProps> = ({
  open,
  onOpenChange,
  bookingId,
  bookingStatus,
  propertyTitle,
  onDisputeFiled
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const DISPUTE_REASONS = DISPUTE_REASON_VALUES.map(r => ({ value: r.value, label: t(r.tKey) }));
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const canDispute = !bookingStatus || DISPUTEABLE_STATUSES.includes(bookingStatus);
  const hasMinimumEvidence = evidencePhotos.length >= 1;

  const handleSubmitDispute = async () => {
    if (!bookingId || bookingId.length === 0) {
      toast({ title: "Error", description: t('dispute.toast.invalid'), variant: "destructive" });
      return;
    }
    if (!canDispute) {
      toast({ title: t('dispute.toast.cannot_file'), description: t('dispute.toast.cannot_file_desc'), variant: "destructive" });
      return;
    }
    if (!selectedReason) {
      toast({ title: t('dispute.toast.select_reason'), description: t('dispute.toast.select_reason_desc'), variant: "destructive" });
      return;
    }
    if (description.trim().length < 20) {
      toast({ title: t('dispute.toast.describe'), description: t('dispute.toast.describe_desc'), variant: "destructive" });
      return;
    }
    if (!hasMinimumEvidence) {
      toast({ title: t('dispute.toast.photo_required'), description: t('dispute.toast.photo_required_desc'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const reasonLabel = DISPUTE_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
      const fullReason = `${reasonLabel}: ${description}`;

      // Create evidence object with photos and timestamps
      const disputeEvidence = {
        photos: evidencePhotos,
        uploaded_at: new Date().toISOString(),
        reason_code: selectedReason,
        description: description
      };

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'disputed',
          dispute_reason: fullReason,
          dispute_evidence: disputeEvidence,
          dispute_opened_at: new Date().toISOString(),
          dispute_filed_by: 'guest'
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast({ title: t('dispute.toast.filed'), description: t('dispute.toast.filed_desc') });

      onDisputeFiled();
      onOpenChange(false);
      setSelectedReason('');
      setDescription('');
      setEvidencePhotos([]);
    } catch (error: any) {
      console.error('Error filing dispute:', error);
      toast({ title: "Error", description: error.message || t('dispute.toast.failed'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setSelectedReason('');
      setDescription('');
      setEvidencePhotos([]);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {t('dispute.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dispute.desc', { property: propertyTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg flex items-start gap-2">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{t('dispute.protection')}</p>
              <p className="text-muted-foreground">{t('dispute.protection_desc')}</p>
            </div>
          </div>

          {/* Resolution timeline */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dispute.next_steps')}</p>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <FileSearch className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>{t('dispute.step1')}</strong> {t('dispute.step1_desc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>{t('dispute.step2')}</strong> {t('dispute.step2_desc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Gavel className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>{t('dispute.step3')}</strong> {t('dispute.step3_desc')}</span>
              </li>
            </ol>
          </div>

          {/* Evidence checklist */}
          <div className="border rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('dispute.checklist')}</p>
            {[
              { ok: !!selectedReason, label: t('dispute.check_reason') },
              { ok: description.trim().length >= 20, label: t('dispute.check_describe') },
              { ok: hasMinimumEvidence, label: t('dispute.check_photo') },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>{t('dispute.what_issue')}</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {DISPUTE_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('dispute.describe_label')}</Label>
            <Textarea
              id="description"
              placeholder={t('dispute.describe_ph')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <div className="flex items-center justify-between text-xs">
              <p className="text-muted-foreground">{t('dispute.specific_help')}</p>
              <p className={description.length >= 20 ? 'text-emerald-600' : 'text-muted-foreground'}>
                {description.length} / 20 min
              </p>
            </div>
          </div>

          {/* Photo Evidence Upload - REQUIRED */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {t('dispute.photo_evidence')} <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">{t('dispute.photo_desc')}</p>
            <EvidencePhotoUpload
              bookingId={bookingId}
              uploadType="dispute-evidence"
              photos={evidencePhotos}
              onPhotosChange={setEvidencePhotos}
              minPhotos={1}
              maxPhotos={5}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            {t('dispute.cancel')}
          </Button>
          <Button 
            onClick={handleSubmitDispute}
            disabled={loading || !selectedReason || description.length < 20 || !hasMinimumEvidence}
          >
            {loading ? t('dispute.submitting') : t('dispute.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DisputeDialog;
