
import { lazy, Suspense } from "react";
import Header from "@/components/Header";
import { usePageSEO } from "@/hooks/usePageSEO";
import SearchHero from "@/components/SearchHero";
import Footer from "@/components/Footer";

// Lazy-load below-the-fold sections so the LCP element (hero H1) paints first
// without competing with data-fetching effects in featured/daily/popular sections.
const SocialProofSection = lazy(() => import("@/components/landing/SocialProofSection"));
const EscrowExplainedSection = lazy(() => import("@/components/landing/EscrowExplainedSection"));
const FeaturedPropertiesSection = lazy(() => import("@/components/landing/FeaturedPropertiesSection"));
const PopularInCity = lazy(() => import("@/components/landing/PopularInCity"));
const DailyPicksSection = lazy(() => import("@/components/landing/DailyPicksSection"));
const HowItWorks = lazy(() => import("@/components/HowItWorks"));
const BecomeHostCTA = lazy(() => import("@/components/landing/BecomeHostCTA"));
const ReferralCTA = lazy(() => import("@/components/landing/ReferralCTA"));
const TrustCenterSection = lazy(() => import("@/components/landing/TrustCenterSection"));
const BrowseDestinations = lazy(() => import("@/components/landing/BrowseDestinations"));
const SeoAuthorityBlock = lazy(() => import("@/components/landing/SeoAuthorityBlock"));
const FAQSection = lazy(() => import("@/components/landing/FAQSection"));

const Index = () => {
  usePageSEO({
    title: 'Samsari – Rent in Tunisia | Secure Short-Term Rentals',
    description: 'Rent in Tunisia with confidence. Find verified vacation rentals, houses, and apartments across Tunisia with secure escrow payments and identity verification. Location en Tunisie sécurisée.',
    canonicalPath: '/',
    keywords: 'rent apartment in Tunisia, short term rentals in Tunisia, vacation homes Tunisia, secure rentals Tunisia, book house in Tunisia, location courte durée Tunisie, location vacances Tunisie',
    breadcrumbs: [
      { name: 'Home', url: 'https://samsari.tech/' },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'Samsari',
          url: 'https://samsari.tech',
          description: 'Secure short-term rental platform in Tunisia with escrow payment protection and ID-verified hosts.',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://samsari.tech/search?location={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'Organization',
          name: 'Samsari',
          url: 'https://samsari.tech',
          logo: 'https://samsari.tech/favicon.png',
          description: 'Tunisia\'s first dedicated platform for secure short-term rentals with escrow payment protection.',
          contactPoint: {
            '@type': 'ContactPoint',
            email: 'support@samsari.tn',
            contactType: 'customer service',
            availableLanguage: ['French', 'Arabic', 'English'],
            hoursAvailable: {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
              opens: '09:00',
              closes: '18:00',
            },
          },
          areaServed: { '@type': 'Country', name: 'Tunisia' },
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How does escrow payment work on Samsari?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'When you book a property on Samsari, you pay only 20% upfront as a deposit. Your payment is held securely by the platform — not sent directly to the host. The remaining 80% is paid at check-in. Funds are only released to the host after both parties confirm check-in and check-out through the app, eliminating the risk of scams or no-shows.',
              },
            },
            {
              '@type': 'Question',
              name: 'What payment methods does Samsari accept?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Samsari accepts international credit and debit cards (Visa, Mastercard) processed securely through Stripe. All payments are protected by escrow — your money is held safely until both host and guest confirm the stay.',
              },
            },
            {
              '@type': 'Question',
              name: 'How does identity verification work?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Every host and guest on Samsari must verify their identity using a government-issued ID (CIN or passport) and a selfie before they can book or list a property. This ensures real people behind every listing with accountability built into the platform.',
              },
            },
            {
              '@type': 'Question',
              name: 'Where is Samsari available?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Samsari covers rentals across all 24 Tunisian governorates including Tunis, Hammamet, Sousse, Djerba, Monastir, Bizerte, Tabarka, Sfax, Nabeul, Tozeur, Mahdia, and Kelibia. You can search for apartments, villas, houses, and studios in any city or town in Tunisia.',
              },
            },
            {
              '@type': 'Question',
              name: 'What is Samsari\'s cancellation policy?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Samsari offers a flexible cancellation policy. If you cancel before the check-in deadline, your deposit is fully refunded. Each property listing shows its specific cancellation terms. The escrow system ensures you are never charged without receiving the service.',
              },
            },
            {
              '@type': 'Question',
              name: 'How much does Samsari charge hosts?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Samsari charges hosts a 9% platform commission on each booking. This means hosts keep 91% of their rental income. There are no listing fees, no monthly subscriptions, and no hidden charges.',
              },
            },
            {
              '@type': 'Question',
              name: 'How do I contact Samsari support?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Samsari support is available Monday to Saturday, 9 AM to 6 PM, via WhatsApp and email at support@samsari.tn. Our local team speaks French, Arabic, and English.',
              },
            },
          ],
        },
      ],
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <SearchHero />
        <Suspense fallback={null}>
          <FeaturedPropertiesSection />
          <PopularInCity />
          <DailyPicksSection />
          <HowItWorks />
          <SocialProofSection />
          <EscrowExplainedSection />
          <BrowseDestinations />
          <BecomeHostCTA />
          <ReferralCTA />
          <TrustCenterSection />
          <FAQSection />
          <SeoAuthorityBlock />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
