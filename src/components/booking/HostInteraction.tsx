
import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Phone } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/contexts/LanguageContext";

type Property = Tables<"properties">;

interface HostInteractionProps {
  property: Property;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  guestMessage: string;
  setGuestMessage: (value: string) => void;
  onSubmitBooking: () => void;
  submitting: boolean;
}

const HostInteraction = ({
  property,
  phoneNumber,
  setPhoneNumber,
  guestMessage,
  setGuestMessage,
  onSubmitBooking,
  submitting
}: HostInteractionProps) => {
  const { t } = useLanguage();
  const [countryCode, setCountryCode] = useState("+216");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const getLocalNumber = useCallback((fullPhone: string) => {
    return fullPhone.replace(/^\+\d+\s*/, '').trim();
  }, []);

  const syncAutofill = useCallback(() => {
    if (phoneInputRef.current) {
      const domValue = phoneInputRef.current.value;
      const localFromState = getLocalNumber(phoneNumber);
      if (domValue && domValue !== localFromState) {
        setPhoneNumber(`${countryCode} ${domValue.replace(/^\+\d+\s*/, '')}`);
      }
    }
  }, [phoneNumber, countryCode, getLocalNumber, setPhoneNumber]);

  const getHostWelcomeMessage = () => {
    if (property?.welcome_message) {
      return property.welcome_message;
    }
    return t('hi.welcome_default', { city: property?.city || '—' });
  };

  const handlePhoneChange = (value: string) => {
    const localDigits = value.replace(/^\+\d+\s*/, '');
    setPhoneNumber(`${countryCode} ${localDigits}`);
  };

  const handleCountryCodeChange = (value: string) => {
    setCountryCode(value);
    const phoneWithoutCode = phoneNumber.replace(/^\+\d+\s*/, '');
    setPhoneNumber(`${value} ${phoneWithoutCode}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('hi.message_from_host')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg mb-4">
            <p className="text-sm whitespace-pre-line">
              {getHostWelcomeMessage()}
            </p>
          </div>
          
          <div className="space-y-4">
            <Label>{t('hi.send_message')}</Label>
            <Textarea
              value={guestMessage}
              onChange={(e) => setGuestMessage(e.target.value)}
              placeholder={t('hi.message_placeholder')}
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('hi.house_rules')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {property.house_rules ? (
              <p className="whitespace-pre-line">{property.house_rules}</p>
            ) : (
              <>
                <p>• {t('rr.checkin')}: {property.check_in_time || "15:00"}</p>
                <p>• {t('rr.checkout')}: {property.check_out_time || "11:00"}</p>
                <p>• {t('hi.no_events')}</p>
                <p>• {t('hi.no_pets')}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {t('hi.phone_number')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>{t('hi.country')}</Label>
                <Select value={countryCode} onValueChange={handleCountryCodeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+216">🇹🇳 Tunisia (+216)</SelectItem>
                    <SelectItem value="+1">🇺🇸 USA (+1)</SelectItem>
                    <SelectItem value="+33">🇫🇷 France (+33)</SelectItem>
                    <SelectItem value="+49">🇩🇪 Germany (+49)</SelectItem>
                    <SelectItem value="+44">🇬🇧 UK (+44)</SelectItem>
                    <SelectItem value="+39">🇮🇹 Italy (+39)</SelectItem>
                    <SelectItem value="+34">🇪🇸 Spain (+34)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{t('hi.phone_required')}</Label>
                <Input
                  ref={phoneInputRef}
                  value={getLocalNumber(phoneNumber)}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onFocus={syncAutofill}
                  onBlur={syncAutofill}
                  placeholder="XX XXX XXX"
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              {t('hi.terms_notice')}
            </div>
            
            <Button 
              onClick={onSubmitBooking} 
              disabled={submitting}
              className="w-full"
            >
              {submitting ? t('hi.submitting') : t('hi.confirm_booking')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HostInteraction;
