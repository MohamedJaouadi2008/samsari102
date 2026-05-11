import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Lock, Wifi, Car, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  data: {
    arrival_instructions?: string | null;
    wifi_name?: string | null;
    wifi_password?: string | null;
    parking_info?: string | null;
    lockbox_code?: string | null;
  };
  onUpdate: (updates: Partial<Props["data"]>) => void;
}

const ArrivalInstructionsForm: React.FC<Props> = ({ data, onUpdate }) => {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="w-4 h-4 text-primary" />
          {t('arr.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('arr.desc')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Wifi className="w-3.5 h-3.5" /> {t('arr.wifi_name')}
            </Label>
            <Input
              value={data.wifi_name || ""}
              onChange={(e) => onUpdate({ wifi_name: e.target.value })}
              placeholder={t('arr.wifi_name_ph')}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">{t('arr.wifi_pass')}</Label>
            <Input
              value={data.wifi_password || ""}
              onChange={(e) => onUpdate({ wifi_password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3.5 h-3.5" /> {t('arr.lockbox')}
            </Label>
            <Input
              value={data.lockbox_code || ""}
              onChange={(e) => onUpdate({ lockbox_code: e.target.value })}
              placeholder={t('arr.lockbox_ph')}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Car className="w-3.5 h-3.5" /> {t('arr.parking')}
            </Label>
            <Input
              value={data.parking_info || ""}
              onChange={(e) => onUpdate({ parking_info: e.target.value })}
              placeholder={t('arr.parking_ph')}
            />
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5 mb-1.5">
            <Info className="w-3.5 h-3.5" /> {t('arr.detailed')}
          </Label>
          <Textarea
            value={data.arrival_instructions || ""}
            onChange={(e) => onUpdate({ arrival_instructions: e.target.value })}
            placeholder={t('arr.detailed_ph')}
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ArrivalInstructionsForm;
