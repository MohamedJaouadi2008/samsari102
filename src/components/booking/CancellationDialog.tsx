import React, { useState, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface CancellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  cancelledBy: 'guest' | 'host';
  onCancelled: () => void;
}

interface RefundCalculation {
  refund_percentage: number;
  refund_amount: number;
  reason: string;
  days_until_checkin: number;
  cancellation_policy: string;
  deposit_paid: number;
  error?: string;
}

const CancellationDialog: React.FC<CancellationDialogProps> = ({
  open,
  onOpenChange,
  bookingId,
  cancelledBy,
  onCancelled
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(true);
  const [refundInfo, setRefundInfo] = useState<RefundCalculation | null>(null);

  useEffect(() => {
    if (open && bookingId && bookingId.length > 0) {
      calculateRefund();
    } else if (open && !bookingId) {
      setCalculating(false);
      setRefundInfo(null);
    }
  }, [open, bookingId]);

  const calculateRefund = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.rpc('calculate_cancellation_refund', {
        p_booking_id: bookingId,
        p_cancelled_by: cancelledBy
      });

      if (error) {
        console.error('RPC error:', error);
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('deposit_amount, total_price, check_in_date, properties(cancellation_policy)')
          .eq('id', bookingId)
          .single();
        
        if (bookingData) {
          const depositPaid = bookingData.deposit_amount || Math.round(bookingData.total_price * 0.2);
          const daysUntilCheckin = Math.ceil((new Date(bookingData.check_in_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const policy = (bookingData.properties as any)?.cancellation_policy || 'moderate';
          
          let refundPercentage = 0;
          let reason = '';
          
          if (cancelledBy === 'host') {
            refundPercentage = 100;
            reason = 'Full refund - cancelled by host';
          } else if (policy === 'flexible' && daysUntilCheckin >= 1) {
            refundPercentage = 100;
            reason = 'Full refund under flexible policy';
          } else if (policy === 'moderate' && daysUntilCheckin >= 5) {
            refundPercentage = 100;
            reason = 'Full refund - more than 5 days before check-in';
          } else if (policy === 'moderate' && daysUntilCheckin >= 1) {
            refundPercentage = 50;
            reason = '50% refund - less than 5 days before check-in';
          } else if (policy === 'strict' && daysUntilCheckin >= 14) {
            refundPercentage = 50;
            reason = '50% refund under strict policy';
          } else {
            refundPercentage = 0;
            reason = 'No refund available based on cancellation policy';
          }
          
          setRefundInfo({
            refund_percentage: refundPercentage,
            refund_amount: Math.round(depositPaid * (refundPercentage / 100)),
            reason,
            days_until_checkin: daysUntilCheckin,
            cancellation_policy: policy,
            deposit_paid: depositPaid
          });
        } else {
          throw new Error('Booking not found');
        }
      } else {
        setRefundInfo(data as unknown as RefundCalculation);
      }
    } catch (error) {
      console.error('Error calculating refund:', error);
      toast({
        title: "Error",
        description: t('cancel.error'),
        variant: "destructive"
      });
      setRefundInfo({ error: t('cancel.error') } as RefundCalculation);
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmCancellation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-cancellation-refund', {
        body: { bookingId, cancelledBy }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to process cancellation');

      toast({
        title: t('cancel.cancelled_title'),
        description: data.refund_amount > 0 
          ? t('cancel.cancelled_with_refund', { amount: data.refund_amount.toFixed(2) })
          : t('cancel.cancelled_no_refund')
      });

      onCancelled();
      onOpenChange(false);
    } catch (error: any) {
      console.error('[CancellationDialog] Error cancelling booking:', error);
      let errorMessage = "Failed to cancel booking";
      if (error.message?.includes('violates row-level security')) {
        errorMessage = "You don't have permission to cancel this booking. Please contact support.";
      } else if (error.message?.includes('validate_booking_status_transition')) {
        errorMessage = "This booking cannot be cancelled in its current state.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getPolicyBadgeColor = (policy: string) => {
    switch (policy) {
      case 'flexible': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'strict': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('cancel.title')}
          </DialogTitle>
          <DialogDescription>{t('cancel.desc')}</DialogDescription>
        </DialogHeader>

        {calculating ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">{t('cancel.calculating')}</p>
          </div>
        ) : refundInfo?.error ? (
          <div className="py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">{refundInfo.error}</p>
          </div>
        ) : refundInfo && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('cancel.policy')}</span>
              <Badge className={getPolicyBadgeColor(refundInfo.cancellation_policy)}>
                {refundInfo.cancellation_policy || 'Standard'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('cancel.days_until')}</span>
              <span className="font-medium">{refundInfo.days_until_checkin} {t('cancel.days')}</span>
            </div>

            <Separator />

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('cancel.deposit_paid')}</span>
                <span>{refundInfo.deposit_paid} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('cancel.refund_pct')}</span>
                <span>{refundInfo.refund_percentage}%</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>{t('cancel.refund_amount')}</span>
                <span className={refundInfo.refund_amount > 0 ? 'text-green-600' : 'text-destructive'}>
                  {refundInfo.refund_amount} TND
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm">
              {refundInfo.refund_percentage === 100 ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              ) : refundInfo.refund_percentage > 0 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              )}
              <p className="text-muted-foreground">{refundInfo.reason}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel.keep')}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirmCancellation}
            disabled={loading || calculating}
          >
            {loading ? t('cancel.cancelling') : t('cancel.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancellationDialog;
