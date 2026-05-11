
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Select value={language} onValueChange={(value: 'en' | 'fr' | 'ar') => setLanguage(value)}>
      <SelectTrigger className="w-[120px] bg-background border-border" aria-label="Select language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en" className="flex items-center">
          🇺🇸 English
        </SelectItem>
        <SelectItem value="fr" className="flex items-center">
          🇫🇷 Français
        </SelectItem>
        <SelectItem value="ar" className="flex items-center">
          🇹🇳 العربية
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
