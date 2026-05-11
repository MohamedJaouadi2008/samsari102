
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Menu, X, MessageSquare, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import LanguageSelector from "./LanguageSelector";
import CurrencyToggle from "./CurrencyToggle";
import ProfileDropdown from "./ProfileDropdown";
import NotificationDropdown from "./NotificationDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { usePendingRequests } from "@/hooks/usePendingRequests";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasProperties, setHasProperties] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, markAllAsRead } = useUnreadMessages();
  const { pendingCount } = usePendingRequests();

  useEffect(() => {
    if (user) {
      checkUserProperties();
    } else {
      setHasProperties(false);
    }
  }, [user]);

  const checkUserProperties = async () => {
    if (!user) return;
    
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id);
    
    setHasProperties((count || 0) > 0);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMessagesClick = () => {
    // Mark all messages as read when clicking messages icon
    markAllAsRead();
  };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">Samsari</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-foreground/80 hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/safety" className="text-foreground/80 hover:text-primary transition-colors">
              Safety
            </Link>
            <Link to="/help" className="text-foreground/80 hover:text-primary transition-colors">
              Help
            </Link>
            {hasProperties ? (
              <>
                <Link to="/profile?tab=properties" className="text-foreground/80 hover:text-primary transition-colors">
                  View Properties
                </Link>
                <Link to="/host/onboarding" className="text-foreground/80 hover:text-primary transition-colors">
                  Add New Property
                </Link>
              </>
            ) : (
              <Link to="/become-host" className="text-foreground/80 hover:text-primary transition-colors">
                Become a Host
              </Link>
            )}
          </nav>

          {/* Right side buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <CurrencyToggle />
            <LanguageSelector />
            {user && (
              <>
                {/* Pending Requests Badge (for hosts) */}
                {hasProperties && pendingCount > 0 && (
                  <Link to="/profile?tab=requests" className="relative">
                    <Button variant="ghost" size="icon">
                      <ClipboardList className="h-5 w-5" />
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-5"
                      >
                        {pendingCount}
                      </Badge>
                    </Button>
                  </Link>
                )}
                <Link to="/profile?tab=inbox" className="relative" onClick={handleMessagesClick}>
                  <Button variant="ghost" size="icon">
                    <MessageSquare className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-5"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
                <NotificationDropdown />
              </>
            )}
            {user ? (
              <ProfileDropdown />
            ) : (
              <Button onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border py-4">
            <nav className="flex flex-col space-y-4">
              <Link 
                to="/" 
                className="text-foreground/80 hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/safety" 
                className="text-foreground/80 hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Safety
              </Link>
              <Link 
                to="/help" 
                className="text-foreground/80 hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Help
              </Link>
              {hasProperties ? (
                <>
                  <Link 
                    to="/profile?tab=properties" 
                    className="text-foreground/80 hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    View Properties
                  </Link>
                  <Link 
                    to="/host/onboarding" 
                    className="text-foreground/80 hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Add New Property
                  </Link>
                </>
              ) : (
                <Link 
                  to="/become-host" 
                  className="text-foreground/80 hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Become a Host
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                <CurrencyToggle />
                <LanguageSelector />
                {user && (
                  <>
                    <Link 
                      to="/profile?tab=inbox" 
                      className="relative"
                      onClick={() => {
                        handleMessagesClick();
                        setIsMenuOpen(false);
                      }}
                    >
                      <Button variant="ghost" size="icon">
                        <MessageSquare className="h-5 w-5" />
                        {unreadCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-5"
                          >
                            {unreadCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                    <NotificationDropdown />
                  </>
                )}
                <div className="ml-auto">
                  {user ? (
                    <ProfileDropdown />
                  ) : (
                    <Button 
                      onClick={() => {
                        navigate("/auth");
                        setIsMenuOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                  )}
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
