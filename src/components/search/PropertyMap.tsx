import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";

type Property = Tables<"properties">;

interface PropertyMapProps {
  properties: Property[];
}

// Custom price-pin icon factory
const createPriceIcon = (label: string) =>
  L.divIcon({
    className: "samsari-price-pin",
    html: `<div style="
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      padding: 6px 10px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      border: 2px solid white;
    ">${label}</div>`,
    iconSize: [60, 28],
    iconAnchor: [30, 14],
  });

// Tunisia fallback center
const TUNISIA_CENTER: [number, number] = [34.0, 9.0];

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points, map]);
  return null;
};

const getPropertyImage = (photos: any) => {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return "/placeholder.svg";
  const exterior = photos.find((p: any) => p?.type === "exterior" && p?.url);
  if (exterior?.url) return exterior.url;
  return photos[0]?.url || "/placeholder.svg";
};

const PropertyMap = ({ properties }: PropertyMapProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const mapped = useMemo(
    () =>
      properties
        .map((p) => {
          const c = p.coordinates as { lat?: number; lng?: number } | null;
          if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") return null;
          return { property: p, lat: c.lat, lng: c.lng };
        })
        .filter((x): x is { property: Property; lat: number; lng: number } => x !== null),
    [properties]
  );

  const points = useMemo<[number, number][]>(
    () => mapped.map((m) => [m.lat, m.lng]),
    [mapped]
  );

  if (mapped.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground">
          No properties with map locations available. Try the list view or adjust filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
      <MapContainer
        center={TUNISIA_CENTER}
        zoom={7}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {mapped.map(({ property, lat, lng }) => (
          <Marker
            key={property.id}
            position={[lat, lng]}
            icon={createPriceIcon(formatPrice(property.price_per_night))}
          >
            <Popup>
              <div className="w-56">
                <img
                  src={getPropertyImage(property.photos)}
                  alt={property.title}
                  className="w-full h-28 object-cover rounded mb-2"
                />
                <h4 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                  {property.title}
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  {property.city}, {property.governorate}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary text-sm">
                    {formatPrice(property.price_per_night)}
                    <span className="text-xs font-normal text-muted-foreground"> /night</span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/p/${(property as any).short_code || property.id}`)
                    }
                  >
                    View
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default PropertyMap;
