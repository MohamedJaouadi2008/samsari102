import { useState } from "react";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { code: 'TND', label: 'TND - Tunisian Dinar', symbol: 'TND' },
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR - Euro', symbol: '€' },
];

const CurrencyToggle = () => {
  const { preferredCurrency, setCurrency } = useCurrency();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleCurrencyChange = (code: string) => {
    if (code !== preferredCurrency) {
      setIsAnimating(true);
      setCurrency(code);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "gap-1 px-2 transition-all duration-300",
            isAnimating && "scale-110 text-primary"
          )}
        >
          <DollarSign className={cn(
            "h-4 w-4 transition-transform duration-300",
            isAnimating && "rotate-12"
          )} />
          <span className={cn(
            "text-sm font-medium transition-all duration-300",
            isAnimating && "font-bold"
          )}>{preferredCurrency}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CURRENCIES.map((currency) => (
          <DropdownMenuItem
            key={currency.code}
            onClick={() => handleCurrencyChange(currency.code)}
            className={preferredCurrency === currency.code ? 'bg-accent' : ''}
          >
            <span className="font-medium mr-2">{currency.symbol}</span>
            {currency.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CurrencyToggle;
