
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, DollarSign, Users, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useLanguage } from "@/contexts/LanguageContext";

const BecomeHost = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  usePageSEO({
    title: 'Become a Host on Samsari – Earn from Your Property',
    description: 'List your property on Samsari and start earning. Verified hosts, secure payments, and full control over your listings in Tunisia.',
    canonicalPath: '/become-host',
    keywords: 'rent out property Tunisia, list apartment Tunisia, become a host Tunisia, earn from rental Tunisia, louer sa maison Tunisie, mettre appartement en location Tunisie, devenir hôte Tunisie, location saisonnière Tunisie propriétaire, make money renting property Tunisia, passive income rental Tunisia, earn money Airbnb Tunisia',
    breadcrumbs: [
      { name: 'Home', url: 'https://samsari.tech/' },
      { name: 'Become a Host', url: 'https://samsari.tech/become-host' },
    ],
  });

  const benefits = [
    { icon: DollarSign, title: t('become_host.earn_title'), description: t('become_host.earn_desc') },
    { icon: Users, title: t('become_host.meet_title'), description: t('become_host.meet_desc') },
    { icon: Shield, title: t('become_host.protection_title'), description: t('become_host.protection_desc') },
    { icon: Home, title: t('become_host.control_title'), description: t('become_host.control_desc') },
  ];

  const steps = [
    { number: "1", title: t('become_host.step1_title'), description: t('become_host.step1_desc') },
    { number: "2", title: t('become_host.step2_title'), description: t('become_host.step2_desc') },
    { number: "3", title: t('become_host.step3_title'), description: t('become_host.step3_desc') },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        <section className="bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              {t('become_host.title')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('become_host.subtitle')}
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => navigate('/host/onboarding')}>
              {t('become_host.start_hosting')}
            </Button>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">{t('become_host.why_host')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <benefit.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-secondary/10">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">{t('become_host.how_it_works')}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">{t('become_host.ready_title')}</h2>
            <p className="text-lg text-muted-foreground mb-8">{t('become_host.ready_desc')}</p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => navigate('/host/onboarding')}>
              {t('become_host.get_started')}
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BecomeHost;
