import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  ClipboardList, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  Home, 
  AlertCircle,
  MessageSquare 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from 'date-fns';

const NotificationDropdown = () => {
  const { user } = useAuth();
  const { notificationCount, notifications, loading, markAsRead, markAllAsRead } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_booking_request':
      case 'reservation_request':
        return <ClipboardList className="h-4 w-4 text-blue-500" />;
      case 'booking_confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'booking_declined':
      case 'booking_cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'payment_required':
      case 'deposit_received':
      case 'payment_released':
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      case 'checked_in':
      case 'checked_out':
        return <Home className="h-4 w-4 text-green-500" />;
      case 'dispute_opened':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'settlement_pending':
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-5"
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <div className="p-2 flex justify-between items-center">
          <h3 className="font-medium">Notifications</h3>
          {notificationCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-auto py-1"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2"></div>
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No notifications yet
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                asChild 
                className="p-0 focus:bg-transparent"
              >
                <Link 
                  to={notification.link || '/profile?tab=reservations'} 
                  className={`flex items-start space-x-3 p-3 hover:bg-muted transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></div>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link 
            to="/profile?tab=reservations" 
            className="flex items-center justify-center p-2 text-sm"
          >
            View All Reservations
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
