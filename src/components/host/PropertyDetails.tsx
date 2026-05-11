
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bed } from "lucide-react";
import HostWelcomeMessage from "./HostWelcomeMessage";

interface BedroomDetail {
  type: string;
  beds: number;
}

interface PropertyDetailsProps {
  data: {
    bedrooms: number;
    bathrooms: number;
    max_guests: number;
    extra_beds: number;
    bed_types: BedroomDetail[];
    sleeping_arrangements: any[];
  };
  onUpdate: (data: any) => void;
  errors?: Record<string, string>;
}

const PropertyDetails: React.FC<PropertyDetailsProps> = ({ data, onUpdate, errors }) => {
  const updateBedroomDetails = (index: number, updates: Partial<BedroomDetail>) => {
    const newBedroomDetails = [...(data.bed_types || [])];
    newBedroomDetails[index] = { ...newBedroomDetails[index], ...updates };
    onUpdate({ bed_types: newBedroomDetails });
  };

  const addSleepingArrangement = (arrangement: string) => {
    const currentArrangements = data.sleeping_arrangements || [];
    onUpdate({ sleeping_arrangements: [...currentArrangements, arrangement] });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label>Bedrooms</Label>
          <Input 
            type="number" 
            value={data.bedrooms}
            onChange={(e) => onUpdate({ bedrooms: parseInt(e.target.value) })}
            min={1}
            className={errors?.bedrooms ? 'border-red-500' : ''}
          />
          {errors?.bedrooms && <p className="text-red-500 text-sm mt-1">{errors.bedrooms}</p>}
        </div>

        <div>
          <Label>Bathrooms</Label>
          <Input 
            type="number" 
            value={data.bathrooms}
            onChange={(e) => onUpdate({ bathrooms: parseInt(e.target.value) })}
            min={1}
            className={errors?.bathrooms ? 'border-red-500' : ''}
          />
          {errors?.bathrooms && <p className="text-red-500 text-sm mt-1">{errors.bathrooms}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bed className="h-5 w-5" />
            Bedroom Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Specify the bed configuration for each bedroom
          </p>
          
          {[...Array(data.bedrooms)].map((_, index) => (
            <div key={index} className="flex space-x-4 mb-2">
              <select 
                value={data.bed_types?.[index]?.type || ''}
                onChange={(e) => updateBedroomDetails(index, { type: e.target.value })}
                className="border rounded p-2"
              >
                <option value="">Select bed type</option>
                <option value="single">Single bed</option>
                <option value="double">Double bed</option>
                <option value="queen">Queen bed</option>
                <option value="king">King bed</option>
              </select>
              <Input 
                type="number" 
                placeholder="Number of Beds"
                value={data.bed_types?.[index]?.beds || 1}
                onChange={(e) => updateBedroomDetails(index, { beds: parseInt(e.target.value) })}
                min={1}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label>Maximum Guests</Label>
          <Input 
            type="number" 
            value={data.max_guests}
            onChange={(e) => onUpdate({ max_guests: parseInt(e.target.value) })}
            min={1}
            className={errors?.maxGuests ? 'border-red-500' : ''}
          />
          {errors?.maxGuests && <p className="text-red-500 text-sm mt-1">{errors.maxGuests}</p>}
        </div>

        <div>
          <Label>Extra Beds Available</Label>
          <Input 
            type="number" 
            value={data.extra_beds}
            onChange={(e) => onUpdate({ extra_beds: parseInt(e.target.value) })}
            min={0}
          />
        </div>
      </div>

      <HostWelcomeMessage data={data} onUpdate={onUpdate} />
    </div>
  );
};

export default PropertyDetails;
