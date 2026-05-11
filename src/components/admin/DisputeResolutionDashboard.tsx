import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Search,
  Ban,
  Camera,
  Eye,
  Scale,
  XCircle,
  User,
  Home,
  Clock,
  Shield,
  Gavel,
  CreditCard,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface DisputeCase {
  id: string;
  property_title: string;
  property_id: string;
  host_name: string;
  host_id: string;
  host_strikes: number;
  guest_name: string;
  guest_id: string;
  guest_strikes: number;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  deposit_amount: number;
  remaining_payment_amount: number | null;
  status: string;
  escrow_status: string;
  escrow_currency: string;
  host_stripe_account_id: string | null;
  
  // Guest dispute info
  dispute_reason: string | null;
  dispute_filed_by: string | null;
  dispute_opened_at: string | null;
  dispute_evidence: any | null;
  
  // Host damage claim info
  host_reported_damage: boolean;
  host_damage_description: string | null;
  host_damage_photos: any | null;
  
  // Check-in issues
  check_in_issues_reported: boolean;
  check_in_issues_description: string | null;
  check_in_issues_photos: any | null;
}

interface UserStrikeHistory {
  id: string;
  full_name: string;
  avatar_url: string | null;
  host_strikes: number;
  guest_strikes: number;
  warning_count: number;
  is_banned: boolean;
  banned_reason: string | null;
  last_warning_at: string | null;
  last_warning_reason: string | null;
  last_strike_at: string | null;
  strike_reason: string | null;
}

