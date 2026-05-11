import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays, Clock, MapPin, Wifi, KeyRound, Car, Lock, MessageSquare,
  ExternalLink, Info, ShieldCheck, Copy, Check,
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  onMessageHost?: () => void;
}

interface ItineraryData {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  payment_status: string;
  num_guests: number;
  total_price: number;
  property: {
    title: string;
    address: string | null;
    city: string;
    governorate: string;
    google_maps_url: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    house_rules: string | null;
    welcome_message: string | null;
    arrival_instructions: string | null;
    wifi_name: string | null;
    wifi_password: string | null;
    parking_info: string | null;
    lockbox_code: string | null;
  };
  host: { full_name: string | null; phone: string | null } | null;
}

const TripItineraryDialog = ({ open, onOpenChange, bookingId, onMessageHost }: Props) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [data, setData] = useState<ItineraryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bookingId) return;
    const load = async () => {
      setLoading(true);
      const { data: booking, error } = await supabase
        .from("bookings")
        .select(`
          id, property_id, check_in_date, check_out_date, status, payment_status, num_guests, total_price, host_id,
          properties (
            title, city, governorate,
            check_in_time, check_out_time, house_rules, welcome_message
          )
        `)
        .eq("id", bookingId)
        .maybeSingle();

      if (error || !booking) {
        setLoading(false);
        return;
      }

      // Fetch sensitive arrival info via secure RPC (only returns data for booked guests/host/admin)
      const { data: access } = await supabase.rpc("get_property_access_info", {
        _property_id: (booking as any).property_id,
      });
      const accessRow = Array.isArray(access) ? access[0] : access;

      const { data: host } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", booking.host_id)
        .maybeSingle();

      setData({
        id: booking.id,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        status: booking.status || "",
        payment_status: booking.payment_status || "",
        num_guests: booking.num_guests,
        total_price: Number(booking.total_price),
        property: {
          ...(booking.properties as any),
          address: accessRow?.address ?? null,
          google_maps_url: accessRow?.google_maps_url ?? null,
          arrival_instructions: accessRow?.arrival_instructions ?? null,
          wifi_name: accessRow?.wifi_name ?? null,
          wifi_password: accessRow?.wifi_password ?? null,
          parking_info: accessRow?.parking_info ?? null,
          lockbox_code: accessRow?.lockbox_code ?? null,
        },
        host: host ? { full_name: host.full_name, phone: null } : null,
      });
      setLoading(false);
    };
    load();
  }, [open, bookingId]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    toast({ title: t('trip.copied'), description: t('trip.copied_desc', { label }) });
    setTimeout(() => setCopied(null), 1500);
  };

  if (!data && !loading) return null;

  const depositPaid = data?.payment_status === "paid";
  const checkInDate = data ? new Date(data.check_in_date) : null;
  const now = new Date();
  const daysUntilCheckIn = checkInDate ? differenceInDays(checkInDate, now) : 0;
  const hoursUntilCheckIn = checkInDate ? differenceInHours(checkInDate, now) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> {t('trip.title')}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('trip.loading')}</div>
        ) : (
          <div className="space-y-5">
            {/* Hero */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <h3 className="font-semibold text-lg">{data.property.title}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" /> {data.property.city}, {data.property.governorate}
              </p>
              {checkInDate && now < checkInDate && (
                <Badge variant="outline" className="mt-2">
                  {daysUntilCheckIn > 1
                    ? t('trip.days_until', { count: daysUntilCheckIn })
                    : hoursUntilCheckIn > 0
                    ? t('trip.hours_until', { count: hoursUntilCheckIn })
                    : t('trip.checkin_today')}
                </Badge>
              )}
            </div>

            {/* Dates & guests */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t('trip.checkin')}</p>
                <p className="font-semibold">{format(new Date(data.check_in_date), "EEE, MMM d")}</p>
                {data.property.check_in_time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {t('trip.from_time', { time: data.property.check_in_time.slice(0, 5) })}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">{t('trip.checkout')}</p>
                <p className="font-semibold">{format(new Date(data.check_out_date), "EEE, MMM d")}</p>
                {data.property.check_out_time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {t('trip.by_time', { time: data.property.check_out_time.slice(0, 5) })}
                  </p>
                )}
              </div>
            </div>

            {/* Welcome message */}
            {data.property.welcome_message && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('trip.message_from_host')}</p>
                <p className="text-sm italic">"{data.property.welcome_message}"</p>
              </div>
            )}

            {/* Arrival kit (gated) */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-primary" /> {t('trip.arrival_kit')}
              </h4>

              {!depositPaid ? (
                <div className="p-4 rounded-lg border bg-muted/30 text-center">
                  <Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('trip.locked_desc')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.property.address && (
                    <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">{t('trip.address')}</p>
                        <p className="text-sm font-medium break-words">{data.property.address}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => copy(t('trip.address'), data.property.address!)}
                      >
                        {copied === t('trip.address') ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}

                  {data.property.google_maps_url && (
                    <a
                      href={data.property.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{t('trip.open_in_maps')}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                  )}

                  {(data.property.wifi_name || data.property.wifi_password) && (
                    <div className="p-2.5 rounded-lg border space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> {t('trip.wifi')}
                      </p>
                      {data.property.wifi_name && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{t('trip.network')}: <strong>{data.property.wifi_name}</strong></span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy("WiFi name", data.property.wifi_name!)}>
                            {copied === "WiFi name" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      )}
                      {data.property.wifi_password && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{t('trip.password')}: <strong className="font-mono">{data.property.wifi_password}</strong></span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy("WiFi password", data.property.wifi_password!)}>
                            {copied === "WiFi password" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {data.property.lockbox_code && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/30">
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> {t('trip.lockbox')}</p>
                        <p className="text-sm font-mono font-bold tracking-wider">{data.property.lockbox_code}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy("Lockbox code", data.property.lockbox_code!)}>
                        {copied === "Lockbox code" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}

                  {data.property.parking_info && (
                    <div className="p-2.5 rounded-lg border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {t('trip.parking')}</p>
                      <p className="text-sm">{data.property.parking_info}</p>
                    </div>
                  )}

                  {data.property.arrival_instructions && (
                    <div className="p-2.5 rounded-lg border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Info className="w-3.5 h-3.5" /> {t('trip.arrival_instructions')}</p>
                      <p className="text-sm whitespace-pre-line">{data.property.arrival_instructions}</p>
                    </div>
                  )}

                  {!data.property.arrival_instructions &&
                    !data.property.wifi_name &&
                    !data.property.lockbox_code &&
                    !data.property.parking_info && (
                      <p className="text-xs text-muted-foreground italic">{t('trip.no_arrival_yet')}</p>
                    )}
                </div>
              )}
            </div>

            {/* House rules */}
            {data.property.house_rules && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> {t('trip.house_rules')}
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{data.property.house_rules}</p>
                </div>
              </>
            )}

            {/* Host */}
            {data.host && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('trip.host_label')}</p>
                    <p className="font-medium">{data.host.full_name || t('trip.host_default')}</p>
                  </div>
                  {onMessageHost && (
                    <Button variant="outline" size="sm" onClick={onMessageHost}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> {t('trip.message_btn')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TripItineraryDialog;
