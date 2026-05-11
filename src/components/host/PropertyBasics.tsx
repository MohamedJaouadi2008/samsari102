
import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TimePicker } from "@/components/ui/timepicker";
import { Switch } from "@/components/ui/switch";
import SearchableSelect from "@/components/SearchableSelect";
import LocationPicker from "./LocationPicker";

interface PropertyBasicsProps {
  data: any;
  onUpdate: (data: any) => void;
  errors?: Record<string, string>;
}

const cancellationPolicies = [
  "Flexible", 
  "Moderate", 
  "Strict", 
  "Super Strict"
];

const propertyTypes = [
    "Apartment", "House", "Villa", "Studio", "Loft", "Penthouse"
  ];

  const tunisianGovernorates = [
    "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte", 
    "Béja", "Jendouba", "Le Kef", "Siliana", "Kairouan", "Kasserine", "Sidi Bouzid", 
    "Sousse", "Monastir", "Mahdia", "Sfax", "Gafsa", "Tozeur", "Kebili", "Gabès", 
    "Medenine", "Tataouine"
  ];

  const tunisianCitiesAndTowns = [
    // Tunis Governorate
    "Tunis", "La Marsa", "Carthage", "El Menzah", "Le Bardo", "El Omrane", "Sidi Hassine",
    
    // Ariana
    "Ariana Ville", "La Soukra", "Raoued", "Kalaat El Andalous", "Ettadhamen", "Mnihla",
    
    // Ben Arous
    "Ben Arous Ville", "Hammam Lif", "Ezzahra", "Rades", "Mohamedia", "Mornag", "El Mourouj",
    
    // Manouba
    "Manouba Ville", "Oued Ellil", "Douar Hicher", "Tebourba", "Mornaguia", "Borj El Amri",
    
    // Nabeul
    "Nabeul Ville", "Hammamet", "Dar Chaabane", "Korba", "Kelibia", "Soliman", "Menzel Temime", "Grombalia",
    
    // Bizerte
    "Bizerte Ville", "Menzel Bourguiba", "Mateur", "Ras Jebel", "Tinja", "Sejnane",
    
    // Zaghouan
    "Zaghouan Ville", "El Fahs", "Bir Mcherga", "Nadhour", "Saouaf",
    
    // Béja
    "Béja Ville", "Medjez El Bab", "Testour", "Goubellat", "Nefza",
    
    // Jendouba
    "Jendouba Ville", "Ain Draham", "Ghardimaou", "Tabarka", "Bou Salem", "Fernana",
    
    // Le Kef
    "Le Kef Ville", "Dahmani", "Tajerouine", "Nebeur", "Kalaat Senan",
    
    // Siliana
    "Siliana Ville", "Gaafour", "Kesra", "El Krib", "Makthar", "Bou Arada",
    
    // Kairouan
    "Kairouan Ville", "Haffouz", "Nasrallah", "Chebika", "Sbikha", "Bou Hajla",
    
    // Kasserine
    "Kasserine Ville", "Sbeitla", "Thala", "Fériana", "Jedliane", "Hassi El Frid",
    
    // Sidi Bouzid
    "Sidi Bouzid Ville", "Regueb", "Menzel Bouzaiane", "Bir El Hafey", "Jelma", "Mezzouna",
    
    // Gafsa
    "Gafsa Ville", "Métlaoui", "Moularès", "El Ksar", "Redeyef", "Oum Larayes",
    
    // Tozeur
    "Tozeur Ville", "Nefta", "Degache", "Tameghza",
    
    // Kebili
    "Kebili Ville", "Douz", "Souk Lahad", "Jemna", "El Golâa",
    
    // Medenine
    "Medenine Ville", "Zarzis", "Ben Gardane", "Djerba Houmt Souk", "Djerba Midoun", "Ajim",
    
    // Tataouine
    "Tataouine Ville", "Remada", "Ghomrassen", "Bir Lahmar", "Dehiba",
    
    // Gabès
    "Gabès Ville", "Matmata", "El Hamma", "Mareth", "Ghannouch", "Métouia",
    
    // Sfax
    "Sfax Ville", "Sakiet Ezzit", "Mahres", "El Amra", "Bir Ali Ben Khalifa", "Agareb", "Kerkennah Islands",
    
    // Mahdia
    "Mahdia Ville", "Ksour Essef", "El Jem", "Melloulech", "Bou Merdes", "Chebba",
    
    // Monastir
    "Monastir Ville", "Moknine", "Sayada", "Ksibet El Mediouni", "Bekalta", "Jemmal",
    
    // Sousse
    "Sousse Ville", "Kalaa Kebira", "Kalaa Seghira", "Msaken", "Akouda", "Hammam Sousse", "Enfidha"
  ];

  const PropertyBasics = ({ data, onUpdate, errors = {} }: PropertyBasicsProps) => {
    const getInputClassName = (fieldName: string) => {
      return errors[fieldName] ? "border-red-500 focus:border-red-500" : "";
    };

    const getSelectClassName = (fieldName: string) => {
      return errors[fieldName] ? "border-red-500" : "";
    };

    // Set default times when component mounts if not already set
    React.useEffect(() => {
      if (!data.check_in_time && !data.check_out_time) {
        onUpdate({ 
          check_in_time: "10:00",
          check_out_time: "12:00"
        });
      }
    }, []);

    return (
      <div className="space-y-6">
        <div>
          <Label htmlFor="property_type">Property Type *</Label>
          <Select value={data.property_type} onValueChange={(value) => onUpdate({ property_type: value })}>
            <SelectTrigger className={getSelectClassName('property_type')}>
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              {propertyTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.property_type && (
            <p className="text-red-500 text-sm mt-1">{errors.property_type}</p>
          )}
        </div>

        <div>
          <Label htmlFor="title">Property Title *</Label>
          <Input
            id="title"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="e.g., Beautiful apartment in Tunis center"
            className={getInputClassName('title')}
          />
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">{errors.title}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="e.g., Spacious 3rd floor apartment with stunning beach view, close to restaurants and shops. Perfect for families or couples..."
            rows={4}
            className={getInputClassName('description')}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tip: Describe the atmosphere and location features. Don't mention number of bedrooms - you'll add those in the next step.
          </p>
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        <div>
          <Label htmlFor="governorate">Governorate *</Label>
          <SearchableSelect
            value={data.governorate}
            onValueChange={(value) => onUpdate({ governorate: value })}
            options={tunisianGovernorates}
            placeholder="Select governorate"
            searchPlaceholder="Search governorates..."
            emptyMessage="No governorate found."
            className={getSelectClassName('governorate')}
          />
          {errors.governorate && (
            <p className="text-red-500 text-sm mt-1">{errors.governorate}</p>
          )}
        </div>

        <div>
          <Label>City/Town *</Label>
          <SearchableSelect
            value={data.city}
            onValueChange={(value) => onUpdate({ city: value })}
            options={tunisianCitiesAndTowns}
            placeholder="Select city or town"
            searchPlaceholder="Search cities and towns..."
            emptyMessage="No city found."
            className={getSelectClassName('city')}
          />
          {errors.city && (
            <p className="text-red-500 text-sm mt-1">{errors.city}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={data.address}
            onChange={(e) => onUpdate({ address: e.target.value })}
            placeholder="Full address"
            className={getInputClassName('address')}
          />
          {errors.address && (
            <p className="text-red-500 text-sm mt-1">{errors.address}</p>
          )}
        </div>

        <LocationPicker data={data} onUpdate={onUpdate} />
        
        <div>
          <Label>Minimum Stay (Nights)</Label>
          <Input 
            type="number" 
            value={data.minimum_stay || 1}
            onChange={(e) => onUpdate({ minimum_stay: parseInt(e.target.value) })}
            min={1}
          />
        </div>

        <div>
          <Label>Cancellation Policy</Label>
          <Select 
            value={data.cancellation_policy || "Moderate"}
            onValueChange={(value) => onUpdate({ cancellation_policy: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Cancellation Policy" />
            </SelectTrigger>
            <SelectContent>
              {cancellationPolicies.map((policy) => (
                <SelectItem key={policy} value={policy}>{policy}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Check-in Time</Label>
            <TimePicker 
              value={data.check_in_time || "10:00"}
              onValueChange={(time) => onUpdate({ check_in_time: time })}
            />
          </div>
          <div>
            <Label>Check-out Time</Label>
            <TimePicker 
              value={data.check_out_time || "12:00"}
              onValueChange={(time) => onUpdate({ check_out_time: time })}
            />
          </div>
        </div>

        <div>
          <Label>House Rules</Label>
          <Textarea
            value={data.house_rules || ""}
            onChange={(e) => onUpdate({ house_rules: e.target.value })}
            placeholder="Describe your house rules, smoking policy, pet policy, etc."
          />
        </div>
      </div>
    );
  };

export default PropertyBasics;
