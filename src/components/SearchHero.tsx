
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SearchAutocomplete, { type AutocompleteSelection } from "@/components/search/SearchAutocomplete";
import { recordSearch } from "@/hooks/useSearchHistory";

const SearchHero = () => {
  const [locationText, setLocationText] = useState("");
  const [selection, setSelection] = useState<AutocompleteSelection | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSelect = (sel: AutocompleteSelection) => {
    setSelection(sel);
    if (sel.type === "property" && sel.propertyId) {
      navigate(`/property/${sel.propertyId}`);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selection?.governorate) params.set("governorate", selection.governorate);
    if (selection?.city) {
      params.set("city", selection.city);
      params.set("location", selection.city);
    } else if (!selection && locationText.trim()) {
      params.set("location", locationText.trim());
    }
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests.toString());

    // fire-and-forget
    recordSearch({
      governorate: selection?.governorate,
      city: selection?.city,
      num_guests: guests,
      check_in: checkIn || undefined,
      check_out: checkOut || undefined,
    });

    navigate(`/search?${params.toString()}`);
  };

  return (
    <section className="relative min-h-[90vh] flex items-center bg-gradient-to-b from-primary/[0.03] via-background to-background overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-[10%] w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-[5%] w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-6 relative z-10 py-24 md:py-32">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2 rounded-full mb-8 animate-scale-in">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wide uppercase">{t('hero.escrow_protected')}</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold text-foreground mb-8 leading-[1.08] tracking-tight">
            {t('hero.title')}{' '}
            <span className="text-primary relative inline-block">
              {t('hero.subtitle')}
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C50 2 150 2 198 6" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" className="animate-scale-in" style={{ animationDelay: '0.5s' }} />
              </svg>
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('hero.description')}
          </p>
        </div>

        <Card className="max-w-7xl mx-auto border border-border/60 bg-card shadow-2xl shadow-primary/[0.04] animate-fade-in">
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="lg:col-span-2">
                <label htmlFor="location-search" className="block text-xs font-semibold mb-1.5 text-foreground/70 uppercase tracking-wide">
                  Where to?
                </label>
                <SearchAutocomplete
                  id="location-search"
                  value={locationText}
                  onChange={(v) => {
                    setLocationText(v);
                    if (selection) setSelection(null);
                  }}
                  onSelect={handleSelect}
                  placeholder="City, region or property name"
                />
              </div>

              <div>
                <label htmlFor="checkin-date" className="block text-xs font-semibold mb-1.5 text-foreground/70 uppercase tracking-wide">
                  {t('search.checkin')}
                </label>
                <Input
                  id="checkin-date"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-11 bg-muted/40 border-border/50 hover:border-primary/30 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="checkout-date" className="block text-xs font-semibold mb-1.5 text-foreground/70 uppercase tracking-wide">
                  {t('search.checkout')}
                </label>
                <Input
                  id="checkout-date"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn || new Date().toISOString().split('T')[0]}
                  className="h-11 bg-muted/40 border-border/50 hover:border-primary/30 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div>
                <label htmlFor="guests-count" className="block text-xs font-semibold mb-1.5 text-foreground/70 uppercase tracking-wide">
                  {t('booking.guests')}
                </label>
                <Input
                  id="guests-count"
                  type="number"
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                  min="1"
                  max="16"
                  className="h-11 bg-muted/40 border-border/50 hover:border-primary/30 transition-colors"
                />
              </div>
            </div>

            <Button
              onClick={handleSearch}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
              size="lg"
            >
              <Search className="w-5 h-5 mr-2" />
              {t('search.search')}
            </Button>
          </CardContent>
        </Card>

        <div className="max-w-7xl mx-auto mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={() => navigate('/search')}
            className="w-full group flex items-center justify-center gap-3 py-4 px-6 rounded-xl border border-dashed border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-all duration-300"
          >
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Not sure where to go?</span>
            <span className="text-sm font-semibold text-primary flex items-center gap-1">
              Browse All Properties
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-8 mt-10 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-trust rounded-full" />
            {t('hero.trust_secure_payment')}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            {t('hero.trust_insurance')}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchHero;
