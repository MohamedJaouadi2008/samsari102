
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useLanguage } from "@/contexts/LanguageContext";

const TermsOfService = () => {
  const { t } = useLanguage();

  usePageSEO({
    title: 'Terms of Service – Samsari',
    description: 'Terms and conditions for using Samsari, the secure short-term rental platform in Tunisia.',
    canonicalPath: '/terms',
  });

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {t('terms.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('terms.last_updated')}
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section1_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('terms.section1_content')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section2_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('terms.section2_content')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section3_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">{t('terms.hosts_must')}</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>{t('terms.host_1')}</li>
                      <li>{t('terms.host_2')}</li>
                      <li>{t('terms.host_3')}</li>
                      <li>{t('terms.host_4')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('terms.guests_must')}</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>{t('terms.guest_1')}</li>
                      <li>{t('terms.guest_2')}</li>
                      <li>{t('terms.guest_3')}</li>
                      <li>{t('terms.guest_4')}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section4_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('terms.section4_content')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section5_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('terms.section5_content')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('terms.section6_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('terms.section6_content')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
