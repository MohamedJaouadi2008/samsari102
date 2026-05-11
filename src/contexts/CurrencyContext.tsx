import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Approximate exchange rates (TND base)
const EXCHANGE_RATES: Record<string, number> = {
  TND: 1,
  USD: 0.32,
  EUR: 0.29
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  TND: 'TND',
  USD: '$',
  EUR: '€'
};

interface CurrencyContextType {
  preferredCurrency: string;
  loading: boolean;
  setCurrency: (currency: string) => Promise<void>;
  convertPrice: (priceInTND: number) => number;
  formatPrice: (priceInTND: number) => string;
  getStripeCurrency: () => string;
  getStripeAmount: (priceInTND: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferredCurrency, setPreferredCurrency] = useState<string>('TND');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrencyPreference = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_currency')
          .eq('id', user.id)
          .single();

        if (data?.preferred_currency) {
          setPreferredCurrency(data.preferred_currency);
        }
      } catch (error) {
        console.error('Error fetching currency preference:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrencyPreference();
  }, [user]);

  // Function to change currency (updates DB if logged in)
  const setCurrency = useCallback(async (currency: string) => {
    setPreferredCurrency(currency);
    
    if (user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ preferred_currency: currency })
          .eq('id', user.id);

        if (error) throw error;
        
        toast({
          title: "Currency Updated",
          description: `Prices will now be shown in ${currency}`,
        });
      } catch (error) {
        console.error('Error saving currency preference:', error);
        toast({
          title: "Error",
          description: "Failed to save currency preference",
          variant: "destructive"
        });
      }
    }
  }, [user, toast]);

  // Convert price from TND to preferred currency
  const convertPrice = useCallback((priceInTND: number): number => {
    const rate = EXCHANGE_RATES[preferredCurrency] || 1;
    return Math.round(priceInTND * rate * 100) / 100;
  }, [preferredCurrency]);

  // Format price with currency symbol
  const formatPrice = useCallback((priceInTND: number): string => {
    const converted = convertPrice(priceInTND);
    const symbol = CURRENCY_SYMBOLS[preferredCurrency] || preferredCurrency;
    
    if (preferredCurrency === 'TND') {
      return `${converted.toFixed(0)} TND`;
    }
    return `${symbol}${converted.toFixed(2)}`;
  }, [preferredCurrency, convertPrice]);

  // Get currency for Stripe (must be lowercase, TND not supported so fallback to USD)
  const getStripeCurrency = useCallback((): string => {
    // TND is not supported by Stripe, so default to USD
    if (preferredCurrency === 'TND') {
      return 'usd';
    }
    return preferredCurrency.toLowerCase();
  }, [preferredCurrency]);

  // Convert amount for Stripe (in cents/smallest unit)
  const getStripeAmount = useCallback((priceInTND: number): number => {
    const currency = getStripeCurrency();
    const rate = currency === 'usd' ? EXCHANGE_RATES.USD : EXCHANGE_RATES.EUR;
    const converted = priceInTND * rate;
    // Stripe uses cents
    return Math.round(converted * 100);
  }, [getStripeCurrency]);

  const value = {
    preferredCurrency,
    loading,
    setCurrency,
    convertPrice,
    formatPrice,
    getStripeCurrency,
    getStripeAmount
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
