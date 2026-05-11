
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, Lock, Trash2, Users, Globe, Mail, Phone } from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useLanguage } from "@/contexts/LanguageContext";

const Privacy = () => {
  const { t } = useLanguage();

  usePageSEO({
    title: 'Privacy Policy – Samsari',
    description: 'How Samsari collects, uses, and protects your personal data. Compliant with Tunisian data protection law.',
    canonicalPath: '/privacy',
  });

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t('privacy.title')}</h1>
            <p className="text-xl text-muted-foreground">{t('privacy.subtitle')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('privacy.last_updated')} {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <span>{t('privacy.info_collect')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{t('privacy.personal_info')}</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('privacy.personal_1')}</li>
                    <li>{t('privacy.personal_2')}</li>
                    <li>{t('privacy.personal_3')}</li>
                    <li>{t('privacy.personal_4')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('privacy.usage_info')}</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('privacy.usage_1')}</li>
                    <li>{t('privacy.usage_2')}</li>
                    <li>{t('privacy.usage_3')}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-6 w-6 text-primary" />
                  <span>{t('privacy.how_use')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.account_mgmt')}</strong> {t('privacy.account_mgmt_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.safety_verification')}</strong> {t('privacy.safety_verification_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.service_improvement')}</strong> {t('privacy.service_improvement_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.communication')}</strong> {t('privacy.communication_desc')}</div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-6 w-6 text-primary" />
                  <span>{t('privacy.id_verification')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h3 className="font-semibold text-primary mb-2">{t('privacy.legal_compliance')}</h3>
                  <p className="text-sm text-muted-foreground">{t('privacy.legal_desc')}</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.purpose_limitation')}</strong> {t('privacy.purpose_limitation_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.secure_storage')}</strong> {t('privacy.secure_storage_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.auto_deletion')}</strong> {t('privacy.auto_deletion_desc')}</div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div><strong>{t('privacy.no_display')}</strong> {t('privacy.no_display_desc')}</div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-6 w-6 text-primary" />
                  <span>{t('privacy.info_sharing')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">{t('privacy.sharing_when')}</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>{t('privacy.sharing_1')}</li>
                    <li>{t('privacy.sharing_2')}</li>
                    <li>{t('privacy.sharing_3')}</li>
                    <li>{t('privacy.sharing_4')}</li>
                  </ul>
                </div>
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-destructive font-semibold">{t('privacy.no_sell')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trash2 className="h-6 w-6 text-destructive" />
                  <span>{t('privacy.retention')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">{t('privacy.retention_periods')}</h3>
                    <ul className="space-y-2">
                      <li className="flex justify-between items-center p-2 bg-muted rounded">
                        <span>{t('privacy.retention_id')}</span>
                        <span className="font-semibold text-destructive">{t('privacy.retention_id_time')}</span>
                      </li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded">
                        <span>{t('privacy.retention_account')}</span>
                        <span className="font-semibold">{t('privacy.retention_account_time')}</span>
                      </li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded">
                        <span>{t('privacy.retention_booking')}</span>
                        <span className="font-semibold">{t('privacy.retention_booking_time')}</span>
                      </li>
                      <li className="flex justify-between items-center p-2 bg-muted rounded">
                        <span>{t('privacy.retention_comms')}</span>
                        <span className="font-semibold">{t('privacy.retention_comms_time')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-6 w-6 text-primary" />
                  <span>{t('privacy.your_rights')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">{t('privacy.access_portability')}</h3>
                    <p className="text-sm text-muted-foreground">{t('privacy.access_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{t('privacy.rectification')}</h3>
                    <p className="text-sm text-muted-foreground">{t('privacy.rectification_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{t('privacy.deletion')}</h3>
                    <p className="text-sm text-muted-foreground">{t('privacy.deletion_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{t('privacy.objection')}</h3>
                    <p className="text-sm text-muted-foreground">{t('privacy.objection_desc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-6 w-6 text-primary" />
                  <span>{t('privacy.contact')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">{t('privacy.contact_desc')}</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">Email</p>
                        <p className="text-sm text-muted-foreground">privacy@samsari.tn</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">Phone</p>
                        <p className="text-sm text-muted-foreground">+216 XX XXX XXX</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm"><strong>Response Time:</strong> {t('privacy.response_time')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
