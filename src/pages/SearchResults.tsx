import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, Bed, Bath, Star, Filter, Search, X, Map as MapIcon, List as ListIcon } from "lucide-react";
import PropertyMap from "@/components/search/PropertyMap";
import PropertyMapMapbox from "@/components/search/PropertyMapMapbox";
import { MAPBOX_STYLES, type MapboxStyleKey } from "@/lib/mapboxConfig";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { tunisianCities, getGovernoratesByCity } from "@/components/TunisianCities";
import { useCurrency } from "@/hooks/useCurrency";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useLanguage } from "@/contexts/LanguageContext";
import SavedSearchesPanel from "@/components/search/SavedSearchesPanel";
import { applyPublicPropertyFilter } from "@/lib/propertyVisibility";
import VerifiedBadge from "@/components/VerifiedBadge";
import SuperhostBadge from "@/components/SuperhostBadge";

type Property = Tables<"properties">;

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice, preferredCurrency } = useCurrency();
  const { t } = useLanguage();
  const governorateParam = searchParams.get("governorate") || "";
  const locationParam = searchParams.get("city") || searchParams.get("location") || "";
  const locationLabel = locationParam || governorateParam;
  
  const seoTitle = locationLabel
    ? `Rent in ${locationLabel}, Tunisia – Vacation Rentals | Samsari`
    : 'Search Properties in Tunisia – Vacation Rentals | Samsari';
  const seoDescription = locationLabel
    ? `Find verified vacation rentals in ${locationLabel}, Tunisia. Browse houses, apartments & villas with secure escrow payments. Location ${locationLabel} Tunisie.`
    : 'Browse verified vacation rentals across Tunisia. Filter by city, price, and dates. Secure booking with escrow protection.';
  const seoKeywords = locationLabel
    ? `rent apartment in ${locationLabel}, short-term rental ${locationLabel} Tunisia, vacation home ${locationLabel}, house for rent in ${locationLabel}, location courte durée ${locationLabel}, appartement à louer ${locationLabel}`
    : 'rent apartment in Tunisia, short-term rental Tunisia, vacation homes Tunisia, search properties Tunisia';
  
  // Canonical: include governorate/city for indexable location pages, strip transient params
  const canonicalSearch = new URLSearchParams();
  if (governorateParam) canonicalSearch.set('governorate', governorateParam);
  if (locationParam) canonicalSearch.set('city', locationParam);
  const canonicalPath = canonicalSearch.toString() ? `/search?${canonicalSearch.toString()}` : '/search';

  // JSON-LD built after properties load (passed to usePageSEO below)
  const searchJsonLd = locationLabel ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Vacation Rentals in ${locationLabel}, Tunisia`,
    "description": seoDescription,
    "url": `https://samsari.tech${canonicalPath}`,
  } : undefined;

  const searchBreadcrumbs = [
    { name: 'Home', url: 'https://samsari.tech/' },
    { name: 'Search', url: 'https://samsari.tech/search' },
    ...(locationLabel ? [{ name: locationLabel, url: `https://samsari.tech${canonicalPath}` }] : []),
  ];

  const [noIndexMeta, setNoIndexMeta] = useState(false);

  usePageSEO({
    title: seoTitle,
    description: seoDescription,
    canonicalPath,
    keywords: seoKeywords,
    jsonLd: searchJsonLd,
    breadcrumbs: searchBreadcrumbs,
  });

  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"][data-search-noindex]') as HTMLMetaElement | null;
    if (noIndexMeta) {
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'robots';
        metaTag.setAttribute('data-search-noindex', 'true');
        document.head.appendChild(metaTag);
      }
      metaTag.content = 'noindex, follow';
    } else if (metaTag) {
      metaTag.remove();
    }
    return () => { metaTag?.remove(); };
  }, [noIndexMeta]);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyRatings, setPropertyRatings] = useState<Map<string, number>>(new Map());
  const [verifiedHostIds, setVerifiedHostIds] = useState<Set<string>>(new Set());
  const [superhostIds, setSuperhostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapProvider, setMapProvider] = useState<"leaflet" | "mapbox">("mapbox");
  const [mapboxStyle, setMapboxStyle] = useState<MapboxStyleKey>("streets");
  
  // Initialize filters from URL params with consistent naming
  const [filters, setFilters] = useState({
    city: searchParams.get("city") || searchParams.get("location") || "",
    governorate: searchParams.get("governorate") || "",
    location: searchParams.get("location") || searchParams.get("city") || "",
    guests: parseInt(searchParams.get("guests") || "1"),
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
    priceRange: [0, 1000] as number[],
    propertyType: "" as string,
    bedrooms: 0,
    bathrooms: 0,
    amenities: [] as string[],
    instantBook: false,
    verifiedHostOnly: false,
    minRating: 0,
  });

  useEffect(() => {
    // Update filters when URL changes, prioritizing 'city' over 'location'
    setFilters(prev => ({
      ...prev,
      city: searchParams.get("city") || searchParams.get("location") || "",
      governorate: searchParams.get("governorate") || "",
      location: searchParams.get("location") || searchParams.get("city") || "",
      guests: parseInt(searchParams.get("guests") || "1"),
      checkIn: searchParams.get("checkIn") || "",
      checkOut: searchParams.get("checkOut") || "",
    }));
    
    fetchProperties();
  }, [searchParams]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      let query = applyPublicPropertyFilter(
        supabase.from("properties").select("*")
      );

      // Apply filters from URL params
      const city = searchParams.get("city") || searchParams.get("location");
      const governorate = searchParams.get("governorate");
      const location = searchParams.get("location") || searchParams.get("city");
      const guests = searchParams.get("guests");
      const checkIn = searchParams.get("checkIn");
      const checkOut = searchParams.get("checkOut");

      if (city) {
        query = query.ilike("city", `%${city}%`);
      }
      if (governorate) {
        query = query.eq("governorate", governorate);
      }
      if (location && !city) {
        query = query.or(`city.ilike.%${location}%,governorate.ilike.%${location}%`);
      }
      if (guests) {
        query = query.gte("max_guests", parseInt(guests));
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching properties:", error);
        toast({
          title: "Error",
          description: "Failed to fetch properties",
          variant: "destructive"
        });
        return;
      }

      // Filter by date availability if both dates are provided
      if (checkIn && checkOut && data && data.length > 0) {
        const propertyIds = data.map(p => p.id);
        
        // Query bookings that overlap with the requested date range
        // A booking overlaps if: booking.check_in < requested.check_out AND booking.check_out > requested.check_in
        const { data: conflictingBookings, error: bookingsError } = await supabase
          .from("bookings")
          .select("property_id")
          .in("property_id", propertyIds)
          .not("status", "in", '("cancelled_by_guest","cancelled_by_host","declined","refunded","cancelled_by_system")')
          .lt("check_in_date", checkOut)  // booking starts before requested checkout
          .gt("check_out_date", checkIn); // booking ends after requested checkin
        
        if (bookingsError) {
          console.error("Error checking availability:", bookingsError);
          setProperties(data);
        } else {
          // Get set of unavailable property IDs
          const unavailablePropertyIds = new Set(
            conflictingBookings?.map(b => b.property_id) || []
          );
          
          // Filter out properties that have conflicting bookings
          const availableProperties = data.filter(
            property => !unavailablePropertyIds.has(property.id)
          );
          
          setProperties(availableProperties);
        }
      } else {
        setProperties(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An error occurred while fetching properties",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Enrich with ratings + verified host info whenever properties change
  useEffect(() => {
    const enrich = async () => {
      if (properties.length === 0) {
        setPropertyRatings(new Map());
        setVerifiedHostIds(new Set());
        setSuperhostIds(new Set());
        return;
      }
      const propIds = properties.map((p) => p.id);
      const hostIds = Array.from(new Set(properties.map((p) => p.host_id)));

      const [{ data: reviews }, { data: hosts }] = await Promise.all([
        supabase.from("reviews").select("property_id, rating").in("property_id", propIds).eq("status", "approved"),
        supabase.from("profiles").select("id, verification_status, is_superhost").in("id", hostIds),
      ]);

      const sums = new Map<string, { sum: number; n: number }>();
      (reviews || []).forEach((r: any) => {
        const cur = sums.get(r.property_id) || { sum: 0, n: 0 };
        cur.sum += r.rating; cur.n += 1;
        sums.set(r.property_id, cur);
      });
      const avgs = new Map<string, number>();
      sums.forEach((v, k) => avgs.set(k, v.sum / v.n));
      setPropertyRatings(avgs);

      setVerifiedHostIds(new Set((hosts || []).filter((h: any) => h.verification_status === "verified").map((h: any) => h.id)));
      setSuperhostIds(new Set((hosts || []).filter((h: any) => h.is_superhost === true).map((h: any) => h.id)));
    };
    enrich();
  }, [properties]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (filters.city) params.set("city", filters.city);
    if (filters.governorate) params.set("governorate", filters.governorate);
    if (filters.location) params.set("location", filters.location);
    if (filters.guests > 1) params.set("guests", filters.guests.toString());
    if (filters.checkIn) params.set("checkIn", filters.checkIn);
    if (filters.checkOut) params.set("checkOut", filters.checkOut);
    
    setSearchParams(params);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      city: "",
      governorate: "",
      location: "",
      guests: 1,
      checkIn: "",
      checkOut: "",
      priceRange: [0, 1000],
      propertyType: "",
      bedrooms: 0,
      bathrooms: 0,
      amenities: [],
      instantBook: false,
      verifiedHostOnly: false,
      minRating: 0,
    });
    navigate("/search");
  };

  const toggleAmenity = (a: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };

  const getPropertyImage = (photos: any) => {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return "/placeholder.svg";
    
    // First try to find an exterior photo
    const exteriorPhoto = photos.find((p: any) => 
      p && typeof p === 'object' && p.type === 'exterior' && p.url
    );
    
    // If found, return its URL
    if (exteriorPhoto && typeof exteriorPhoto === 'object' && exteriorPhoto.url) {
      return exteriorPhoto.url;
    }
    
    // Otherwise, safely get the first photo's URL
    const firstPhoto = photos[0];
    return (firstPhoto && typeof firstPhoto === 'object' && firstPhoto.url) ? firstPhoto.url : "/placeholder.svg";
  };

  // Filter properties based on additional UI filters
  const filteredProperties = properties.filter(property => {
    if (filters.priceRange[0] > 0 && property.price_per_night < filters.priceRange[0]) return false;
    if (filters.priceRange[1] < 1000 && property.price_per_night > filters.priceRange[1]) return false;
    if (filters.propertyType && property.property_type !== filters.propertyType) return false;
    if (filters.bedrooms > 0 && (property.bedrooms || 0) < filters.bedrooms) return false;
    if (filters.bathrooms > 0 && (property.bathrooms || 0) < filters.bathrooms) return false;
    if (filters.amenities.length > 0) {
      const propAmenities: string[] = Array.isArray(property.amenities) ? (property.amenities as any).map((a: any) => typeof a === "string" ? a : a?.name).filter(Boolean) : [];
      const hasAll = filters.amenities.every((a) => propAmenities.includes(a));
      if (!hasAll) return false;
    }
    if (filters.instantBook && !property.booking_enabled) return false;
    if (filters.verifiedHostOnly && !verifiedHostIds.has(property.host_id)) return false;
    if (filters.minRating > 0) {
      const r = propertyRatings.get(property.id) || 0;
      if (r < filters.minRating) return false;
    }
    return true;
  });

  // Update noindex flag when results change
  useEffect(() => {
    if (!loading) {
      setNoIndexMeta(filteredProperties.length === 0);
    }
  }, [loading, filteredProperties.length]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('search_results.loading')}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:w-1/4 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    {t('search_results.filters')}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('search_results.clear')}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Location</Label>
                  <Input
                    placeholder="Search cities or governorates..."
                    value={filters.location}
                    onChange={(e) => setFilters({...filters, location: e.target.value, city: e.target.value})}
                  />
                </div>

                <div>
                  <Label>City</Label>
                  <Select 
                    value={filters.city} 
                    onValueChange={(value) => setFilters({...filters, city: value, location: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {tunisianCities.flatMap(gov => 
                        gov.cities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Governorate</Label>
                  <Select value={filters.governorate} onValueChange={(value) => setFilters({...filters, governorate: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select governorate" />
                    </SelectTrigger>
                    <SelectContent>
                      {tunisianCities.map(gov => (
                        <SelectItem key={gov.governorate} value={gov.governorate}>{gov.governorate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Guests</Label>
                  <Input
                    type="number"
                    min="1"
                    value={filters.guests}
                    onChange={(e) => setFilters({...filters, guests: parseInt(e.target.value) || 1})}
                  />
                </div>

                <div>
                  <Label>Price Range ({preferredCurrency})</Label>
                  <Slider
                    value={filters.priceRange}
                    onValueChange={(value) => setFilters({...filters, priceRange: value})}
                    max={1000}
                    step={10}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>{formatPrice(filters.priceRange[0])}</span>
                    <span>{formatPrice(filters.priceRange[1])}</span>
                  </div>
                </div>

                <div>
                  <Label>Property Type</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { v: "", l: "Any" },
                      { v: "apartment", l: "Apartment" },
                      { v: "house", l: "House" },
                      { v: "villa", l: "Villa" },
                      { v: "studio", l: "Studio" },
                    ].map((opt) => (
                      <button
                        key={opt.v || "any"}
                        type="button"
                        onClick={() => setFilters({ ...filters, propertyType: opt.v })}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${
                          filters.propertyType === opt.v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-accent"
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Bedrooms (min)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setFilters({ ...filters, bedrooms: Math.max(0, filters.bedrooms - 1) })}>−</Button>
                    <span className="w-10 text-center text-sm font-medium">{filters.bedrooms === 0 ? "Any" : `${filters.bedrooms}+`}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setFilters({ ...filters, bedrooms: Math.min(10, filters.bedrooms + 1) })}>+</Button>
                  </div>
                </div>

                <div>
                  <Label>Bathrooms (min)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setFilters({ ...filters, bathrooms: Math.max(0, filters.bathrooms - 1) })}>−</Button>
                    <span className="w-10 text-center text-sm font-medium">{filters.bathrooms === 0 ? "Any" : `${filters.bathrooms}+`}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setFilters({ ...filters, bathrooms: Math.min(10, filters.bathrooms + 1) })}>+</Button>
                  </div>
                </div>

                <div>
                  <Label>Amenities</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["WiFi", "Pool", "Air Conditioning", "Kitchen", "Parking", "Washer", "TV", "Heating", "Workspace", "Beach Access"].map((a) => {
                      const active = filters.amenities.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleAmenity(a)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition ${
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instant-book" className="text-sm font-normal cursor-pointer">⚡ Instant Book</Label>
                    <input
                      id="instant-book"
                      type="checkbox"
                      checked={filters.instantBook}
                      onChange={(e) => setFilters({ ...filters, instantBook: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="verified-host" className="text-sm font-normal cursor-pointer">✓ Verified host only</Label>
                    <input
                      id="verified-host"
                      type="checkbox"
                      checked={filters.verifiedHostOnly}
                      onChange={(e) => setFilters({ ...filters, verifiedHostOnly: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                  </div>
                </div>

                <div>
                  <Label>Minimum rating</Label>
                  <div className="flex gap-1 mt-2">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFilters({ ...filters, minRating: r })}
                        className={`flex-1 px-2 py-1.5 rounded text-xs border transition ${
                          filters.minRating === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                        }`}
                      >
                        {r === 0 ? "Any" : `${r}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Check-in Date</Label>
                  <Input
                    type="date"
                    value={filters.checkIn}
                    onChange={(e) => setFilters({...filters, checkIn: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Check-out Date</Label>
                  <Input
                    type="date"
                    value={filters.checkOut}
                    onChange={(e) => setFilters({...filters, checkOut: e.target.value})}
                    min={filters.checkIn || new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>

                <Button onClick={applyFilters} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  {t('search_results.apply_filters')}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">
                {filteredProperties.length} {t('search_results.properties_found')}
                {(searchParams.get("city") || searchParams.get("location")) && 
                  ` ${t('search_results.in')} ${searchParams.get("city") || searchParams.get("location")}`}
              </h1>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className="h-8"
                  >
                    <ListIcon className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button
                    variant={viewMode === "map" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("map")}
                    aria-label="Map view"
                    className="h-8"
                  >
                    <MapIcon className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Map</span>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {t('search_results.filters')}
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <SavedSearchesPanel currentFilters={filters} />
            </div>

            {viewMode === "map" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border bg-background p-0.5">
                    <Button
                      variant={mapProvider === "mapbox" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMapProvider("mapbox")}
                      className="h-8"
                    >
                      Mapbox
                    </Button>
                    <Button
                      variant={mapProvider === "leaflet" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setMapProvider("leaflet")}
                      className="h-8"
                    >
                      OpenStreetMap
                    </Button>
                  </div>
                  {mapProvider === "mapbox" && (
                    <Select value={mapboxStyle} onValueChange={(v) => setMapboxStyle(v as MapboxStyleKey)}>
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="streets">Streets</SelectItem>
                        <SelectItem value="satellite">Satellite</SelectItem>
                        <SelectItem value="outdoors">Outdoors</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {mapProvider === "mapbox" ? (
                  <PropertyMapMapbox
                    properties={filteredProperties}
                    styleUrl={MAPBOX_STYLES[mapboxStyle]}
                  />
                ) : (
                  <PropertyMap properties={filteredProperties} />
                )}
              </div>
            ) : filteredProperties.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">{t('search_results.no_results')}</p>
                  <Button variant="outline" onClick={clearFilters} className="mt-4">
                    {t('search_results.clear_filters')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {filteredProperties.map((property) => (
                  <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <img
                          src={getPropertyImage(property.photos)}
                          alt={property.title}
                          loading="lazy"
                          decoding="async"
                          width={400}
                          height={300}
                          className="w-full h-48 md:h-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-100 text-green-800">
                            Available
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold">{property.title}</h3>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {formatPrice(property.price_per_night)}
                            </p>
                            <p className="text-sm text-muted-foreground">{t('search_results.per_night')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <MapPin className="h-4 w-4" />
                          <span>{property.city}, {property.governorate}</span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {property.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{property.max_guests} guests</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bed className="h-4 w-4" />
                            <span>{property.bedrooms} bedrooms</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bath className="h-4 w-4" />
                            <span>{property.bathrooms} bathrooms</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{property.property_type}</Badge>
                            {property.amenities && Array.isArray(property.amenities) && property.amenities.length > 0 && (
                              <Badge variant="outline">
                                +{property.amenities.length} amenities
                              </Badge>
                            )}
                            {(property as any).is_verified && (
                              <VerifiedBadge size="xs" tooltip="Verified property by Samsari" />
                            )}
                            {verifiedHostIds.has(property.host_id) && (
                              <VerifiedBadge size="xs" tooltip="Hosted by a verified host" />
                            )}
                            {superhostIds.has(property.host_id) && (
                              <SuperhostBadge size="xs" />
                            )}
                          </div>
                          <Button onClick={() => navigate(`/p/${(property as any).short_code || property.id}`)}>
                            {t('search_results.view_details')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SearchResults;
