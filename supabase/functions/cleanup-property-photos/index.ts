import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// HMAC-SHA256 helpers for AWS Signature V4
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  return await hmacSha256(kService, 'aws4_request');
}

async function deleteR2Object(objectKey: string): Promise<boolean> {
  const accessKeyId = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID')!;
  const secretAccessKey = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY')!;
  const bucketName = Deno.env.get('CLOUDFLARE_BUCKET_NAME')!;
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucketName}/${objectKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = await sha256(new Uint8Array(0));

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `DELETE\n` +
    `/${bucketName}/${objectKey}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));

  const stringToSign =
    `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = toHex(signatureBuffer);

  const authorizationHeader =
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorizationHeader,
    },
  });

  if (response.ok || response.status === 204 || response.status === 404) {
    await response.text();
    return true;
  }

  const errorText = await response.text();
  console.error(`Failed to delete ${objectKey}: ${response.status} ${errorText}`);
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret (used by pg_net trigger call)
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { property_id, photos } = body;

    if (!property_id || !photos || !Array.isArray(photos)) {
      return new Response(JSON.stringify({ error: 'Missing property_id or photos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Cleaning up ${photos.length} photos for property ${property_id}`);

    let deletedCount = 0;

    for (const photo of photos) {
      const url = photo?.url;
      if (!url || typeof url !== 'string') continue;

      // Extract the R2 object key from the URL
      // Public R2 URLs look like: https://pub-xxx.r2.dev/property-photos/host-id/filename
      // Or relative paths stored directly
      let objectKey = '';

      if (url.includes('r2.dev/')) {
        // Extract path after the domain
        const parts = url.split('r2.dev/');
        objectKey = parts[1] || '';
      } else if (url.startsWith('property-photos/')) {
        objectKey = url;
      } else if (url.startsWith('/')) {
        // Skip local demo images (e.g., /images/demo/...)
        console.log(`Skipping local image: ${url}`);
        continue;
      } else {
        // Try using as-is
        objectKey = `property-photos/${url}`;
      }

      if (!objectKey) {
        console.log(`Could not extract key from URL: ${url}`);
        continue;
      }

      const success = await deleteR2Object(objectKey);
      if (success) deletedCount++;
    }

    console.log(`Deleted ${deletedCount}/${photos.length} photos for property ${property_id}`);

    return new Response(JSON.stringify({ deleted: deletedCount, total: photos.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
