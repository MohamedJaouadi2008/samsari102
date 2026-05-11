import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import ArrivalInstructionsForm from "./ArrivalInstructionsForm";

interface HostWelcomeMessageProps {
  data: any;
  onUpdate: (data: any) => void;
}

const HostWelcomeMessage = ({ data, onUpdate }: HostWelcomeMessageProps) => {
  const defaultMessage = `Welcome to ${data.city || 'our beautiful location'} where the past & future mix & mingle! A traveler myself, I love interacting and I'd be happy to host & guide you through some local stuff! Let me know if you have any questions.`;

  const handleMessageChange = (value: string) => {
    onUpdate({ welcome_message: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Welcome Message for Guests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">Your Welcome Message</Label>
            <Textarea
              id="welcome-message"
              value={data.welcome_message || ""}
              onChange={(e) => handleMessageChange(e.target.value)}
              placeholder={defaultMessage}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be shown to guests on the booking confirmation page.
              Keep it friendly and informative to help guests feel welcome.
            </p>
          </div>
        </CardContent>
      </Card>

      <ArrivalInstructionsForm data={data} onUpdate={onUpdate} />
    </div>
  );
};

export default HostWelcomeMessage;

