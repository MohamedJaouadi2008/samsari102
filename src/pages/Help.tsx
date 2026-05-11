
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageCircle, Phone, Mail, Clock } from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useLanguage } from "@/contexts/LanguageContext";

const Help = () => {
  const { t } = useLanguage();

  const faqs = [
    { question: t('help.faq_1_q'), answer: t('help.faq_1_a') },
    { question: t('help.faq_2_q'), answer: t('help.faq_2_a') },
    { question: t('help.faq_3_q'), answer: t('help.faq_3_a') },
    { question: t('help.faq_4_q'), answer: t('help.faq_4_a') },
    { question: t('help.faq_5_q'), answer: t('help.faq_5_a') },
    { question: t('help.faq_6_q'), answer: t('help.faq_6_a') },
    { question: t('help.faq_7_q'), answer: t('help.faq_7_a') },
    { question: t('help.faq_8_q'), answer: t('help.faq_8_a') },
  ];

  usePageSEO({
    title: 'Help Center – Samsari | FAQ & Support',
    description: 'Get answers to common questions about booking, hosting, payments, and safety on Samsari. Rent in Tunisia with confidence.',
    canonicalPath: '/help',
    keywords: 'how to book on Samsari, rental booking Tunisia, Samsari customer support, vacation rental FAQ Tunisia, secure booking Tunisia, paiement location Tunisie, réservation logement Tunisie',
    breadcrumbs: [
      { name: 'Home', url: 'https://samsari.tech/' },
      { name: 'Help Center', url: 'https://samsari.tech/help' },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {t('help.title')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('help.subtitle')}
            </p>
          </div>

          {/* Contact Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
              // Dispatch a custom event to open the support chat widget
              window.dispatchEvent(new CustomEvent('open-support-chat'));
            }}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <MessageCircle className="h-6 w-6 text-primary" />
                  <span>{t('help.live_chat')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {t('help.live_chat_desc')}
                </p>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{t('help.available_hours')}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <Mail className="h-6 w-6 text-primary" />
                  <span>{t('help.email_support')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {t('help.email_desc')}
                </p>
                <p className="text-sm font-medium">{t('help.email_address')}</p>
                <p className="text-sm text-muted-foreground">{t('help.response_time')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <Phone className="h-6 w-6 text-primary" />
                  <span>{t('help.phone_support')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {t('help.phone_desc')}
                </p>
                <p className="text-sm font-medium">+216 XX XXX XXX</p>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>9 AM - 6 PM</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('help.faq_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="mt-12 text-center">
            <h3 className="text-xl font-semibold mb-6">{t('help.quick_links')}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/safety" className="text-primary hover:underline">{t('help.safety_guidelines')}</a>
              <a href="/terms" className="text-primary hover:underline">{t('help.terms')}</a>
              <a href="/privacy" className="text-primary hover:underline">{t('help.privacy')}</a>
              <a href="/become-host" className="text-primary hover:underline">{t('help.become_host')}</a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Help;
