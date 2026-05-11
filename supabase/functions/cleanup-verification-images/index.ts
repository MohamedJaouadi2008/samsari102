import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

  // Empty payload for DELETE
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

  // R2 returns 204 on successful delete, 404 if already gone
  if (response.ok || response.status === 204 || response.status === 404) {
    await response.text(); // consume body
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
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find verified/rejected verifications older than 30 days that haven't been cleaned
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: records, error } = await supabase
      .from('id_verifications')
      .select('id, cin_front_url, cin_back_url, selfie_url, status, reviewed_at')
      .in('status', ['verified', 'rejected_final'])
      .is('images_cleaned_at', null)
      .lt('reviewed_at', thirtyDaysAgo)
      .limit(50); // Process in batches

    if (error) {
      console.error('Query error:', error);
      throw error;
    }

    if (!records || records.length === 0) {
      console.log('No verification images to clean up');
      return new Response(JSON.stringify({ cleaned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${records.length} verification records to clean up`);

    let cleanedCount = 0;

    for (const record of records) {
      const paths = [record.cin_front_url, record.cin_back_url, record.selfie_url];
      let allDeleted = true;

      for (const path of paths) {
        if (!path) continue;
        // Paths stored as relative: userId/filename - prepend id-verification/
        const fullPath = `id-verification/${path}`;
        const success = await deleteR2Object(fullPath);
        if (!success) allDeleted = false;
      }

      if (allDeleted) {
        // Mark as cleaned and clear URLs
        await supabase
          .from('id_verifications')
          .update({
            images_cleaned_at: new Date().toISOString(),
            cin_front_url: 'cleaned',
            cin_back_url: 'cleaned',
            selfie_url: 'cleaned',
          })
          .eq('id', record.id);

        cleanedCount++;
        console.log(`Cleaned verification ${record.id}`);
      }
    }

    console.log(`Cleanup complete: ${cleanedCount}/${records.length} records cleaned`);

    return new Response(JSON.stringify({ cleaned: cleanedCount, total: records.length }), {
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
