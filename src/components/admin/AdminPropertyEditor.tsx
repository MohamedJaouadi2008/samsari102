import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bed, MapPin, Save, Loader2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { tunisianCities, getCitiesByGovernorate, getAllGovernorates } from "@/components/TunisianCities";

type Property = Tables<"properties">;

interface BedroomDetail {
  type: string;
  beds: number;
}

interface AdminPropertyEditorProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPropertyUpdated: () => void;
}

const propertyTypes = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'room', label: 'Room' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'traditional', label: 'Traditional' },
];

const cancellationPolicies = [
  { value: 'Flexible', label: 'Flexible' },
  { value: 'Moderate', label: 'Moderate' },
  { value: 'Strict', label: 'Strict' },
  { value: 'Super Strict', label: 'Super Strict' },
];

const AdminPropertyEditor: React.FC<AdminPropertyEditorProps> = ({
  property,
  open,
  onOpenChange,
  onPropertyUpdated
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    property_type: property.property_type,
    title: property.title,
    description: property.description || '',
    governorate: property.governorate,
    city: property.city,
    address: property.address || '',
    minimum_stay: property.minimum_stay || 1,
    cancellation_policy: property.cancellation_policy || 'Moderate',
    check_in_time: property.check_in_time || '',
    check_out_time: property.check_out_time || '',
    house_rules: property.house_rules || '',
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    max_guests: property.max_guests,
    extra_beds: property.extra_beds || 0,
    welcome_message: property.welcome_message || '',
    google_maps_url: property.google_maps_url || '',
    coordinates: property.coordinates as { lat?: number; lng?: number } || { lat: undefined, lng: undefined },
    is_verified: (property as any).is_verified ?? false,
  });
  
  const [bedTypes, setBedTypes] = useState<BedroomDetail[]>(
    Array.isArray(property.bed_types) 
      ? (property.bed_types as unknown as BedroomDetail[])
      : []
  );
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => {
    if (formData.governorate) {
      setAvailableCities(getCitiesByGovernorate(formData.governorate));
    }
  }, [formData.governorate]);

  useEffect(() => {
    // Sync bedTypes array length with bedrooms count
    const currentLength = bedTypes.length;
    if (formData.bedrooms > currentLength) {
      const newBeds = [...bedTypes];
      for (let i = currentLength; i < formData.bedrooms; i++) {
        newBeds.push({ type: 'double', beds: 1 });
      }
      setBedTypes(newBeds);
    } else if (formData.bedrooms < currentLength) {
      setBedTypes(bedTypes.slice(0, formData.bedrooms));
    }
  }, [formData.bedrooms]);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateBedroomDetail = (index: number, updates: Partial<BedroomDetail>) => {
    const newBedTypes = [...bedTypes];
    newBedTypes[index] = { ...newBedTypes[index], ...updates };
    setBedTypes(newBedTypes);
  };

  const extractCoordinatesFromUrl = (url: string) => {
    // Try to extract coordinates from Google Maps URL
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        updateFormData({
          coordinates: { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
        });
        toast({
          title: "Coordinates extracted",
          description: `Lat: ${match[1]}, Lng: ${match[2]}`
        });
        return;
      }
    }
    
    toast({
      title: "Could not extract coordinates",
      description: "Please enter coordinates manually",
      variant: "destructive"
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          property_type: formData.property_type,
          title: formData.title,
          description: formData.description,
          governorate: formData.governorate,
          city: formData.city,
          address: formData.address,
          minimum_stay: formData.minimum_stay,
          cancellation_policy: formData.cancellation_policy,
          check_in_time: formData.check_in_time || null,
          check_out_time: formData.check_out_time || null,
          house_rules: formData.house_rules,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          max_guests: formData.max_guests,
          extra_beds: formData.extra_beds,
          welcome_message: formData.welcome_message,
          google_maps_url: formData.google_maps_url,
          coordinates: formData.coordinates,
          bed_types: JSON.parse(JSON.stringify(bedTypes)),
          is_verified: formData.is_verified,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', property.id);

      if (error) throw error;

      toast({
        title: "Property updated",
        description: "Changes saved successfully"
      });
      
      onPropertyUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating property:', error);
      toast({
        title: "Error",
        description: "Failed to update property",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Get property images for display
  const propertyImages = Array.isArray(property.photos) 
    ? (property.photos as { url?: string }[]).filter(p => p?.url).map(p => p.url!)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basics">Property Basics</TabsTrigger>
              <TabsTrigger value="details">Property Details</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
            </TabsList>
            
            {/* Property Basics Tab */}
            <TabsContent value="basics" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Property Type</Label>
                  <Select 
                    value={formData.property_type} 
                    onValueChange={(v) => updateFormData({ property_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Cancellation Policy</Label>
                  <Select 
                    value={formData.cancellation_policy} 
                    onValueChange={(v) => updateFormData({ cancellation_policy: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cancellationPolicies.map(policy => (
                        <SelectItem key={policy.value} value={policy.value}>
                          {policy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Property Title</Label>
                <Input 
                  value={formData.title}
                  onChange={(e) => updateFormData({ title: e.target.value })}
                />
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Governorate</Label>
                  <Select 
                    value={formData.governorate} 
                    onValueChange={(v) => {
                      updateFormData({ governorate: v, city: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllGovernorates().map(gov => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>City/Town</Label>
                  <Select 
                    value={formData.city} 
                    onValueChange={(v) => updateFormData({ city: v })}
                    disabled={!formData.governorate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCities.map(city => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Address</Label>
                <Input 
                  value={formData.address}
                  onChange={(e) => updateFormData({ address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Latitude</Label>
                      <Input 
                        type="number"
                        step="any"
                        value={formData.coordinates?.lat || ''}
                        onChange={(e) => updateFormData({ 
                          coordinates: { ...formData.coordinates, lat: parseFloat(e.target.value) || undefined }
                        })}
                        placeholder="e.g. 36.8065"
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input 
                        type="number"
                        step="any"
                        value={formData.coordinates?.lng || ''}
                        onChange={(e) => updateFormData({ 
                          coordinates: { ...formData.coordinates, lng: parseFloat(e.target.value) || undefined }
                        })}
                        placeholder="e.g. 10.1815"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Google Maps URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={formData.google_maps_url}
                        onChange={(e) => updateFormData({ google_maps_url: e.target.value })}
                        placeholder="Paste Google Maps URL"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => extractCoordinatesFromUrl(formData.google_maps_url)}
                      >
                        Extract
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Minimum Stay (Nights)</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.minimum_stay}
                    onChange={(e) => updateFormData({ minimum_stay: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Check-in Time</Label>
                  <Input 
                    type="time"
                    value={formData.check_in_time}
                    onChange={(e) => updateFormData({ check_in_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Check-out Time</Label>
                  <Input 
                    type="time"
                    value={formData.check_out_time}
                    onChange={(e) => updateFormData({ check_out_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label>House Rules</Label>
                <Textarea 
                  value={formData.house_rules}
                  onChange={(e) => updateFormData({ house_rules: e.target.value })}
                  rows={3}
                  placeholder="Enter house rules..."
                />
              </div>

              <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Verified Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground max-w-md">
                    Mark this listing as Samsari-verified. A shield badge will appear on cards and the property page to signal trust.
                  </div>
                  <Switch
                    checked={formData.is_verified}
                    onCheckedChange={(v) => updateFormData({ is_verified: v })}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Property Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bedrooms</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.bedrooms}
                    onChange={(e) => updateFormData({ bedrooms: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Bathrooms</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.bathrooms}
                    onChange={(e) => updateFormData({ bathrooms: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bed className="h-4 w-4" />
                    Bedroom Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Specify the bed configuration for each bedroom
                  </p>
                  {bedTypes.map((bed, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-24">Bedroom {index + 1}</span>
                      <Select 
                        value={bed.type}
                        onValueChange={(v) => updateBedroomDetail(index, { type: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="double">Double</SelectItem>
                          <SelectItem value="queen">Queen</SelectItem>
                          <SelectItem value="king">King</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        type="number"
                        min={1}
                        className="w-20"
                        value={bed.beds}
                        onChange={(e) => updateBedroomDetail(index, { beds: parseInt(e.target.value) || 1 })}
                      />
                      <span className="text-sm text-muted-foreground">bed(s)</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Maximum Guests</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.max_guests}
                    onChange={(e) => updateFormData({ max_guests: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Extra Beds Available</Label>
                  <Input 
                    type="number"
                    min={0}
                    value={formData.extra_beds}
                    onChange={(e) => updateFormData({ extra_beds: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              
              <div>
                <Label>Welcome Message for Guests</Label>
                <Textarea 
                  value={formData.welcome_message}
                  onChange={(e) => updateFormData({ welcome_message: e.target.value })}
                  rows={4}
                  placeholder="This message will be shown to guests on the booking confirmation page..."
                />
              </div>
            </TabsContent>
            
            {/* Photos Tab (Read-only) */}
            <TabsContent value="photos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Current Photos</CardTitle>
                </CardHeader>
                <CardContent>
                  {propertyImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {propertyImages.map((url, index) => (
                        <div key={index} className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <img 
                            src={url} 
                            alt={`Property photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No photos available</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">
                    Photo editing is not available in this editor. Use the host dashboard to manage photos.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPropertyEditor;
