import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const SITE_URL = 'https://samsari.tech';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPropertyImage(property: any): string {
  if (property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
    const firstPhoto = property.photos[0] as any;
    if (firstPhoto?.url) {
      let url = firstPhoto.url;
      if (!url.startsWith('http')) {
        url = url.startsWith('/storage/')
          ? `${Deno.env.get('SUPABASE_URL')}${url}`
          : `${SITE_URL}${url}`;
      }
      return url;
    }
  }
  return `${SITE_URL}/placeholder.svg`;
}

function getKeyFeature(property: any): string {
  const amenities = property.amenities || [];
  const features: Record<string, string> = {
    wifi: 'Fast WiFi', pool: 'Pool', parking: 'Free Parking',
    ac: 'Air Conditioning', kitchen: 'Full Kitchen', beach: 'Beach Access',
  };
  for (const [key, label] of Object.entries(features)) {
    if (amenities.some((a: string) => a.toLowerCase().includes(key))) return label;
  }
  const typeLabels: Record<string, string> = {
    apartment: 'Modern Apartment', house: 'Entire House', villa: 'Luxury Villa',
    studio: 'Cozy Studio', room: 'Private Room',
  };
  return typeLabels[property.property_type] || 'Vacation Rental';
}

function renderPropertyPage(property: any): string {
  const title = `Rental in ${escapeHtml(property.city)} · ${property.bedrooms} Bed · ${getKeyFeature(property)}`;
  const description = `${property.max_guests} guests · ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} · ${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''} in ${escapeHtml(property.city)}, ${escapeHtml(property.governorate)}. ${property.price_per_night} TND/night.`;
  const canonicalUrl = `${SITE_URL}/p/${property.short_code || property.id}`;
  const imageUrl = getPropertyImage(property);
  const amenities = (property.amenities || []) as string[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.title,
    description: property.description || description,
    image: imageUrl,
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.city,
      addressRegion: property.governorate,
      addressCountry: 'TN',
    },
    geo: property.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: (property.coordinates as any)?.lat,
      longitude: (property.coordinates as any)?.lng,
    } : undefined,
    priceRange: `${property.price_per_night} TND`,
    numberOfRooms: property.bedrooms,
    amenityFeature: amenities.map((a: string) => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
      value: true,
    })),
    offers: {
      '@type': 'Offer',
      price: property.price_per_night,
      priceCurrency: 'TND',
      availability: 'https://schema.org/InStock',
    },
  };

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Samsari">
  <meta property="og:locale" content="fr_TN">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  
  <style>
    body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;color:#1a1a1a}
    img{max-width:100%;border-radius:12px;margin:1rem 0}
    .meta{color:#666;margin:0.5rem 0}
    .price{font-size:1.5rem;font-weight:bold;color:#2563eb}
    .amenities{display:flex;flex-wrap:wrap;gap:0.5rem;margin:1rem 0}
    .amenity{background:#f3f4f6;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.875rem}
    .cta{display:inline-block;background:#2563eb;color:white;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;margin:1rem 0}
  </style>
</head>
<body>
  <header><a href="${SITE_URL}"><strong>Samsari</strong></a> — Secure Short-Term Rentals in Tunisia</header>
  
  <main>
    <h1>${escapeHtml(property.title)}</h1>
    <p class="meta">${escapeHtml(property.city)}, ${escapeHtml(property.governorate)} · ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} · ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''} · Up to ${property.max_guests} guests</p>
    <p class="price">${property.price_per_night} TND / night</p>
    
    <img src="${imageUrl}" alt="${escapeHtml(property.title)} - Rental in ${escapeHtml(property.city)}" width="800" height="450" loading="eager">
    
    <p>${escapeHtml((property.description || '').substring(0, 500))}</p>
    
    ${amenities.length > 0 ? `<div class="amenities">${amenities.map((a: string) => `<span class="amenity">${escapeHtml(a)}</span>`).join('')}</div>` : ''}
    
    <a href="${canonicalUrl}" class="cta">View Property & Book</a>
  </main>
  
  <footer>
    <p><a href="${SITE_URL}">Samsari</a> · <a href="${SITE_URL}/search">Search Properties</a> · <a href="${SITE_URL}/safety">Safety</a> · <a href="${SITE_URL}/help">Help</a></p>
  </footer>

  <script>
    // Redirect human visitors to the SPA after crawlers have parsed the HTML
    if (!/bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|Telegram|Discord|LinkedInBot|OAI-SearchBot|Claude-Web|Perplexity|Applebot/i.test(navigator.userAgent)) {
      setTimeout(function(){ window.location.replace("${canonicalUrl}"); }, 300);
    }
  </script>
</body>
</html>`;
}

function renderStaticPage(path: string): string {
  const pages: Record<string, { title: string; description: string; jsonLd?: object }> = {
    '/': {
      title: 'Samsari – Secure Short-Term Rentals in Tunisia',
      description: 'Find and book verified vacation rentals across Tunisia with secure escrow payments, identity verification, and 24/7 support.',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: 'Samsari',
            url: SITE_URL,
            description: 'Secure short-term rental platform in Tunisia',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE_URL}/search?location={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'Organization',
            name: 'Samsari',
            url: SITE_URL,
            logo: 'https://storage.googleapis.com/gpt-engineer-file-uploads/lpfdzOIqecRZeey0zk0XN1YqGBl1/uploads/1769112094927-unnamed-removebg-preview.png',
            contactPoint: { '@type': 'ContactPoint', email: 'support@samsari.tn', contactType: 'customer service' },
            sameAs: [],
            areaServed: { '@type': 'Country', name: 'Tunisia' },
          },
        ],
      },
    },
    '/search': {
      title: 'Search Properties in Tunisia – Samsari',
      description: 'Browse verified vacation rentals across Tunisia. Filter by city, price, property type, and dates. Secure booking with escrow protection.',
    },
    '/become-host': {
      title: 'Become a Host on Samsari – Earn from Your Property in Tunisia',
      description: 'List your property on Samsari and start earning. Verified hosts, secure payments, and full control over your listings.',
    },
    '/help': {
      title: 'Help Center – Samsari',
      description: 'Get answers to common questions about booking, hosting, payments, and safety on Samsari.',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'How do I book a property on Samsari?', acceptedAnswer: { '@type': 'Answer', text: 'Search for your desired location and dates, browse available properties, and click Book Now. Complete the secure payment process to confirm.' } },
          { '@type': 'Question', name: 'What payment methods do you accept?', acceptedAnswer: { '@type': 'Answer', text: 'We accept all major credit cards and debit cards. All payments are processed securely through our platform with escrow protection.' } },
          { '@type': 'Question', name: 'Can I cancel my booking?', acceptedAnswer: { '@type': 'Answer', text: 'Cancellation policies vary by property and are displayed before booking. Refunds depend on the timing and booking stage.' } },
          { '@type': 'Question', name: 'How do I become a host?', acceptedAnswer: { '@type': 'Answer', text: 'Click Become a Host, complete your property listing with photos and descriptions, set pricing, and submit for review.' } },
          { '@type': 'Question', name: 'Is it safe to book through Samsari?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. All hosts are identity-verified, payments are held in escrow, and we provide 24/7 support.' } },
        ],
      },
    },
    '/safety': {
      title: 'Safety & Trust – Samsari',
      description: 'Learn about Samsari safety features: identity verification, escrow-protected payments, property verification, and 24/7 support.',
    },
    '/privacy': {
      title: 'Privacy Policy – Samsari',
      description: 'How Samsari collects, uses, and protects your personal data. Compliant with Tunisian data protection law.',
    },
    '/terms': {
      title: 'Terms of Service – Samsari',
      description: 'Terms and conditions for using Samsari, the secure short-term rental platform in Tunisia.',
    },
  };

  const page = pages[path] || pages['/'];
  const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`;

  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/lpfdzOIqecRZeey0zk0XN1YqGBl1/social-images/social-1769384209059-Screenshot 2026-01-26 003623.png">
  <meta property="og:site_name" content="Samsari">
  <meta property="og:locale" content="fr_TN">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/lpfdzOIqecRZeey0zk0XN1YqGBl1/social-images/social-1769384209059-Screenshot 2026-01-26 003623.png">
  
  ${page.jsonLd ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>` : ''}
  
  <script>
    if (!/bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|Telegram|Discord|LinkedInBot|OAI-SearchBot|Claude-Web|Perplexity|Applebot/i.test(navigator.userAgent)) {
      window.location.replace("${canonicalUrl}");
    }
  </script>
  <noscript><meta http-equiv="refresh" content="0;url=${canonicalUrl}"></noscript>
</head>
<body>
  <h1>${escapeHtml(page.title)}</h1>
  <p>${escapeHtml(page.description)}</p>
  <p><a href="${canonicalUrl}">Continue to Samsari</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '/';

    // Check if this is a property page
    const propertyMatch = path.match(/^\/p\/(.+)$/);

    if (propertyMatch) {
      const shortCode = propertyMatch[1];
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Try short_code first, then UUID
      let query = supabase.from('properties').select('*');
      if (shortCode.match(/^\d{7}$/)) {
        query = query.eq('short_code', shortCode);
      } else {
        query = query.eq('id', shortCode);
      }

      const { data: property, error } = await query.single();

      if (error || !property) {
        console.error('Property not found:', shortCode, error);
        return new Response(renderStaticPage('/'), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      console.log(`Prerender: Property "${property.title}" (${shortCode})`);

      return new Response(renderPropertyPage(property), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Static page
    console.log(`Prerender: Static page "${path}"`);
    return new Response(renderStaticPage(path), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Prerender error:', error);
    return new Response(renderStaticPage('/'), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      status: 500,
    });
  }
});
