import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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

    const { path } = await req.json();

    if (!path || typeof path !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid path parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate path to prevent directory traversal
    const sanitizedPath = path.replace(/\.\./g, '').replace(/^\/+/, '');
    
    // Only allow specific prefixes
    const allowedPrefixes = ['id-verification/'];
    const isAllowedPath = allowedPrefixes.some(prefix => sanitizedPath.startsWith(prefix));
    
    if (!isAllowedPath) {
      console.error('Invalid path prefix:', sanitizedPath);
      return new Response(
        JSON.stringify({ error: 'Invalid path' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize R2 client
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: Deno.env.get('CLOUDFLARE_S3_ENDPOINT'),
      credentials: {
        accessKeyId: Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY')!,
      },
      forcePathStyle: true, // Required for Cloudflare R2
    });

    // Generate signed URL with 15 minute expiration
    const command = new GetObjectCommand({
      Bucket: Deno.env.get('CLOUDFLARE_BUCKET_NAME'),
      Key: sanitizedPath,
    });

    // Cap at 5 minutes to minimize exposure window for ID verification images
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    console.log('Generated signed URL for admin:', user.id, 'path:', sanitizedPath);

    return new Response(
      JSON.stringify({ url: signedUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Get signed URL error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
