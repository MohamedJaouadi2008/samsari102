import { useEffect } from 'react';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOConfig {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  jsonLd?: object;
  noHreflang?: boolean;
  keywords?: string;
  breadcrumbs?: BreadcrumbItem[];
}

const SITE_URL = 'https://samsari.tech';
const DEFAULT_OG_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/lpfdzOIqecRZeey0zk0XN1YqGBl1/social-images/social-1769384209059-Screenshot 2026-01-26 003623.png';

export function usePageSEO({ title, description, canonicalPath, ogImage, jsonLd, noHreflang, keywords, breadcrumbs }: SEOConfig) {
  useEffect(() => {
    document.title = title;

    const canonicalUrl = `${SITE_URL}${canonicalPath || window.location.pathname}`;
    const image = ogImage || DEFAULT_OG_IMAGE;

    const tags: Record<string, { attr: 'name' | 'property'; content: string }> = {
      'description': { attr: 'name', content: description },
      ...(keywords ? { 'keywords': { attr: 'name', content: keywords } } : {}),
      'og:title': { attr: 'property', content: title },
      'og:description': { attr: 'property', content: description },
      'og:url': { attr: 'property', content: canonicalUrl },
      'og:image': { attr: 'property', content: image },
      'og:type': { attr: 'property', content: 'website' },
      'og:site_name': { attr: 'property', content: 'Samsari' },
      'twitter:title': { attr: 'name', content: title },
      'twitter:description': { attr: 'name', content: description },
      'twitter:image': { attr: 'name', content: image },
      'twitter:card': { attr: 'name', content: 'summary_large_image' },
    };

    // Update or create meta tags
    Object.entries(tags).forEach(([key, { attr, content }]) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        el.setAttribute('data-seo', 'true');
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    });

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.setAttribute('data-seo', 'true');
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // JSON-LD
    let jsonLdEl = document.querySelector('script[data-seo-jsonld]') as HTMLScriptElement | null;
    if (jsonLd) {
      if (!jsonLdEl) {
        jsonLdEl = document.createElement('script');
        jsonLdEl.type = 'application/ld+json';
        jsonLdEl.setAttribute('data-seo-jsonld', 'true');
        document.head.appendChild(jsonLdEl);
      }
      jsonLdEl.textContent = JSON.stringify(jsonLd);
    } else if (jsonLdEl) {
      jsonLdEl.remove();
    }

    // BreadcrumbList JSON-LD
    let breadcrumbEl = document.querySelector('script[data-seo-breadcrumb]') as HTMLScriptElement | null;
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };
      if (!breadcrumbEl) {
        breadcrumbEl = document.createElement('script');
        breadcrumbEl.type = 'application/ld+json';
        breadcrumbEl.setAttribute('data-seo-breadcrumb', 'true');
        document.head.appendChild(breadcrumbEl);
      }
      breadcrumbEl.textContent = JSON.stringify(breadcrumbJsonLd);
    } else if (breadcrumbEl) {
      breadcrumbEl.remove();
    }

    // Hreflang tags for multilingual support
    if (!noHreflang) {
      const hreflangMap: Record<string, string> = {
        'fr': canonicalUrl,
        'ar': canonicalUrl,
        'en': canonicalUrl,
        'x-default': canonicalUrl,
      };
      Object.entries(hreflangMap).forEach(([lang, href]) => {
        let link = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'alternate';
          link.hreflang = lang;
          link.setAttribute('data-seo', 'true');
          document.head.appendChild(link);
        }
        link.href = href;
      });
    }

    return () => {
      document.title = 'Samsari – Secure Short-Term Rentals in Tunisia';
      const seoEls = document.querySelectorAll('[data-seo="true"], [data-seo-jsonld], [data-seo-breadcrumb]');
      seoEls.forEach(el => el.remove());
    };
  }, [title, description, canonicalPath, ogImage, jsonLd, noHreflang, keywords, breadcrumbs]);
}
