import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

export const BrowserNotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  useBrowserNotifications();
  return <>{children}</>;
};
