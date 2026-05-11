import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// SEO METADATA GENERATOR - Reusable for future SSR/Next.js
// ============================================================

interface PropertySEO {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  city: string;
  governorate: string;
  price: number;
  currency: string;
}

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
    .replace(/-+$/, '');
}

function getKeyFeature(property: any): string {
  const amenities = property.amenities || [];
  const features: Record<string, string> = {
    'wifi': 'Fast WiFi',
    'pool': 'Pool',
    'parking': 'Free Parking',
    'ac': 'Air Conditioning',
    'kitchen': 'Full Kitchen',
    'beach': 'Beach Access',
  };
  
  for (const [key, label] of Object.entries(features)) {
    if (amenities.some((a: string) => a.toLowerCase().includes(key))) {
      return label;
    }
  }
  
  const typeLabels: Record<string, string> = {
    'apartment': 'Modern Apartment',
    'house': 'Entire House',
    'villa': 'Luxury Villa',
    'studio': 'Cozy Studio',
    'room': 'Private Room',
  };
  
  return typeLabels[property.property_type] || 'Vacation Rental';
}

// Generates SEO metadata from property data
// This function can be extracted and reused in Next.js/SSR
function generatePropertySEO(property: any, siteUrl: string): PropertySEO {
  const keyFeature = getKeyFeature(property);
  const bedroomText = property.bedrooms === 1 ? '1 Bedroom' : `${property.bedrooms} Bedrooms`;
  
  return {
    title: `Rental Unit in ${property.city} · ${bedroomText} · ${keyFeature}`,
    description: `${property.max_guests} guests · ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''} · ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''} in ${property.city}, ${property.governorate}. ${property.price_per_night} TND/night. ${(property.description || '').substring(0, 120).trim()}`,
    canonicalUrl: `${siteUrl}/p/${property.short_code || property.id}`,
    imageUrl: getPropertyImage(property, siteUrl),
    city: property.city,
    governorate: property.governorate,
    price: property.price_per_night,
    currency: property.currency || 'TND',
  };
}

function getPropertyImage(property: any, siteUrl: string): string {
  if (property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
    const firstPhoto = property.photos[0] as any;
    if (firstPhoto?.url) {
      let url = firstPhoto.url;
      if (!url.startsWith('http')) {
        url = url.startsWith('/storage/') 
          ? `${Deno.env.get('SUPABASE_URL')}${url}` 
          : `${siteUrl}${url}`;
      }
      return url;
    }
  }
  return `${siteUrl}/placeholder.svg`;
}

// Generates HTML with SEO metadata for social sharing only
// Delayed redirect (400ms) ensures crawlers can parse metadata before redirect
function generateSocialSharingHTML(seo: PropertySEO): string {
  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Block indexing - this is for social previews only -->
  <meta name="robots" content="noindex, nofollow">
  <meta name="googlebot" content="noindex, nofollow">
  
  <!-- Primary Meta Tags -->
  <title>${seo.title}</title>
  <meta name="title" content="${seo.title}">
  <meta name="description" content="${seo.description}">
  
  <!-- Canonical points to true product URL -->
  <link rel="canonical" href="${seo.canonicalUrl}">
  
  <!-- Open Graph / Facebook / WhatsApp / Discord -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${seo.canonicalUrl}">
  <meta property="og:title" content="${seo.title}">
  <meta property="og:description" content="${seo.description}">
  <meta property="og:image" content="${seo.imageUrl}">
  <meta property="og:image:secure_url" content="${seo.imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Vacation rental in ${seo.city}, Tunisia">
  <meta property="og:site_name" content="Samsari">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter Card (Large Image) -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${seo.canonicalUrl}">
  <meta name="twitter:title" content="${seo.title}">
  <meta name="twitter:description" content="${seo.description}">
  <meta name="twitter:image" content="${seo.imageUrl}">
  <meta name="twitter:image:alt" content="Vacation rental in ${seo.city}, Tunisia">
  
  <!-- Delayed redirect (400ms) for human users - crawlers don't execute JS -->
  <script>setTimeout(function(){window.location.replace("${seo.canonicalUrl}");},400);</script>
  
  <!-- Fallback for users with JS disabled - delay gives crawlers time -->
  <noscript>
    <meta http-equiv="refresh" content="1;url=${seo.canonicalUrl}">
    <style>body{font-family:system-ui,sans-serif;padding:2rem;text-align:center;}</style>
  </noscript>
</head>
<body>
  <h1>${seo.title}</h1>
  <p>${seo.description}</p>
  <p>Redirecting to <a href="${seo.canonicalUrl}">property page</a>...</p>
</body>
</html>`;
}

// ============================================================
// EDGE FUNCTION HANDLER
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shortCode = url.searchParams.get('code');
    const propertyId = url.searchParams.get('id');
    const siteUrl = url.searchParams.get('siteUrl') || 'https://samsari.tech';

    if (!shortCode && !propertyId) {
      return new Response(JSON.stringify({ error: 'Missing property identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let query = supabase.from('properties').select('*');
    if (shortCode) {
      query = query.eq('short_code', shortCode);
    } else {
      query = query.eq('id', propertyId);
    }

    const { data: property, error } = await query.single();

    if (error || !property) {
      console.error('Property not found:', error);
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate SEO metadata
    const seo = generatePropertySEO(property, siteUrl);
    
    console.log(`Social Share SEO | ${property.title} | Canonical: ${seo.canonicalUrl}`);

    // Generate HTML with full OG tags for social sharing
    const html = generateSocialSharingHTML(seo);

    return new Response(html, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});