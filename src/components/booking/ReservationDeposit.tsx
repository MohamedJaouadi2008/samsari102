import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReservationDepositProps {
  totalPrice: number;
}

const ReservationDeposit = ({ totalPrice }: ReservationDepositProps) => {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const serviceFee = Math.round(totalPrice * 0.05);
  const totalCharge = totalPrice + serviceFee;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t('host_booking.payment_summary')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">{t('host_booking.full_payment_required')}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {t('host_booking.full_payment_desc')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>{t('host_booking.property_total')}</span>
              <span className="font-medium">{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('booking.service_fee')} (5%)</span>
              <span className="font-medium">{formatPrice(serviceFee)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>{t('host_booking.total_due')}</span>
              <span>{formatPrice(totalCharge)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationDeposit;
