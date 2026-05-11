import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Phone, Shield, CheckCircle, Globe, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, DEFAULT_COUNTRY_ISO, findCountryByIso } from "@/lib/countries";

// Per-country format patterns (groups of digits separated by spaces).
// Falls back to default 3-3-3-3 grouping for unlisted countries.
const PHONE_FORMATS: Record<string, number[]> = {
  TN: [2, 3, 3],       // 93 067 954
  US: [3, 3, 4],       // 415 555 1234
  CA: [3, 3, 4],
  GB: [4, 3, 4],       // 7700 900 123
  FR: [1, 2, 2, 2, 2], // 6 12 34 56 78
  DE: [4, 7],
  ES: [3, 3, 3],
  IT: [3, 3, 4],
  MA: [3, 3, 3],
  DZ: [3, 2, 2, 2],
  EG: [3, 3, 4],
  AE: [2, 3, 4],
  SA: [3, 3, 4],
};

const formatPhone = (iso: string, digits: string) => {
  const groups = PHONE_FORMATS[iso] || [3, 3, 3, 3];
  const parts: string[] = [];
  let i = 0;
  for (const len of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + len));
    i += len;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(" ");
};

const getPhonePlaceholder = (iso: string) => {
  const groups = PHONE_FORMATS[iso] || [3, 3, 3, 3];
  return groups.map((len) => "x".repeat(len)).join(" ");
};

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

const ProfileCompletionGuard = ({ children }: ProfileCompletionGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [needsCompletion, setNeedsCompletion] = useState(false);
  const [phone, setPhone] = useState("");
  const [countryIso, setCountryIso] = useState<string>(DEFAULT_COUNTRY_ISO);
  const [countryOpen, setCountryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Auto-detect country when user types a +code prefix (e.g. "+1" → US),
  // then format the remaining digits per country pattern.
  const handlePhoneChange = (value: string) => {
    let iso = countryIso;
    let digits = value.replace(/\D/g, "");

    if (value.trim().startsWith("+") && digits.length > 0) {
      for (let len = Math.min(4, digits.length); len >= 1; len--) {
        const code = parseInt(digits.slice(0, len), 10);
        const match = COUNTRIES.find((c) => c.phonecode === code);
        if (match) {
          iso = match.iso;
          digits = digits.slice(len);
          setCountryIso(match.iso);
          break;
        }
      }
    }

    setPhone(formatPhone(iso, digits));
    setPhoneError(null);
  };

  // Re-format the input whenever the user changes country via the picker
  useEffect(() => {
    setPhone((prev) => formatPhone(countryIso, prev.replace(/\D/g, "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryIso]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    checkProfileCompletion();
  }, [user, authLoading]);

  const checkProfileCompletion = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        // Fail open on read errors — never trap a user behind the completion screen
        // because of a transient read failure.
        console.error("Error checking profile (failing open):", error);
        setNeedsCompletion(false);
        return;
      }

      // Only prompt when we positively know the phone is empty.
      // No row yet (very fresh signup) → also prompt so the user can complete it.
      if (!data) {
        setNeedsCompletion(true);
      } else {
        const hasPhone = typeof data.phone === "string" && data.phone.trim().length > 0;
        setNeedsCompletion(!hasPhone);
      }
    } catch (error) {
      console.error("Error checking profile completion (failing open):", error);
      setNeedsCompletion(false);
    } finally {
      setChecking(false);
    }
  };

  const handleSavePhone = async () => {
    if (!user) return;

    const country = findCountryByIso(countryIso);
    const codeStr = String(country.phonecode);

    // Strip non-digits, then strip the country code prefix if user typed it
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith(codeStr)) {
      digits = digits.slice(codeStr.length);
    }

    if (digits.length < 4 || digits.length > 15) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number (4–15 digits).",
        variant: "destructive"
      });
      return;
    }

    const trimmedPhone = `+${codeStr} ${digits}`;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          phone: trimmedPhone,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) {
        const isDuplicate = (error as any).code === '23505' || /idx_profiles_phone_unique|duplicate key/i.test(error.message || '');
        if (isDuplicate) {
          setPhoneError("Phone number already exists");
        }
        toast({
          title: isDuplicate ? "Phone number already in use" : "Error",
          description: isDuplicate
            ? "This number is linked to another account. Please use a different number or contact support."
            : "Failed to save phone number. Please try again.",
          variant: "destructive"
        });
        console.error("Error saving phone:", error);
      } else {
        toast({
          title: "Profile completed!",
          description: "You can now explore Samsari",
        });
        setNeedsCompletion(false);
      }
    } catch (error) {
      console.error("Error saving phone:", error);
      toast({
        title: "Error",
        description: "Failed to save phone number",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (checking || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not logged in or profile is complete, render children
  if (!user || !needsCompletion) {
    return <>{children}</>;
  }

  // Show profile completion screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription className="text-base">
            Please add your phone number to continue. This helps us verify your identity and keep Samsari safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="country" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Country <span className="text-destructive">*</span>
            </Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="country"
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <img
                      src={`https://flagcdn.com/w40/${countryIso.toLowerCase()}.png`}
                      alt=""
                      className="h-4 w-6 object-cover rounded-sm"
                      loading="lazy"
                    />
                    <span className="truncate">{findCountryByIso(countryIso).name}</span>
                    <span className="text-muted-foreground">(+{findCountryByIso(countryIso).phonecode})</span>
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    // value is "{name} +{code} {iso}" — match name start, name contains, or dial code
                    const v = value.toLowerCase();
                    const s = search.toLowerCase().trim();
                    if (!s) return 1;
                    if (v.startsWith(s)) return 1;
                    if (v.includes(` ${s}`)) return 0.8;
                    if (v.includes(s)) return 0.5;
                    return 0;
                  }}
                >
                  <CommandInput placeholder="Search country or dial code..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {COUNTRIES.map((c) => (
                        <CommandItem
                          key={c.iso}
                          value={`${c.name} +${c.phonecode} ${c.iso}`}
                          onSelect={() => {
                            setCountryIso(c.iso);
                            setCountryOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", countryIso === c.iso ? "opacity-100" : "opacity-0")} />
                          <img
                            src={`https://flagcdn.com/w40/${c.iso.toLowerCase()}.png`}
                            alt=""
                            className="h-4 w-6 object-cover rounded-sm mr-2"
                            loading="lazy"
                          />
                          <span>{c.name}</span>
                          <span className="ml-auto text-muted-foreground">+{c.phonecode}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 rounded-md border border-input bg-muted text-sm font-medium">
                <img
                  src={`https://flagcdn.com/w40/${countryIso.toLowerCase()}.png`}
                  alt=""
                  className="h-4 w-6 object-cover rounded-sm"
                  loading="lazy"
                />
                <span>+{findCountryByIso(countryIso).phonecode}</span>
              </div>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                inputMode="tel"
                placeholder={getPhonePlaceholder(countryIso)}
                className={cn("text-lg flex-1", phoneError && "border-destructive focus-visible:ring-destructive")}
                autoFocus
              />
            </div>
            {phoneError && (
              <p className="text-xs text-destructive font-medium">{phoneError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter your phone number. The country code is added automatically.
            </p>
          </div>

          <Button 
            onClick={handleSavePhone} 
            disabled={saving || !phone.trim()} 
            className="w-full"
            size="lg"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Continue to Samsari
              </>
            )}
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="/terms" className="underline hover:text-primary">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileCompletionGuard;
