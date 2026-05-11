import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert ArrayBuffer to hex string
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// HMAC-SHA256 using Web Crypto API
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

// SHA-256 hash
async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
}

// AWS Signature V4 signing key
async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get path from query params
    const url = new URL(req.url);
    const path = url.searchParams.get('path');

    if (!path || typeof path !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getUser() which works with the auth header passed to the client
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
    
    if (adminError || !isAdmin) {
      console.error('Admin check failed:', adminError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate path to prevent directory traversal
    const sanitizedPath = path.replace(/\.\./g, '').replace(/^\/+/, '');
    
    // Only allow specific prefixes for security
    const allowedPrefixes = ['id-verification/'];
    const isAllowedPath = allowedPrefixes.some(prefix => sanitizedPath.startsWith(prefix));
    
    if (!isAllowedPath) {
      console.error('Invalid path prefix:', sanitizedPath);
      return new Response(
        JSON.stringify({ error: 'Invalid path' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get R2 credentials
    const accessKeyId = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY')!;
    const bucketName = Deno.env.get('CLOUDFLARE_BUCKET_NAME')!;
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;

    // Build the request using AWS Signature V4
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const r2Url = `https://${host}/${bucketName}/${sanitizedPath}`;
    
    // AWS Signature V4 signing for GET request
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = 'auto';
    const service = 's3';
    
    // For GET requests, payload is empty
    const payloadHash = await sha256(new Uint8Array(0));
    
    const canonicalHeaders = 
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = 
      `GET\n` +
      `/${bucketName}/${sanitizedPath}\n` +
      `\n` +
      `${canonicalHeaders}\n` +
      `${signedHeaders}\n` +
      `${payloadHash}`;
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));
    
    const stringToSign = 
      `${algorithm}\n` +
      `${amzDate}\n` +
      `${credentialScope}\n` +
      `${canonicalRequestHash}`;
    
    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = toHex(signatureBuffer);
    
    const authorizationHeader = 
      `${algorithm} ` +
      `Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;
    
    console.log('Fetching from R2:', r2Url);
    
    // Fetch using native fetch with AWS Signature V4
    const response = await fetch(r2Url, {
      method: 'GET',
      headers: {
        'Host': host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorizationHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('R2 fetch failed:', response.status, errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'File not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`R2 fetch failed: ${response.status}`);
    }

    // Get the image data
    const imageData = await response.arrayBuffer();
    
    // Determine content type from file extension or response header
    let contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    if (sanitizedPath.endsWith('.jpg') || sanitizedPath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (sanitizedPath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (sanitizedPath.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (sanitizedPath.endsWith('.gif')) {
      contentType = 'image/gif';
    }

    console.log('Serving image for admin, path:', sanitizedPath, 'size:', imageData.byteLength);

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Get R2 image error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
