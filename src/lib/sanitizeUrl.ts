/**
 * Sanitizes URLs to prevent XSS attacks via javascript: and data: protocols.
 * This mitigates CVE-2024-21668 in React versions prior to 18.3.2.
 * 
 * @param url - The URL to sanitize
 * @returns A safe URL or '#' if the URL is potentially malicious
 */
export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url) {
    return '#';
  }

  const trimmedUrl = url.trim().toLowerCase();
  
  // Block javascript: and data: protocols which can execute arbitrary code
  if (trimmedUrl.startsWith('javascript:') || trimmedUrl.startsWith('data:')) {
    console.warn('Blocked potentially malicious URL:', url);
    return '#';
  }

  // Block vbscript: protocol (IE legacy)
  if (trimmedUrl.startsWith('vbscript:')) {
    console.warn('Blocked potentially malicious URL:', url);
    return '#';
  }

  return url;
};

/**
 * Validates if a URL is safe for use in href attributes
 * @param url - The URL to validate
 * @returns true if the URL is safe, false otherwise
 */
export const isUrlSafe = (url: string | undefined | null): boolean => {
  if (!url) {
    return false;
  }

  const trimmedUrl = url.trim().toLowerCase();
  
  return !trimmedUrl.startsWith('javascript:') && 
         !trimmedUrl.startsWith('data:') && 
         !trimmedUrl.startsWith('vbscript:');
};
