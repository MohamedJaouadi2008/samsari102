import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import Index from "./pages/Index";
import BetaBadge from "./components/BetaBadge";
import { BrowserNotificationsProvider } from "./components/BrowserNotificationsProvider";
import SupportChatWidget from "./components/SupportChatWidget";

// Lazy-loaded routes for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const PropertyDetails = lazy(() => import("./pages/PropertyDetails"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const HostOnboarding = lazy(() => import("./pages/HostOnboarding"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const Admin = lazy(() => import("./pages/Admin"));
const Help = lazy(() => import("./pages/Help"));
const Safety = lazy(() => import("./pages/Safety"));
const Privacy = lazy(() => import("./pages/Privacy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Payment = lazy(() => import("./pages/Payment"));
const PayRemaining = lazy(() => import("./pages/PayRemaining"));
const PropertyAnalyticsPage = lazy(() => import("./pages/PropertyAnalyticsPage"));
const AdvertiseProperty = lazy(() => import("./pages/AdvertiseProperty"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UserProfilePage = lazy(() => import("./components/UserProfile"));
const Wishlists = lazy(() => import("./pages/Wishlists"));
const WishlistDetail = lazy(() => import("./pages/WishlistDetail"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <CurrencyProvider>
                <ProfileCompletionGuard>
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/p/:shortCode" element={<PropertyDetails />} />
                      <Route path="/property/:id" element={<PropertyDetails />} />
                      <Route path="/booking/:id" element={<BookingConfirmation />} />
                      <Route path="/search" element={<SearchResults />} />
                      <Route path="/host/onboarding" element={<HostOnboarding />} />
                      <Route path="/host/edit-property/:propertyId" element={<HostOnboarding />} />
                      <Route path="/host/property/:propertyId/analytics" element={<PropertyAnalyticsPage />} />
                      <Route path="/advertise/:propertyId" element={<AdvertiseProperty />} />
                      <Route path="/become-host" element={<BecomeHost />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/safety" element={<Safety />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<TermsOfService />} />
                      <Route path="/payment/:bookingId" element={<Payment />} />
                      <Route path="/booking/:bookingId/pay-remaining" element={<PayRemaining />} />
                      <Route path="/user/:userId" element={<UserProfilePage />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/wishlists" element={<Wishlists />} />
                      <Route path="/wishlists/shared/:token" element={<WishlistDetail shared />} />
                      <Route path="/wishlists/:id" element={<WishlistDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  <BrowserNotificationsProvider>
                    <BetaBadge />
                  </BrowserNotificationsProvider>
                  <SupportChatWidget />
                </ProfileCompletionGuard>
              </CurrencyProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
