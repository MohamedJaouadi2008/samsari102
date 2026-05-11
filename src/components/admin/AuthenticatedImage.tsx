import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertCircle, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthenticatedImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  maxRetries?: number;
  onClick?: (imageSrc: string) => void;
}

export const AuthenticatedImage = ({ 
  src, 
  alt, 
  className, 
  fallback,
  maxRetries = 3,
  onClick
}: AuthenticatedImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadImage = useCallback(async () => {
    if (!src) {
      setLoading(false);
      setError('No image URL provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(src, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 401) {
          setError('Session expired - please refresh');
        } else if (response.status === 403) {
          setError('Access denied');
        } else if (response.status === 404) {
          setError('Image not found');
        } else {
          setError(`Failed to load (${response.status})`);
        }
        console.error('Image fetch failed:', response.status, errorText);
        setLoading(false);
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setImageSrc(objectUrl);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Error loading authenticated image:', err);
      setError('Network error - check connection');
      setLoading(false);
    }
  }, [src]);

  useEffect(() => {
    loadImage();

    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src, retryCount]);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className={`${className} bg-muted animate-pulse flex items-center justify-center rounded border`}>
        <div className="flex flex-col items-center gap-1">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !imageSrc) {
    return fallback ? <>{fallback}</> : (
      <div className={`${className} bg-muted flex flex-col items-center justify-center gap-2 rounded border p-2`}>
        <div className="flex items-center gap-1 text-destructive">
          {error === 'Image not found' ? (
            <ImageOff className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-xs">{error || 'Failed to load'}</span>
        </div>
        {retryCount < maxRetries && error !== 'Image not found' && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRetry}
            className="h-6 text-xs px-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry ({maxRetries - retryCount} left)
          </Button>
        )}
      </div>
    );
  }

  const handleClick = () => {
    if (onClick && imageSrc) {
      onClick(imageSrc);
    }
  };

  return (
    <div 
      className={`relative group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <img 
        src={imageSrc} 
        alt={alt} 
        className={className}
        onError={() => {
          setError('Image failed to display');
          if (imageSrc) URL.revokeObjectURL(imageSrc);
          setImageSrc(null);
        }}
      />
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center rounded">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
