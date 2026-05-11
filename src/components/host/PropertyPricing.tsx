
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PropertyPricingProps {
  data: any;
  onUpdate: (data: any) => void;
  errors?: Record<string, string>;
}

const PropertyPricing = ({ data, onUpdate, errors }: PropertyPricingProps) => {
  const [basePrice, setBasePrice] = useState(data.price_per_night || 0);
  const [currency, setCurrency] = useState(data.currency || "TND");

  // Sync with data when it changes
  useEffect(() => {
    if (data.price_per_night !== basePrice) {
      setBasePrice(data.price_per_night || 0);
    }
    if (data.currency !== currency) {
      setCurrency(data.currency || "TND");
    }
  }, [data.price_per_night, data.currency]);

  const handlePriceChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setBasePrice(numValue);
    onUpdate({ price_per_night: numValue });
  };

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    onUpdate({ currency: value });
  };

  const serviceFeeRate = 0.04; // 4% (3% service + 1% transaction fees)
  const serviceFee = basePrice * serviceFeeRate;
  const totalEarnings = basePrice - serviceFee;

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const currencies = [
    { value: "TND", label: "TND (Tunisian Dinar)" },
    { value: "USD", label: "USD (US Dollar)" },
    { value: "EUR", label: "EUR (Euro)" }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="currency">Currency *</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="base_price">Base Price per Night *</Label>
              <div className="relative mt-2">
                <Input
                  id="base_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={basePrice || ""}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="Enter price"
                  className={`pr-16 ${errors?.price_per_night ? 'border-red-500' : ''}`}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  {currency}
                </span>
              </div>
              {errors?.price_per_night && (
                <p className="text-sm text-red-500 mt-1">{errors.price_per_night}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                This is the amount guests will pay per night
              </p>
            </div>

            {basePrice > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4" />
                    <h4 className="font-medium">Pricing Breakdown</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Base Price per Night</span>
                      <span className="font-medium">{formatCurrency(basePrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Samsari service fee + transaction fees (4%)</span>
                      <span>-{formatCurrency(serviceFee)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Your Earnings per Night</span>
                      <span className="text-green-600">{formatCurrency(totalEarnings)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>Pricing Tips:</strong> Research similar properties in your area to set competitive rates. 
              Consider seasonal adjustments and local events that might affect demand.
            </AlertDescription>
          </Alert>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">🆓 Free Platform Benefits</h4>
            <ul className="text-sm space-y-1">
              <li>• No listing fees - your property goes live immediately</li>
              <li>• Only pay when you earn</li>
              <li>• Optional paid promotion available (20 {currency}/day)</li>
              <li>• ID verification required for all users</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyPricing;
