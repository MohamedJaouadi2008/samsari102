import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface TranslatedProperty {
  title: string;
  description: string;
  house_rules?: string;
  welcome_message?: string;
}

export const usePropertyTranslation = (property: {
  title: string;
  description?: string | null;
  house_rules?: string | null;
  welcome_message?: string | null;
} | null) => {
  const { language } = useLanguage();
  const [translatedContent, setTranslatedContent] = useState<TranslatedProperty | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateContent = async () => {
      if (!property) return;

      // If English (default), use original content
      if (language === 'en') {
        setTranslatedContent({
          title: property.title,
          description: property.description || '',
          house_rules: property.house_rules || undefined,
          welcome_message: property.welcome_message || undefined,
        });
        return;
      }

      setIsTranslating(true);

      try {
        // Combine all text to translate in one request to minimize API calls
        // Use a unique separator that won't be translated
        const SEPARATOR = '\n|||SPLIT|||\n';
        const textsToTranslate = [
          property.title,
          property.description || '',
          property.house_rules || '',
          property.welcome_message || '',
        ].filter(Boolean);

        const combinedText = textsToTranslate.join(SEPARATOR);

        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            text: combinedText,
            targetLang: language,
            sourceLang: 'en',
          },
        });

        if (error) {
          console.error('Translation error:', error);
          // Fallback to original content
          setTranslatedContent({
            title: property.title,
            description: property.description || '',
            house_rules: property.house_rules || undefined,
            welcome_message: property.welcome_message || undefined,
          });
          return;
        }

        // Split by the separator (handle potential translation of separator)
        const translatedParts = data.translatedText.split(/\|\|\|SPLIT\|\|\||\|\|\|SÉPARÉ\|\|\||\|\|\|فاصل\|\|\|/i);

        setTranslatedContent({
          title: translatedParts[0]?.trim() || property.title,
          description: translatedParts[1]?.trim() || property.description || '',
          house_rules: translatedParts[2]?.trim() || property.house_rules || undefined,
          welcome_message: translatedParts[3]?.trim() || property.welcome_message || undefined,
        });
      } catch (error) {
        console.error('Translation error:', error);
        // Fallback to original content
        setTranslatedContent({
          title: property.title,
          description: property.description || '',
          house_rules: property.house_rules || undefined,
          welcome_message: property.welcome_message || undefined,
        });
      } finally {
        setIsTranslating(false);
      }
    };

    translateContent();
  }, [property, language]);

  return { translatedContent, isTranslating };
};
