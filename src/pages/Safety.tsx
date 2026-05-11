import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, CheckCircle, AlertTriangle, Phone, Camera, CreditCard, Clock, Ban, Eye, MessageSquare, Umbrella, Lock, CalendarX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Safety = () => {
  const { t } = useLanguage();
  const safetyFaqs = [
    { question: "How does Samsari verify hosts?", answer: "All hosts must submit government-issued identification (CIN) which is reviewed by our team before they can list any property." },
    { question: "What is escrow-protected payment?", answer: "When you book a property, your payment is held securely by Samsari — not sent directly to the host. Funds are only released after both guest and host confirm check-in and check-out." },
    { question: "What should I do if the property doesn't match the listing?", answer: "Take photos within 5 hours of check-in and report the issue through the app immediately." },
    { question: "Can I pay the host in cash?", answer: "No. All payments must go through Samsari's secure platform." },
    { question: "What happens if I need to cancel my booking?", answer: "Cancellation outcomes depend on timing, check-in confirmation status, and payment stage." },
    { question: "Is my personal information safe on Samsari?", answer: "Yes. Identity documents are used solely for verification purposes and are stored securely." },
  ];

  usePageSEO({
    title: 'Safety & Trust – Samsari | Secure Rentals in Tunisia',
    description: 'Learn about Samsari safety features: identity verification, escrow-protected payments, property verification, and 24/7 support for short-term rentals in Tunisia.',
    canonicalPath: '/safety',
    keywords: 'secure rental Tunisia, safe booking platform Tunisia, avoid rental scams Tunisia, trusted house rental Tunisia',
    breadcrumbs: [
      { name: 'Home', url: 'https://samsari.tech/' },
      { name: 'Safety & Trust', url: 'https://samsari.tech/safety' },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: safetyFaqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  });

  const safetyFeatures = [
    { icon: Shield, title: t('safety.identity_verification'), description: t('safety.identity_verification_desc') },
    { icon: CheckCircle, title: t('safety.property_verification'), description: t('safety.property_verification_desc') },
    { icon: AlertTriangle, title: t('safety.support_247'), description: t('safety.support_247_desc') },
    { icon: Phone, title: t('safety.emergency_contacts'), description: t('safety.emergency_contacts_desc') },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Shield className="h-12 w-12 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">{t('safety.title')}</h1>
            </div>
            <p className="text-lg text-muted-foreground">{t('safety.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {safetyFeatures.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                    <span>{feature.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Guest Responsibilities */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Camera className="h-6 w-6 text-primary" />
                <span>{t('safety.guest_responsibilities')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Camera className="h-5 w-5 text-primary" />
                  <span>{t('safety.take_photos')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.take_photos_1')}</li>
                  <li>{t('safety.take_photos_2')}</li>
                  <li>{t('safety.take_photos_3')}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>{t('safety.no_cash')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.no_cash_1')}</li>
                  <li>{t('safety.no_cash_2')}</li>
                  <li>{t('safety.no_cash_3')}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span>{t('safety.report_issues')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.report_issues_1')}</li>
                  <li>{t('safety.report_issues_2')}</li>
                  <li>{t('safety.report_issues_3')}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Off-Platform Activity Warning */}
          <Card className="mb-8 border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3 text-destructive">
                <Ban className="h-6 w-6" />
                <span>{t('safety.off_platform')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t('safety.off_platform_1')}</li>
                <li>{t('safety.off_platform_2')}</li>
                <li>{t('safety.off_platform_3')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Identity Verification */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-primary" />
                <span>{t('safety.verified_hosts_title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{t('safety.verified_hosts_desc')}</p>
              <p className="text-muted-foreground">{t('safety.verified_hosts_desc_2')}</p>
              <div>
                <h4 className="font-semibold mb-2">{t('safety.verified_practice')}</h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>{t('safety.verified_1')}</li>
                  <li>{t('safety.verified_2')}</li>
                  <li>{t('safety.verified_3')}</li>
                </ul>
              </div>
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> {t('safety.verified_important')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Built-In Protection */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Umbrella className="h-6 w-6 text-primary" />
                <span>{t('safety.protection_title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{t('safety.protection_desc')}</p>
              <p className="text-muted-foreground">{t('safety.protection_desc_2')}</p>
              <Alert className="bg-primary/5 border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>{t('safety.protection_note')}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Escrow Payments */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Lock className="h-6 w-6 text-primary" />
                <span>{t('safety.escrow_title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{t('safety.escrow_desc')}</p>
              <p className="text-muted-foreground">{t('safety.escrow_desc_2')}</p>
              <div>
                <h4 className="font-semibold mb-2">{t('safety.escrow_how')}</h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>{t('safety.escrow_1')}</li>
                  <li>{t('safety.escrow_2')}</li>
                  <li>{t('safety.escrow_3')}</li>
                  <li>{t('safety.escrow_4')}</li>
                </ul>
              </div>
              <Alert className="bg-primary/5 border-primary/20">
                <CreditCard className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <strong>Key requirement:</strong> {t('safety.escrow_key')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Cancellation Rules */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <CalendarX className="h-6 w-6 text-primary" />
                <span>{t('safety.cancellation_title')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{t('safety.cancellation_desc')}</p>
              <p className="text-muted-foreground">{t('safety.cancellation_desc_2')}</p>
              <div>
                <h4 className="font-semibold mb-2">{t('safety.cancellation_affects')}</h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>{t('safety.cancellation_1')}</li>
                  <li>{t('safety.cancellation_2')}</li>
                  <li>{t('safety.cancellation_3')}</li>
                  <li>{t('safety.cancellation_4')}</li>
                </ul>
              </div>
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Transparency:</strong> {t('safety.cancellation_note')}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Host Responsibilities */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-primary" />
                <span>{t('safety.host_responsibilities')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>{t('safety.accurate_listings')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.accurate_1')}</li>
                  <li>{t('safety.accurate_2')}</li>
                  <li>{t('safety.accurate_3')}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <span>{t('safety.respect_privacy')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.respect_1')}</li>
                  <li>{t('safety.respect_2')}</li>
                  <li>{t('safety.respect_3')}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Ban className="h-5 w-5 text-destructive" />
                  <span>{t('safety.no_cash_host')}</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-7">
                  <li>{t('safety.no_cash_host_1')}</li>
                  <li>{t('safety.no_cash_host_2')}</li>
                  <li>{t('safety.no_cash_host_3')}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Trust Tips */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-primary" />
                <span>{t('safety.trust_tips')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t('safety.tip_1')}</li>
                <li>{t('safety.tip_2')}</li>
                <li>{t('safety.tip_3')}</li>
                <li>{t('safety.tip_4')}</li>
                <li>{t('safety.tip_5')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Support Section */}
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <MessageSquare className="h-6 w-6 text-primary" />
                <span>{t('safety.here_for_you')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{t('safety.here_for_you_desc')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                <li>{t('safety.here_1')}</li>
                <li>{t('safety.here_2')}</li>
                <li>{t('safety.here_3')}</li>
              </ul>
              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-2">{t('safety.emergency_contact')}</h4>
                <p className="text-sm"><strong>Email:</strong> support@samsari.tn</p>
                <p className="text-sm"><strong>Phone:</strong> +216 XX XXX XXX</p>
                <p className="text-sm text-muted-foreground">{t('safety.emergency_note')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Safety;
