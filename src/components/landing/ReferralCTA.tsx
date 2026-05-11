import { Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ReferralCTA() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const linkTo = user ? "/profile?tab=rewards" : "/auth";

  return (
    <section className="py-12 sm:py-16 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 sm:p-8 md:p-12">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Gift className="h-3.5 w-3.5" /> Refer & Earn
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 leading-tight">
                {t("rewards.inviteTitle")}
              </h2>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                {t("rewards.inviteSubtitle")}
              </p>
              <Button asChild size="lg">
                <Link to={linkTo}>
                  {user ? "Get my invite link" : "Sign up to start"} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative bg-background border-2 border-primary/30 rounded-2xl p-8 shadow-xl">
                  <Gift className="h-24 w-24 text-primary mx-auto" />
                  <div className="mt-4 text-center">
                    <div className="text-3xl font-bold text-primary">+25 TND</div>
                    <div className="text-xs text-muted-foreground mt-1">For you & your friend</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
