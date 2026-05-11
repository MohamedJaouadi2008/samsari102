
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Info, Smartphone, Monitor, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface LocationPickerProps {
  data: any;
  onUpdate: (data: any) => void;
}

const LocationPicker = ({ data, onUpdate }: LocationPickerProps) => {
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [mapUrl, setMapUrl] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<'mobile' | 'pc' | null>(null);

  useEffect(() => {
    if (data.latitude && data.longitude) {
      setCoordinates({ lat: data.latitude, lng: data.longitude });
    }
    if (data.google_maps_url) {
      setMapUrl(data.google_maps_url);
    }
  }, [data.latitude, data.longitude, data.google_maps_url]);

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          onUpdate({ latitude, longitude });
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to get your location. Please enter coordinates manually or use Google Maps URL.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleCoordinateChange = (field: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const newCoords = { ...coordinates, [field]: numValue };
      setCoordinates(newCoords);
      onUpdate({ 
        latitude: newCoords.lat, 
        longitude: newCoords.lng 
      });
    }
  };

  const handleMapUrlChange = (url: string) => {
    setMapUrl(url);
    onUpdate({ google_maps_url: url });
    
    // Try to extract coordinates from Google Maps URL
    const coordsMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      setCoordinates({ lat, lng });
      onUpdate({ 
        latitude: lat, 
        longitude: lng,
        google_maps_url: url 
      });
    }
  };

  const renderMapPreview = () => {
    if (coordinates.lat && coordinates.lng) {
      return (
        <div className="mt-4">
          <Label className="text-sm font-medium mb-2 block">Map Preview</Label>
          <div className="w-full h-48 bg-muted rounded-lg overflow-hidden">
            <iframe
              src={`https://maps.google.com/maps?q=${coordinates.lat},${coordinates.lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Coordinates: {coordinates.lat?.toFixed(6)}, {coordinates.lng?.toFixed(6)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowInstructions(true)}
            >
              <Info className="w-4 h-4 mr-2" />
              How to get exact location
            </Button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4" />
          Location
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-semibold">🛡️ Location Privacy</h4>
                <p className="text-sm text-muted-foreground">
                  Your exact location is only shared with confirmed guests. 
                  The general area is shown to potential guests for search purposes.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </Label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={coordinates.lat || ""}
              onChange={(e) => handleCoordinateChange('lat', e.target.value)}
              placeholder="e.g., 36.8065"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={coordinates.lng || ""}
              onChange={(e) => handleCoordinateChange('lng', e.target.value)}
              placeholder="e.g., 10.1815"
            />
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGetCurrentLocation}
            className="w-full"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Use Current Location
          </Button>
          
          <div>
            <Label htmlFor="google_maps_url">Google Maps URL</Label>
            <div className="flex gap-2">
              <Input
                id="google_maps_url"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="Paste Google Maps URL"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleMapUrlChange(mapUrl)}
              >
                Extract
              </Button>
            </div>
          </div>
        </div>
      </div>

      {renderMapPreview()}

      {showInstructions && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">How to get exact location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your platform to see detailed instructions:
            </p>
            <div className="flex gap-4 mb-4">
              <Button
                variant={platform === 'mobile' ? 'default' : 'outline'}
                onClick={() => setPlatform('mobile')}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Mobile
              </Button>
              <Button
                variant={platform === 'pc' ? 'default' : 'outline'}
                onClick={() => setPlatform('pc')}
              >
                <Monitor className="w-4 h-4 mr-2" />
                PC/Desktop
              </Button>
            </div>
            
            {platform === 'mobile' && (
              <Alert>
                <AlertDescription>
                  <strong>Mobile Instructions:</strong><br />
                  1. Open Google Maps app<br />
                  2. Navigate to your property location<br />
                  3. Long press on the exact location<br />
                  4. Tap "Share" and copy the link<br />
                  5. Paste the link above
                </AlertDescription>
              </Alert>
            )}
            
            {platform === 'pc' && (
              <Alert>
                <AlertDescription>
                  <strong>PC/Desktop Instructions:</strong><br />
                  1. Open Google Maps in your browser<br />
                  2. Navigate to your property location<br />
                  3. Right-click on the exact location<br />
                  4. The coordinates will appear, click to copy<br />
                  5. Enter the coordinates in the fields above
                </AlertDescription>
              </Alert>
            )}
            
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                onClick={() => window.open('https://maps.google.com', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Google Maps
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInstructions(false)}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LocationPicker;