const DisputeResolutionDashboard: React.FC = () => {
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [strikeUsers, setStrikeUsers] = useState<UserStrikeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('disputes');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Evidence viewer dialog
  const [evidenceDialog, setEvidenceDialog] = useState<{
    open: boolean;
    title: string;
    photos: string[];
    description: string;
  }>({
    open: false,
    title: '',
    photos: [],
    description: ''
  });

  // Resolution dialog
  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean;
    dispute: DisputeCase | null;
    action: 'favor_guest' | 'favor_host' | 'split' | 'dismiss' | null;
    hostAmount: string;
    guestRefundAmount: string;
    reason: string;
    strikeHost: boolean;
    strikeGuest: boolean;
    strikeReason: string;
    warnOnly: boolean;
  }>({
    open: false,
    dispute: null,
    action: null,
    hostAmount: '',
    guestRefundAmount: '',
    reason: '',
    strikeHost: false,
    strikeGuest: false,
    strikeReason: '',
    warnOnly: false
  });

  // Strike management dialog
  const [strikeDialog, setStrikeDialog] = useState<{
    open: boolean;
    user: UserStrikeHistory | null;
    action: 'warn' | 'strike_host' | 'strike_guest' | 'ban' | 'unban' | 'clear' | null;
    reason: string;
  }>({
    open: false,
    user: null,
    action: null,
    reason: ''
  });

  // Charge damage dialog
  const [chargeDialog, setChargeDialog] = useState<{
    open: boolean;
    dispute: DisputeCase | null;
    amount: string;
    reason: string;
    loading: boolean;
  }>({
    open: false,
    dispute: null,
    amount: '',
    reason: '',
    loading: false
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    fetchDisputes();
    fetchStrikeUsers();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select(`
          id,
          property_id,
          host_id,
          guest_id,
          check_in_date,
          check_out_date,
          deposit_amount,
          remaining_payment_amount,
          total_price,
          status,
          escrow_status,
          escrow_currency,
          host_stripe_account_id,
          dispute_reason,
          dispute_filed_by,
          dispute_opened_at,
          dispute_evidence,
          host_reported_damage,
          host_damage_description,
          host_damage_photos,
          check_in_issues_reported,
          check_in_issues_description,
          check_in_issues_photos,
          properties (title)
        `)
        .or('status.eq.disputed,host_reported_damage.eq.true,check_in_issues_reported.eq.true')
        .order('dispute_opened_at', { ascending: false, nullsFirst: false });

      if (statusFilter !== 'all') {
        if (statusFilter === 'guest_disputes') {
          query = query.not('dispute_reason', 'is', null);
        } else if (statusFilter === 'host_damage') {
          query = query.eq('host_reported_damage', true);
        } else if (statusFilter === 'check_in_issues') {
          query = query.eq('check_in_issues_reported', true);
        }
      }

      const { data: bookingsData, error } = await query;

      if (error) throw error;

      // Get profiles for hosts and guests
      const userIds = [...new Set([
        ...(bookingsData?.map(b => b.host_id) || []),
        ...(bookingsData?.map(b => b.guest_id) || [])
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, host_strikes, guest_strikes')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedDisputes: DisputeCase[] = bookingsData?.map(b => ({
        id: b.id,
        property_title: (b.properties as any)?.title || 'Property',
        property_id: b.property_id,
        host_name: profileMap.get(b.host_id)?.full_name || 'Unknown',
        host_id: b.host_id,
        host_strikes: profileMap.get(b.host_id)?.host_strikes || 0,
        guest_name: profileMap.get(b.guest_id)?.full_name || 'Unknown',
        guest_id: b.guest_id,
        guest_strikes: profileMap.get(b.guest_id)?.guest_strikes || 0,
        check_in_date: b.check_in_date,
        check_out_date: b.check_out_date,
        deposit_amount: b.deposit_amount || 0,
        remaining_payment_amount: b.remaining_payment_amount,
        total_price: b.total_price,
        status: b.status || 'unknown',
        escrow_status: b.escrow_status || 'pending',
        escrow_currency: b.escrow_currency || 'usd',
        host_stripe_account_id: b.host_stripe_account_id,
        dispute_reason: b.dispute_reason,
        dispute_filed_by: b.dispute_filed_by,
        dispute_opened_at: b.dispute_opened_at,
        dispute_evidence: b.dispute_evidence,
        host_reported_damage: b.host_reported_damage || false,
        host_damage_description: b.host_damage_description,
        host_damage_photos: b.host_damage_photos,
        check_in_issues_reported: b.check_in_issues_reported || false,
        check_in_issues_description: b.check_in_issues_description,
        check_in_issues_photos: b.check_in_issues_photos
      })) || [];

      setDisputes(formattedDisputes);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast({
        title: "Error",
        description: "Failed to load disputes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStrikeUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, host_strikes, guest_strikes, warning_count, is_banned, banned_reason, last_warning_at, last_warning_reason, last_strike_at, strike_reason')
        .or('host_strikes.gt.0,guest_strikes.gt.0,warning_count.gt.0,is_banned.eq.true')
        .order('last_strike_at', { ascending: false, nullsFirst: true });

      if (error) throw error;
      setStrikeUsers(data || []);
    } catch (error) {
      console.error('Error fetching strike users:', error);
    }
  };

  const getTotalAmount = (dispute: DisputeCase) => {
    return (dispute.deposit_amount || 0) + (dispute.remaining_payment_amount || 0);
  };

  const getEvidencePhotos = (evidence: any): string[] => {
    if (!evidence) return [];
    if (Array.isArray(evidence)) {
      return evidence.map(e => typeof e === 'string' ? e : e.url).filter(Boolean);
    }
    if (evidence.photos && Array.isArray(evidence.photos)) {
      return evidence.photos.map((p: any) => typeof p === 'string' ? p : p.url).filter(Boolean);
    }
    return [];
  };

  const openEvidenceViewer = (title: string, photos: any, description: string) => {
    const photoUrls = getEvidencePhotos(photos);
    setEvidenceDialog({
      open: true,
      title,
      photos: photoUrls,
      description: description || 'No description provided'
    });
  };

  const openResolutionDialog = (dispute: DisputeCase, action: 'favor_guest' | 'favor_host' | 'split' | 'dismiss') => {
    const total = getTotalAmount(dispute);
    setResolutionDialog({
      open: true,
      dispute,
      action,
      hostAmount: action === 'favor_host' ? String(total) : action === 'split' ? String(total * 0.5) : '0',
      guestRefundAmount: action === 'favor_guest' ? String(total) : action === 'split' ? String(total * 0.5) : '0',
      reason: '',
      strikeHost: false,
      strikeGuest: false,
      strikeReason: '',
      warnOnly: false
    });
  };

  const handleResolveDispute = async () => {
    if (!resolutionDialog.dispute || !resolutionDialog.action) return;

    try {
      const { dispute, action, hostAmount, guestRefundAmount, reason, strikeHost, strikeGuest, strikeReason, warnOnly } = resolutionDialog;

      // Map action to escrow action
      let escrowAction: 'release' | 'refund_guest' | 'partial_release' = 'release';
      if (action === 'favor_guest') {
        escrowAction = 'refund_guest';
      } else if (action === 'split') {
        escrowAction = 'partial_release';
      }

      // Call the escrow release function
      const { data, error } = await supabase.functions.invoke('admin-release-escrow', {
        body: {
          bookingId: dispute.id,
          action: escrowAction,
          hostAmount: escrowAction === 'partial_release' ? parseFloat(hostAmount) : undefined,
          guestRefundAmount: escrowAction === 'refund_guest' || escrowAction === 'partial_release' 
            ? parseFloat(guestRefundAmount) 
            : undefined,
          reason: `Dispute resolution: ${reason}`,
          strikeHost: strikeHost && !warnOnly,
          strikeGuest: strikeGuest && !warnOnly
        }
      });

      if (error) throw error;

      // Issue warnings if warnOnly mode
      if (warnOnly) {
        if (strikeHost) {
          await supabase
            .from('profiles')
            .update({
              warning_count: (dispute.host_strikes || 0) + 1,
              last_warning_at: new Date().toISOString(),
              last_warning_reason: strikeReason || reason
            })
            .eq('id', dispute.host_id);
        }
        if (strikeGuest) {
          await supabase
            .from('profiles')
            .update({
              warning_count: (dispute.guest_strikes || 0) + 1,
              last_warning_at: new Date().toISOString(),
              last_warning_reason: strikeReason || reason
            })
            .eq('id', dispute.guest_id);
        }
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'settled',
          dispute_resolved_at: new Date().toISOString()
        })
        .eq('id', dispute.id);

      toast({
        title: "Dispute Resolved",
        description: `Decision: ${action.replace('_', ' ')}. ${data?.message || ''}`
      });

      setResolutionDialog({
        open: false,
        dispute: null,
        action: null,
        hostAmount: '',
        guestRefundAmount: '',
        reason: '',
        strikeHost: false,
        strikeGuest: false,
        strikeReason: '',
        warnOnly: false
      });

      fetchDisputes();
      fetchStrikeUsers();
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resolve dispute",
        variant: "destructive"
      });
    }
  };

  const handleStrikeAction = async () => {
    if (!strikeDialog.user || !strikeDialog.action) return;

    try {
      const { user, action, reason } = strikeDialog;
      const now = new Date().toISOString();

      let updateData: any = {};
      let emailType: string | null = null;
      let willBeBanned = false;

      switch (action) {
        case 'warn':
          updateData = {
            warning_count: (user.warning_count || 0) + 1,
            last_warning_at: now,
            last_warning_reason: reason
          };
          emailType = 'warning_issued';
          // Auto-ban at 3 warnings
          if ((user.warning_count || 0) + 1 >= 3) {
            updateData.is_banned = true;
            updateData.banned_at = now;
            updateData.banned_reason = 'Automatic ban: 3 warnings reached. ' + reason;
            willBeBanned = true;
          }
          break;
        case 'strike_host':
          updateData = {
            host_strikes: (user.host_strikes || 0) + 1,
            last_strike_at: now,
            strike_reason: reason
          };
          emailType = 'strike_issued';
          // Auto-ban at 3 strikes
          if ((user.host_strikes || 0) + 1 >= 3) {
            updateData.is_banned = true;
            updateData.banned_at = now;
            updateData.banned_reason = 'Automatic ban: 3 host strikes reached. ' + reason;
            willBeBanned = true;
          }
          break;
        case 'strike_guest':
          updateData = {
            guest_strikes: (user.guest_strikes || 0) + 1,
            last_strike_at: now,
            strike_reason: reason
          };
          emailType = 'strike_issued';
          // Auto-ban at 3 strikes
          if ((user.guest_strikes || 0) + 1 >= 3) {
            updateData.is_banned = true;
            updateData.banned_at = now;
            updateData.banned_reason = 'Automatic ban: 3 guest strikes reached. ' + reason;
            willBeBanned = true;
          }
          break;
        case 'ban':
          updateData = {
            is_banned: true,
            banned_at: now,
            banned_reason: reason
          };
          emailType = 'account_banned';
          break;
        case 'unban':
          updateData = {
            is_banned: false,
            banned_at: null,
            banned_reason: null,
            unbanned_at: now
          };
          emailType = 'account_unbanned';
          break;
        case 'clear':
          updateData = {
            host_strikes: 0,
            guest_strikes: 0,
            warning_count: 0,
            last_warning_at: null,
            last_warning_reason: null,
            last_strike_at: null,
            strike_reason: null
          };
          break;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Send notification email for warnings, strikes, and bans
      if (emailType) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: willBeBanned ? 'account_banned' : emailType,
              userId: user.id,  // Edge function will look up email
              recipientName: user.full_name || 'User',
              reason: willBeBanned ? updateData.banned_reason : reason,
              message: reason
            }
          });
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
          // Don't block the action if email fails
        }
      }
      
      // Create in-app notification for unban
      if (action === 'unban') {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'account_unbanned',
          title: 'Account Reinstated',
          message: 'Your account has been unbanned. Welcome back to Samsari!',
          link: '/profile'
        });
      }

      toast({
        title: "Action Completed",
        description: `${action.replace('_', ' ')} applied successfully`
      });

      setStrikeDialog({ open: false, user: null, action: null, reason: '' });
      fetchStrikeUsers();
    } catch (error: any) {
      console.error('Error performing strike action:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive"
      });
    }
  };

  const handleChargeDamage = async () => {
    if (!chargeDialog.dispute || !chargeDialog.amount || !chargeDialog.reason) return;
    
    setChargeDialog(prev => ({ ...prev, loading: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('charge-damage', {
        body: {
          bookingId: chargeDialog.dispute.id,
          amount: parseFloat(chargeDialog.amount),
          reason: chargeDialog.reason,
          currency: chargeDialog.dispute.escrow_currency || 'usd',
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Damage Charged Successfully",
        description: data?.message || `Charged ${chargeDialog.amount} ${chargeDialog.dispute.escrow_currency?.toUpperCase() || 'USD'} to guest's saved card`,
      });

      setChargeDialog({ open: false, dispute: null, amount: '', reason: '', loading: false });
      fetchDisputes();
    } catch (error: any) {
      console.error('Error charging damage:', error);
      toast({
        title: "Charge Failed",
        description: error.message || "Failed to charge damage. Guest may need to pay manually.",
        variant: "destructive"
      });
    } finally {
      setChargeDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const getDisputeTypeBadge = (dispute: DisputeCase) => {
    const badges = [];
    if (dispute.dispute_reason) {
      badges.push(
        <Badge key="guest" variant="destructive" className="mr-1">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Guest Dispute
        </Badge>
      );
    }
    if (dispute.host_reported_damage) {
      badges.push(
        <Badge key="damage" className="bg-orange-500 mr-1">
          <Home className="w-3 h-3 mr-1" />
          Damage Claim
        </Badge>
      );
    }
    if (dispute.check_in_issues_reported) {
      badges.push(
        <Badge key="checkin" variant="secondary" className="mr-1">
          <Clock className="w-3 h-3 mr-1" />
          Check-in Issue
        </Badge>
      );
    }
    return badges.length > 0 ? badges : <Badge variant="outline">Unknown</Badge>;
  };

  const getStrikeBadge = (strikes: number, type: 'host' | 'guest') => {
    if (strikes === 0) return null;
    const color = strikes >= 3 ? 'bg-red-600' : strikes >= 2 ? 'bg-orange-500' : 'bg-yellow-500';
    return (
      <Badge className={`${color} text-white text-xs`}>
        {strikes} {type} strike{strikes !== 1 ? 's' : ''}
      </Badge>
    );
  };

  const filteredDisputes = disputes.filter(dispute => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      dispute.property_title.toLowerCase().includes(search) ||
      dispute.host_name.toLowerCase().includes(search) ||
      dispute.guest_name.toLowerCase().includes(search) ||
      dispute.id.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Dispute Resolution & Strike Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="disputes" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Active Disputes ({disputes.length})
              </TabsTrigger>
              <TabsTrigger value="strikes" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Strike Records ({strikeUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="disputes">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by property, host, guest, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="guest_disputes">Guest Disputes</SelectItem>
                    <SelectItem value="host_damage">Host Damage Claims</SelectItem>
                    <SelectItem value="check_in_issues">Check-in Issues</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchDisputes}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Disputes</div>
                    <div className="text-2xl font-bold">{disputes.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Guest Disputes</div>
                    <div className="text-2xl font-bold text-destructive">
                      {disputes.filter(d => d.dispute_reason).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Check-in Issues</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {disputes.filter(d => d.check_in_issues_reported).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Damage Claims</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {disputes.filter(d => d.host_reported_damage).length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total at Stake</div>
                    <div className="text-2xl font-bold">
                      ${disputes.reduce((sum, d) => sum + getTotalAmount(d), 0).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Disputes Table */}
              {loading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDisputes.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No disputes found</p>
                    </div>
                  ) : (
                    filteredDisputes.map((dispute) => (
                      <Card key={dispute.id} className="border-l-4 border-l-destructive">
                        <CardContent className="pt-6">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            {/* Left: Dispute Info */}
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getDisputeTypeBadge(dispute)}
                                {dispute.status === 'disputed' && (
                                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending Review
                                  </Badge>
                                )}
                              </div>
                              
                              <div>
                                <h3 className="font-semibold">{dispute.property_title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(dispute.check_in_date), 'MMM d')} - {format(new Date(dispute.check_out_date), 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground mt-1">
                                  {dispute.id}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Host</p>
                                  <p className="font-medium flex items-center gap-2">
                                    {dispute.host_name}
                                    {getStrikeBadge(dispute.host_strikes, 'host')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Guest</p>
                                  <p className="font-medium flex items-center gap-2">
                                    {dispute.guest_name}
                                    {getStrikeBadge(dispute.guest_strikes, 'guest')}
                                  </p>
                                </div>
                              </div>

                              <div className="text-sm">
                                <p className="text-muted-foreground">Amount at Stake</p>
                                <p className="font-semibold text-lg">
                                  ${getTotalAmount(dispute).toFixed(2)} {dispute.escrow_currency.toUpperCase()}
                                </p>
                              </div>
                            </div>

                            {/* Middle: Evidence Section */}
                            <div className="flex-1 space-y-3 border-l border-r px-4">
                              <h4 className="font-medium text-sm">Evidence</h4>
                              
                              {/* Guest Dispute Evidence */}
                              {dispute.dispute_reason && (
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-red-700 dark:text-red-400">Guest Dispute</span>
                                    {getEvidencePhotos(dispute.dispute_evidence).length > 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => openEvidenceViewer(
                                          'Guest Dispute Evidence',
                                          dispute.dispute_evidence,
                                          dispute.dispute_reason || ''
                                        )}
                                      >
                                        <Camera className="w-3 h-3 mr-1" />
                                        {getEvidencePhotos(dispute.dispute_evidence).length} photos
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm line-clamp-2">{dispute.dispute_reason}</p>
                                </div>
                              )}

                              {/* Host Damage Claim */}
                              {dispute.host_reported_damage && (
                                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Host Damage Claim</span>
                                    {getEvidencePhotos(dispute.host_damage_photos).length > 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => openEvidenceViewer(
                                          'Host Damage Evidence',
                                          dispute.host_damage_photos,
                                          dispute.host_damage_description || ''
                                        )}
                                      >
                                        <Camera className="w-3 h-3 mr-1" />
                                        {getEvidencePhotos(dispute.host_damage_photos).length} photos
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm line-clamp-2">{dispute.host_damage_description || 'No description'}</p>
                                </div>
                              )}

                              {/* Check-in Issues */}
                              {dispute.check_in_issues_reported && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Check-in Issues</span>
                                    {getEvidencePhotos(dispute.check_in_issues_photos).length > 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => openEvidenceViewer(
                                          'Check-in Issue Evidence',
                                          dispute.check_in_issues_photos,
                                          dispute.check_in_issues_description || ''
                                        )}
                                      >
                                        <Camera className="w-3 h-3 mr-1" />
                                        {getEvidencePhotos(dispute.check_in_issues_photos).length} photos
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm line-clamp-2">{dispute.check_in_issues_description || 'No description'}</p>
                                </div>
                              )}

                              {!dispute.dispute_reason && !dispute.host_reported_damage && !dispute.check_in_issues_reported && (
                                <p className="text-sm text-muted-foreground">No evidence submitted</p>
                              )}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex flex-col gap-2 min-w-[160px]">
                              <Button
                                size="sm"
                                variant="default"
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={() => openResolutionDialog(dispute, 'favor_host')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Favor Host
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                onClick={() => openResolutionDialog(dispute, 'favor_guest')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Favor Guest
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full"
                                onClick={() => openResolutionDialog(dispute, 'split')}
                              >
                                <Scale className="w-4 h-4 mr-1" />
                                Split 50/50
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => openResolutionDialog(dispute, 'dismiss')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Dismiss
                              </Button>
                              <div className="border-t pt-2 mt-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => setChargeDialog({
                                    open: true,
                                    dispute,
                                    amount: '',
                                    reason: '',
                                    loading: false
                                  })}
                                >
                                  <CreditCard className="w-4 h-4 mr-1" />
                                  Charge Damage
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="strikes">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Users with Strikes/Warnings</h3>
                <Button variant="outline" size="sm" onClick={fetchStrikeUsers}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {strikeUsers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No users with strikes or warnings</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Host Strikes</TableHead>
                        <TableHead>Guest Strikes</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Action</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {strikeUsers.map((user) => (
                        <TableRow key={user.id} className={user.is_banned ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{user.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${user.host_strikes >= 3 ? 'text-red-600' : user.host_strikes > 0 ? 'text-orange-600' : ''}`}>
                                {user.host_strikes || 0}
                              </span>
                              {user.host_strikes >= 3 && <Ban className="w-4 h-4 text-red-600" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${user.guest_strikes >= 3 ? 'text-red-600' : user.guest_strikes > 0 ? 'text-orange-600' : ''}`}>
                                {user.guest_strikes || 0}
                              </span>
                              {user.guest_strikes >= 3 && <Ban className="w-4 h-4 text-red-600" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${user.warning_count > 0 ? 'text-yellow-600' : ''}`}>
                              {user.warning_count || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.is_banned ? (
                              <Badge variant="destructive">
                                <Ban className="w-3 h-3 mr-1" />
                                Banned
                              </Badge>
                            ) : (
                              <Badge variant="outline">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.last_strike_at ? (
                              <div className="text-xs">
                                <p>{format(new Date(user.last_strike_at), 'MMM d, yyyy')}</p>
                                <p className="text-muted-foreground truncate max-w-[150px]" title={user.strike_reason || ''}>
                                  {user.strike_reason || 'No reason'}
                                </p>
                              </div>
                            ) : user.last_warning_at ? (
                              <div className="text-xs">
                                <p>{format(new Date(user.last_warning_at), 'MMM d, yyyy')}</p>
                                <p className="text-muted-foreground truncate max-w-[150px]" title={user.last_warning_reason || ''}>
                                  {user.last_warning_reason || 'No reason'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {currentUserId === user.id ? (
                                <span className="text-xs text-muted-foreground italic">You</span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => setStrikeDialog({
                                      open: true,
                                      user,
                                      action: 'warn',
                                      reason: ''
                                    })}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => setStrikeDialog({
                                      open: true,
                                      user,
                                      action: 'strike_host',
                                      reason: ''
                                    })}
                                  >
                                    +H
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => setStrikeDialog({
                                      open: true,
                                      user,
                                      action: 'strike_guest',
                                      reason: ''
                                    })}
                                  >
                                    +G
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={user.is_banned ? "default" : "destructive"}
                                    className="h-7 px-2"
                                    onClick={() => setStrikeDialog({
                                      open: true,
                                      user,
                                      action: user.is_banned ? 'unban' : 'ban',
                                      reason: ''
                                    })}
                                  >
                                    <Ban className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Evidence Viewer Dialog */}
      <Dialog open={evidenceDialog.open} onOpenChange={(open) => setEvidenceDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {evidenceDialog.title}
            </DialogTitle>
            <DialogDescription>
              Review the submitted photo evidence
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">Description</p>
              <p className="text-sm">{evidenceDialog.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {evidenceDialog.photos.map((photo, index) => (
                <a
                  key={index}
                  href={photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-video relative rounded-lg overflow-hidden border hover:ring-2 ring-primary transition-all"
                >
                  <img
                    src={photo}
                    alt={`Evidence ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 hover:opacity-100" />
                  </div>
                </a>
              ))}
            </div>

            {evidenceDialog.photos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No photos available</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog(prev => ({ ...prev, open: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialog.open} onOpenChange={(open) => setResolutionDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolutionDialog.action === 'favor_host' && 'Resolve in Favor of Host'}
              {resolutionDialog.action === 'favor_guest' && 'Resolve in Favor of Guest'}
              {resolutionDialog.action === 'split' && 'Split Payment 50/50'}
              {resolutionDialog.action === 'dismiss' && 'Dismiss Dispute'}
            </DialogTitle>
            <DialogDescription>
              {resolutionDialog.dispute && (
                <span>
                  Total amount: ${getTotalAmount(resolutionDialog.dispute).toFixed(2)} {resolutionDialog.dispute.escrow_currency.toUpperCase()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {resolutionDialog.action === 'split' && (
              <>
                <div className="space-y-2">
                  <Label>Amount to Host</Label>
                  <Input
                    type="number"
                    value={resolutionDialog.hostAmount}
                    onChange={(e) => setResolutionDialog(prev => ({ ...prev, hostAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Platform fee will be deducted</p>
                </div>
                <div className="space-y-2">
                  <Label>Refund to Guest</Label>
                  <Input
                    type="number"
                    value={resolutionDialog.guestRefundAmount}
                    onChange={(e) => setResolutionDialog(prev => ({ ...prev, guestRefundAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Resolution Reason *</Label>
              <Textarea
                value={resolutionDialog.reason}
                onChange={(e) => setResolutionDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain the reason for this decision..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Issue Strikes/Warnings</p>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="warn-only"
                  checked={resolutionDialog.warnOnly}
                  onCheckedChange={(checked) => 
                    setResolutionDialog(prev => ({ ...prev, warnOnly: checked === true }))
                  }
                />
                <Label htmlFor="warn-only" className="text-sm font-normal">
                  Issue warning only (no strike)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="strike-host"
                  checked={resolutionDialog.strikeHost}
                  onCheckedChange={(checked) => 
                    setResolutionDialog(prev => ({ ...prev, strikeHost: checked === true }))
                  }
                />
                <Label htmlFor="strike-host" className="text-sm font-normal flex items-center gap-1">
                  <Ban className="h-3 w-3 text-destructive" />
                  {resolutionDialog.warnOnly ? 'Warn' : 'Strike'} Host (fake damage claim)
                  {resolutionDialog.dispute && resolutionDialog.dispute.host_strikes >= 2 && !resolutionDialog.warnOnly && (
                    <Badge variant="destructive" className="text-xs ml-1">Will ban</Badge>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="strike-guest"
                  checked={resolutionDialog.strikeGuest}
                  onCheckedChange={(checked) => 
                    setResolutionDialog(prev => ({ ...prev, strikeGuest: checked === true }))
                  }
                />
                <Label htmlFor="strike-guest" className="text-sm font-normal flex items-center gap-1">
                  <Ban className="h-3 w-3 text-destructive" />
                  {resolutionDialog.warnOnly ? 'Warn' : 'Strike'} Guest (fake dispute)
                  {resolutionDialog.dispute && resolutionDialog.dispute.guest_strikes >= 2 && !resolutionDialog.warnOnly && (
                    <Badge variant="destructive" className="text-xs ml-1">Will ban</Badge>
                  )}
                </Label>
              </div>

              {(resolutionDialog.strikeHost || resolutionDialog.strikeGuest) && (
                <div className="space-y-2 mt-2">
                  <Label>Strike/Warning Reason</Label>
                  <Input
                    value={resolutionDialog.strikeReason}
                    onChange={(e) => setResolutionDialog(prev => ({ ...prev, strikeReason: e.target.value }))}
                    placeholder="Reason for the strike/warning..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Validation Warnings */}
          {resolutionDialog.reason.trim().length < 20 && (
            <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
              ⚠️ Resolution reason must be at least 20 characters
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setResolutionDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResolveDispute}
              variant={resolutionDialog.action === 'favor_guest' ? 'default' : 'default'}
              disabled={resolutionDialog.reason.trim().length < 20}
            >
              <Gavel className="w-4 h-4 mr-2" />
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Strike Management Dialog */}
      <Dialog open={strikeDialog.open} onOpenChange={(open) => setStrikeDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {strikeDialog.action === 'warn' && 'Issue Warning'}
              {strikeDialog.action === 'strike_host' && 'Issue Host Strike'}
              {strikeDialog.action === 'strike_guest' && 'Issue Guest Strike'}
              {strikeDialog.action === 'ban' && 'Ban User'}
              {strikeDialog.action === 'unban' && 'Unban User'}
              {strikeDialog.action === 'clear' && 'Clear All Strikes'}
            </DialogTitle>
            <DialogDescription>
              {strikeDialog.user && (
                <span>
                  User: {strikeDialog.user.full_name} 
                  {strikeDialog.action === 'strike_host' && strikeDialog.user.host_strikes >= 2 && (
                    <span className="text-destructive font-medium"> - This will result in automatic ban!</span>
                  )}
                  {strikeDialog.action === 'strike_guest' && strikeDialog.user.guest_strikes >= 2 && (
                    <span className="text-destructive font-medium"> - This will result in automatic ban!</span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {strikeDialog.user && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-muted-foreground">Host Strikes</p>
                    <p className="font-bold text-lg">{strikeDialog.user.host_strikes || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Guest Strikes</p>
                    <p className="font-bold text-lg">{strikeDialog.user.guest_strikes || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Warnings</p>
                    <p className="font-bold text-lg">{strikeDialog.user.warning_count || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {strikeDialog.action !== 'clear' && strikeDialog.action !== 'unban' && (
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Textarea
                  value={strikeDialog.reason}
                  onChange={(e) => setStrikeDialog(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Enter the reason for this action..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            {strikeDialog.action === 'clear' && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  This will clear all host strikes, guest strikes, and warnings for this user. This action should only be used in exceptional circumstances.
                </p>
              </div>
            )}
          </div>

          {/* Validation */}
          {strikeDialog.action !== 'clear' && strikeDialog.action !== 'unban' && strikeDialog.reason.trim().length < 10 && (
            <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
              ⚠️ Reason must be at least 10 characters
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setStrikeDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStrikeAction}
              variant={strikeDialog.action === 'ban' || strikeDialog.action === 'strike_host' || strikeDialog.action === 'strike_guest' ? 'destructive' : 'default'}
              disabled={
                strikeDialog.action !== 'clear' && 
                strikeDialog.action !== 'unban' && 
                strikeDialog.reason.trim().length < 10
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charge Damage Dialog */}
      <Dialog open={chargeDialog.open} onOpenChange={(open) => setChargeDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Charge Guest for Damage
            </DialogTitle>
            <DialogDescription>
              {chargeDialog.dispute && (
                <span>
                  Auto-charge the guest's saved card for verified damage on booking {chargeDialog.dispute.id.slice(0, 8)}...
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">⚠️ Important</p>
              <p>This will immediately charge the guest's saved payment method. Make sure you have reviewed all evidence and the damage claim is verified.</p>
              <p className="mt-1">If the card requires 3D Secure authentication, the guest will be notified to pay manually.</p>
            </div>

            <div className="space-y-2">
              <Label>Damage Amount ({chargeDialog.dispute?.escrow_currency?.toUpperCase() || 'USD'})</Label>
              <Input
                type="number"
                step="0.01"
                min="0.50"
                value={chargeDialog.amount}
                onChange={(e) => setChargeDialog(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Reason for Charge *</Label>
              <Textarea
                value={chargeDialog.reason}
                onChange={(e) => setChargeDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Describe the verified damage and evidence..."
                className="min-h-[80px]"
              />
            </div>

            {chargeDialog.dispute?.host_damage_description && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Host's Damage Description:</p>
                <p className="text-muted-foreground">{chargeDialog.dispute.host_damage_description}</p>
              </div>
            )}
          </div>

          {chargeDialog.reason.trim().length < 10 && (
            <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
              ⚠️ Reason must be at least 10 characters
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setChargeDialog(prev => ({ ...prev, open: false }))}
              disabled={chargeDialog.loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleChargeDamage}
              variant="destructive"
              disabled={
                chargeDialog.loading || 
                !chargeDialog.amount || 
                parseFloat(chargeDialog.amount) < 0.50 ||
                chargeDialog.reason.trim().length < 10
              }
            >
              {chargeDialog.loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {chargeDialog.loading ? 'Charging...' : `Charge ${chargeDialog.amount ? parseFloat(chargeDialog.amount).toFixed(2) : '0.00'} ${chargeDialog.dispute?.escrow_currency?.toUpperCase() || 'USD'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisputeResolutionDashboard;
