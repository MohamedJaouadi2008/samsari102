import React, { useEffect } from 'react';
import { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties">;

interface PropertySharingMetaProps {
  property: Property;
}

const SUPABASE_URL = "https://gigzciepwjrwbljdnixh.supabase.co";

const PropertySharingMeta: React.FC<PropertySharingMetaProps> = ({ property }) => {
  useEffect(() => {
    // Set page title - format like Airbnb: "Title · Rating · Beds · Baths"
    const title = `${property.title} · ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} · ${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''}`;
    document.title = title;

    // Create meta description with location and guest info
    const description = `${property.max_guests} guests · ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} · ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''} in ${property.city}, ${property.governorate}. ${property.price_per_night} TND/night. ${(property.description || '').substring(0, 100)}`;
    
    // Get the first valid image URL - prioritize high quality
    const getFirstImageUrl = () => {
      if (property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
        const firstPhoto = property.photos[0] as any;
        if (firstPhoto && typeof firstPhoto === 'object' && firstPhoto.url) {
          let imageUrl = firstPhoto.url;
          // Ensure absolute URL
          if (!imageUrl.startsWith('http')) {
            if (imageUrl.startsWith('/storage/')) {
              imageUrl = `${SUPABASE_URL}${imageUrl}`;
            } else {
              imageUrl = `${window.location.origin}${imageUrl}`;
            }
          }
          return imageUrl;
        }
      }
      return `${window.location.origin}/placeholder.svg`;
    };

    const imageUrl = getFirstImageUrl();
    const currentUrl = window.location.href;
    const siteName = 'Samsari';

    // Update meta description
    updateOrCreateMetaTag('description', description);

    // Open Graph tags - essential for social sharing
    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: currentUrl },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:secure_url', content: imageUrl },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: `${property.title} - Property in ${property.city}` },
      { property: 'og:site_name', content: siteName },
      { property: 'og:locale', content: 'en_US' },
    ];

    ogTags.forEach(({ property: prop, content }) => {
      updateOrCreateMetaTag(prop, content, 'property');
    });

    // Twitter Card tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
      { name: 'twitter:image:alt', content: `${property.title} - Property in ${property.city}` },
    ];

    twitterTags.forEach(({ name, content }) => {
      updateOrCreateMetaTag(name, content, 'name');
    });

    // Canonical link for property page
    const propertyPath = property.short_code ? `/p/${property.short_code}` : `/property/${property.id}`;
    const canonicalUrl = `https://samsari.tech${propertyPath}`;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.setAttribute('data-dynamic', 'true');
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // Hreflang tags
    ['fr', 'ar', 'en', 'x-default'].forEach(lang => {
      let link = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = lang;
        link.setAttribute('data-dynamic', 'true');
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
    });

    // JSON-LD for LodgingBusiness
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: property.title,
      description: (property.description || '').substring(0, 200),
      address: {
        '@type': 'PostalAddress',
        addressLocality: property.city,
        addressRegion: property.governorate,
        addressCountry: 'TN',
      },
      numberOfRooms: property.bedrooms,
      petsAllowed: false,
      priceRange: `${property.price_per_night} TND`,
      image: imageUrl,
      url: canonicalUrl,
    };
    let jsonLdEl = document.querySelector('script[data-property-jsonld]') as HTMLScriptElement | null;
    if (!jsonLdEl) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.type = 'application/ld+json';
      jsonLdEl.setAttribute('data-property-jsonld', 'true');
      document.head.appendChild(jsonLdEl);
    }
    jsonLdEl.textContent = JSON.stringify(jsonLd);

    // Cleanup on unmount
    return () => {
      document.title = 'Samsari – Secure Short-Term Rentals in Tunisia';
      const metasToRemove = document.querySelectorAll('meta[data-dynamic="true"], link[data-dynamic="true"], script[data-property-jsonld]');
      metasToRemove.forEach(meta => meta.remove());
    };
  }, [property]);

  const updateOrCreateMetaTag = (identifier: string, content: string, attributeType: 'name' | 'property' = 'name') => {
    let meta = document.querySelector(`meta[${attributeType}="${identifier}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attributeType, identifier);
      meta.setAttribute('data-dynamic', 'true');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  return null;
};

export default PropertySharingMeta;
