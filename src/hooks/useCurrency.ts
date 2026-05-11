// Re-export from context for backwards compatibility
export { useCurrency } from '@/contexts/CurrencyContext';
export default function useCurrencyHook() {
  // This is kept for backwards compatibility with default imports
  const { useCurrency } = require('@/contexts/CurrencyContext');
  return useCurrency();
}
