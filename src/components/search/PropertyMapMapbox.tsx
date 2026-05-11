import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { MAPBOX_PUBLIC_TOKEN } from "@/lib/mapboxConfig";

type Property = Tables<"properties">;

interface PropertyMapMapboxProps {
  properties: Property[];
  styleUrl?: string;
}

const TUNISIA_CENTER: [number, number] = [9.0, 34.0]; // [lng, lat] for mapbox

const getPropertyImage = (photos: any) => {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return "/placeholder.svg";
  const exterior = photos.find((p: any) => p?.type === "exterior" && p?.url);
  if (exterior?.url) return exterior.url;
  return photos[0]?.url || "/placeholder.svg";
};

const PropertyMapMapbox = ({
  properties,
  styleUrl = "mapbox://styles/mapbox/streets-v12",
}: PropertyMapMapboxProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [styleLoaded, setStyleLoaded] = useState(false);

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

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_PUBLIC_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: TUNISIA_CENTER,
      zoom: 5.5,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setStyleLoaded(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // Update style when toggled
  useEffect(() => {
    if (mapRef.current) {
      setStyleLoaded(false);
      mapRef.current.setStyle(styleUrl);
      mapRef.current.once("styledata", () => setStyleLoaded(true));
    }
  }, [styleUrl]);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (mapped.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    mapped.forEach(({ property, lat, lng }) => {
      const el = document.createElement("div");
      el.style.cssText = `
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 6px 10px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 12px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        border: 2px solid white;
        cursor: pointer;
      `;
      el.textContent = formatPrice(property.price_per_night);

      const popupNode = document.createElement("div");
      popupNode.style.width = "224px";
      popupNode.innerHTML = `
        <img src="${getPropertyImage(property.photos)}" alt="${property.title.replace(/"/g, "&quot;")}" style="width:100%;height:112px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />
        <h4 style="font-weight:600;font-size:14px;line-height:1.2;margin:0 0 4px;">${property.title}</h4>
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">${property.city}, ${property.governorate}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:700;color:hsl(var(--primary));font-size:14px;">${formatPrice(property.price_per_night)}<span style="font-weight:400;color:#6b7280;font-size:12px;"> /night</span></span>
          <button id="view-${property.id}" style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:0;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">View</button>
        </div>
      `;
      popupNode.querySelector(`#view-${property.id}`)?.addEventListener("click", () => {
        navigate(`/p/${(property as any).short_code || property.id}`);
      });

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true }).setDOMContent(popupNode);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([lng, lat]);
    });

    if (mapped.length === 1) {
      map.flyTo({ center: [mapped[0].lng, mapped[0].lat], zoom: 13, duration: 800 });
    } else {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
    }
  }, [mapped, styleLoaded, formatPrice, navigate]);

  if (!MAPBOX_PUBLIC_TOKEN) {
    return (
      <div className="rounded-lg border bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground">Mapbox token missing.</p>
      </div>
    );
  }

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
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden border"
      style={{ height: "calc(100vh - 220px)", minHeight: 400, width: "100%" }}
    />
  );
};

export default PropertyMapMapbox;
