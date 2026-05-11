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
  DollarSign, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Search,
  Ban,
  History,
  Clock,
  Play,
  AlertCircle,
  Zap,
  Send,
  Wallet,
  ArrowDownToLine
} from 'lucide-react';
import { format } from 'date-fns';

interface EscrowBooking {
  id: string;
  property_title: string;
  host_name: string;
  host_id: string;
  guest_name: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  deposit_amount: number;
  remaining_payment_amount: number | null;
  total_price: number;
  status: string;
  escrow_status: string;
  escrow_currency: string;
  host_stripe_account_id: string | null;
  dispute_reason: string | null;
  dispute_filed_by: string | null;
  settlement_due_at: string | null;
  host_reported_damage: boolean;
  host_damage_description: string | null;
}

interface AuditLogEntry {
  id: string;
  booking_id: string;
  action_type: string;
  action_reason: string;
  triggered_by: string;
  previous_status: string | null;
  new_status: string | null;
  previous_escrow_status: string | null;
  new_escrow_status: string | null;
  amount_affected: number | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  metadata: any;
  created_at: string;
}

const EscrowDashboard: React.FC = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<EscrowBooking[]>([]);
  const [stuckBookings, setStuckBookings] = useState<EscrowBooking[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stuckLoading, setStuckLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);
  const [lastCronRun, setLastCronRun] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('bookings');
  
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    booking: EscrowBooking | null;
    action: 'release' | 'refund_guest' | 'partial_release' | null;
    hostAmount: string;
    guestRefundAmount: string;
    reason: string;
    strikeHost: boolean;
    strikeGuest: boolean;
  }>({
    open: false,
    booking: null,
    action: null,
    hostAmount: '',
    guestRefundAmount: '',
    reason: '',
    strikeHost: false,
    strikeGuest: false
  });

  useEffect(() => {
    fetchEscrowBookings();
    fetchStuckBookings();
    fetchLastCronRun();
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
    if (activeTab === 'stuck') {
      fetchStuckBookings();
    }
  }, [activeTab]);

  const fetchEscrowBookings = async () => {
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
          settlement_due_at,
          host_reported_damage,
          host_damage_description,
          properties (title)
        `)
        .in('escrow_status', ['pending', 'held', 'disputed', 'ready_for_release', 'forfeited_split_pending', 'forfeited_pending_release', 'pending_manual_payout', 'release_pending_host_setup', 'pending_refund'])
        .order('check_out_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('escrow_status', statusFilter);
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
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedBookings: EscrowBooking[] = bookingsData?.map(b => ({
        id: b.id,
        property_title: (b.properties as any)?.title || 'Property',
        host_name: profileMap.get(b.host_id)?.full_name || 'Unknown',
        host_id: b.host_id,
        guest_name: profileMap.get(b.guest_id)?.full_name || 'Unknown',
        guest_id: b.guest_id,
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
        settlement_due_at: b.settlement_due_at,
        host_reported_damage: b.host_reported_damage || false,
        host_damage_description: b.host_damage_description
      })) || [];

      setBookings(formattedBookings);
    } catch (error) {
      console.error('Error fetching escrow bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load escrow bookings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('escrow_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive"
      });
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch bookings in STUCK states that need admin intervention
  const fetchStuckBookings = async () => {
    setStuckLoading(true);
    try {
      const { data: bookingsData, error } = await supabase
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
          settlement_due_at,
          host_reported_damage,
          host_damage_description,
          auto_action_taken,
          properties (title)
        `)
        .in('escrow_status', ['release_pending_host_setup', 'forfeited_split_pending', 'pending_manual_payout', 'pending_refund'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles
      const userIds = [...new Set([
        ...(bookingsData?.map(b => b.host_id) || []),
        ...(bookingsData?.map(b => b.guest_id) || [])
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, stripe_account_id, stripe_onboarding_complete')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedBookings: EscrowBooking[] = bookingsData?.map(b => ({
        id: b.id,
        property_title: (b.properties as any)?.title || 'Property',
        host_name: profileMap.get(b.host_id)?.full_name || 'Unknown',
        host_id: b.host_id,
        guest_name: profileMap.get(b.guest_id)?.full_name || 'Unknown',
        guest_id: b.guest_id,
        check_in_date: b.check_in_date,
        check_out_date: b.check_out_date,
        deposit_amount: b.deposit_amount || 0,
        remaining_payment_amount: b.remaining_payment_amount,
        total_price: b.total_price,
        status: b.status || 'unknown',
        escrow_status: b.escrow_status || 'pending',
        escrow_currency: b.escrow_currency || 'usd',
        host_stripe_account_id: profileMap.get(b.host_id)?.stripe_account_id || null,
        dispute_reason: b.dispute_reason,
        dispute_filed_by: b.dispute_filed_by,
        settlement_due_at: b.settlement_due_at,
        host_reported_damage: b.host_reported_damage || false,
        host_damage_description: b.host_damage_description
      })) || [];

      setStuckBookings(formattedBookings);
    } catch (error) {
      console.error('Error fetching stuck bookings:', error);
    } finally {
      setStuckLoading(false);
    }
  };

  // Fetch last cron run time from audit log
  const fetchLastCronRun = async () => {
    try {
      const { data, error } = await supabase
        .from('escrow_audit_log')
        .select('created_at')
        .eq('triggered_by', 'cron')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setLastCronRun(data[0].created_at);
      }
    } catch (error) {
      console.error('Error fetching last cron run:', error);
    }
  };

  // Manually trigger the escrow cron job
  const handleTriggerCron = async () => {
    setCronRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('escrow-deadline-cron', {
        headers: {
          'X-Cron-Secret': 'admin-manual-trigger' // This will fail auth - need proper implementation
        }
      });

      // The cron function requires X-Cron-Secret header which we don't have access to from frontend
      // This is a placeholder - in production, we'd need a separate admin endpoint
      toast({
        title: "Cron Trigger Attempted",
        description: "Check edge function logs for results. Note: Manual trigger requires CRON_SECRET.",
        variant: "default"
      });

      fetchLastCronRun();
      fetchEscrowBookings();
      fetchStuckBookings();
    } catch (error: any) {
      console.error('Error triggering cron:', error);
      toast({
        title: "Info",
        description: "Cron trigger requires proper authentication. Check Supabase logs.",
        variant: "default"
      });
    } finally {
      setCronRunning(false);
    }
  };

  // Force release for stuck bookings (admin override)
  const handleForceRelease = async (booking: EscrowBooking) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-release-escrow', {
        body: {
          bookingId: booking.id,
          action: 'release',
          reason: 'Admin force release - resolving stuck state: ' + booking.escrow_status,
          adminOverride: true
        }
      });

      if (error) throw error;

      toast({
        title: "Force Release Successful",
        description: data.message || "Booking has been force-released"
      });

      fetchEscrowBookings();
      fetchStuckBookings();
    } catch (error: any) {
      console.error('Error force releasing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to force release",
        variant: "destructive"
      });
    }
  };

  const handleEscrowAction = async () => {
    if (!actionDialog.booking || !actionDialog.action) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-release-escrow', {
        body: {
          bookingId: actionDialog.booking.id,
          action: actionDialog.action,
          hostAmount: actionDialog.action === 'partial_release' ? parseFloat(actionDialog.hostAmount) : undefined,
          guestRefundAmount: actionDialog.action === 'partial_release' || actionDialog.action === 'refund_guest' 
            ? parseFloat(actionDialog.guestRefundAmount) 
            : undefined,
          reason: actionDialog.reason,
          strikeHost: actionDialog.strikeHost,
          strikeGuest: actionDialog.strikeGuest
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: data.message
      });

      setActionDialog({
        open: false,
        booking: null,
        action: null,
        hostAmount: '',
        guestRefundAmount: '',
        reason: '',
        strikeHost: false,
        strikeGuest: false
      });

      fetchEscrowBookings();
    } catch (error: any) {
      console.error('Error performing escrow action:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive"
      });
    }
  };

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'held':
        return <Badge variant="default" className="bg-blue-600"><Lock className="w-3 h-3 mr-1" />Held</Badge>;
      case 'disputed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Disputed</Badge>;
      case 'ready_for_release':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'released':
        return <Badge variant="outline"><Unlock className="w-3 h-3 mr-1" />Released</Badge>;
      case 'forfeited_split_pending':
        return <Badge className="bg-orange-500"><AlertTriangle className="w-3 h-3 mr-1" />Split Pending</Badge>;
      case 'forfeited_pending_release':
        return <Badge className="bg-amber-600"><Clock className="w-3 h-3 mr-1" />Forfeit Pending</Badge>;
      case 'release_pending_host_setup':
        return <Badge className="bg-red-600"><AlertCircle className="w-3 h-3 mr-1" />Host No Stripe</Badge>;
      case 'pending_manual_payout':
        return <Badge className="bg-purple-600"><AlertCircle className="w-3 h-3 mr-1" />Manual Payout</Badge>;
      case 'pending_refund':
        return <Badge className="bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Pending Refund</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTotalEscrowAmount = (booking: EscrowBooking) => {
    return (booking.deposit_amount || 0) + (booking.remaining_payment_amount || 0);
  };

  const filteredBookings = bookings.filter(booking => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      booking.property_title.toLowerCase().includes(search) ||
      booking.host_name.toLowerCase().includes(search) ||
      booking.guest_name.toLowerCase().includes(search) ||
      booking.id.toLowerCase().includes(search)
    );
  });

  const openActionDialog = (booking: EscrowBooking, action: 'release' | 'refund_guest' | 'partial_release') => {
    const totalAmount = getTotalEscrowAmount(booking);
    setActionDialog({
      open: true,
      booking,
      action,
      hostAmount: action === 'partial_release' ? String(totalAmount * 0.5) : '',
      guestRefundAmount: action === 'refund_guest' ? String(totalAmount) : '',
      reason: '',
      strikeHost: false,
      strikeGuest: false
    });
  };

  const getAuditActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'auto_cancel':
        return <Badge variant="destructive">Auto-Cancel</Badge>;
      case 'auto_release':
        return <Badge className="bg-green-600">Auto-Release</Badge>;
      case 'auto_dispute':
        return <Badge variant="destructive">Auto-Dispute</Badge>;
      case 'auto_forfeit':
        return <Badge className="bg-orange-600">Auto-Forfeit</Badge>;
      case 'auto_forfeit_split':
        return <Badge className="bg-orange-500">Auto-Split 50/50</Badge>;
      case 'auto_release_blocked':
        return <Badge variant="outline">Release Blocked</Badge>;
      case 'admin_override':
        return <Badge className="bg-blue-600">Admin Override</Badge>;
      default:
        return <Badge variant="outline">{actionType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Escrow Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="bookings" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Active Escrow ({bookings.length})
              </TabsTrigger>
              <TabsTrigger value="stuck" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Stuck States ({stuckBookings.length})
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>

            {/* Cron Control Panel */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">Cron Status</span>
                  </div>
                  {lastCronRun ? (
                    <span className="text-sm text-muted-foreground">
                      Last run: {format(new Date(lastCronRun), 'MMM d, HH:mm:ss')}
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">No recent cron activity detected</span>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleTriggerCron}
                  disabled={cronRunning}
                >
                  {cronRunning ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Trigger Cron Now
                </Button>
              </div>
            </div>

            <TabsContent value="bookings">
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
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="ready_for_release">Ready for Release</SelectItem>
                <SelectItem value="forfeited_split_pending">Split Pending (50/50)</SelectItem>
                <SelectItem value="forfeited_pending_release">Forfeit Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchEscrowBookings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total in Escrow</div>
                <div className="text-2xl font-bold">
                  ${bookings.reduce((sum, b) => sum + getTotalEscrowAmount(b), 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Held</div>
                <div className="text-2xl font-bold text-blue-600">
                  {bookings.filter(b => b.escrow_status === 'held').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Disputed</div>
                <div className="text-2xl font-bold text-destructive">
                  {bookings.filter(b => b.escrow_status === 'disputed').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Ready to Release</div>
                <div className="text-2xl font-bold text-green-600">
                  {bookings.filter(b => b.escrow_status === 'ready_for_release').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bookings Table */}
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Host / Guest</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No escrow bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{booking.property_title}</div>
                            <div className="text-xs text-muted-foreground font-mono">{booking.id.slice(0, 8)}...</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Host: {booking.host_name}</div>
                            <div className="text-muted-foreground">Guest: {booking.guest_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(booking.check_in_date), 'MMM d')}</div>
                            <div className="text-muted-foreground">to {format(new Date(booking.check_out_date), 'MMM d, yyyy')}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            ${getTotalEscrowAmount(booking).toFixed(2)} {booking.escrow_currency.toUpperCase()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Deposit: ${booking.deposit_amount}
                            {booking.remaining_payment_amount && ` + $${booking.remaining_payment_amount}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getEscrowStatusBadge(booking.escrow_status)}
                            {booking.host_reported_damage && (
                              <Badge variant="destructive" className="text-xs">
                                Damage Reported
                              </Badge>
                            )}
                            {!booking.host_stripe_account_id && (
                              <div className="mt-1">
                                <Badge variant="destructive" className="text-xs">
                                  <Wallet className="h-3 w-3 mr-1" />
                                  No Payout Method
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {/* Host has no payout method */}
                            {!booking.host_stripe_account_id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-amber-500 text-amber-700 hover:bg-amber-50"
                                  onClick={async () => {
                                    try {
                                      // Send notification to host to set up payout
                                      const { error } = await supabase
                                        .from('notifications')
                                        .insert({
                                          user_id: booking.host_id,
                                          type: 'payout_setup_required',
                                          title: 'Set Up Your Payout Method',
                                          message: `You have funds waiting! Please set up Stripe Connect in your profile to receive your payout of $${getTotalEscrowAmount(booking).toFixed(2)} for "${booking.property_title}".`,
                                          link: '/profile?tab=settings',
                                          booking_id: booking.id
                                        });
                                      if (error) throw error;
                                      toast({ title: "Notification Sent", description: `Payout setup request sent to ${booking.host_name}` });
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message, variant: "destructive" });
                                    }
                                  }}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Request Payout Setup
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={async () => {
                                    try {
                                      const totalPrice = Number(booking.total_price) || 0;
                                      const commission = Math.round(totalPrice * 0.09 * 100) / 100;
                                      const hostPayout = Math.round((totalPrice - commission) * 100) / 100;
                                      const { error } = await supabase
                                        .from('bookings')
                                        .update({ 
                                          escrow_status: 'released', 
                                          status: 'settled',
                                          settled_at: new Date().toISOString(),
                                          escrow_released_at: new Date().toISOString(),
                                          host_payout_amount: hostPayout,
                                          platform_commission: commission,
                                        })
                                        .eq('id', booking.id);
                                      if (error) throw error;
                                      toast({ title: "Success", description: "Marked as withdrawn (manual payout completed)" });
                                      fetchEscrowBookings();
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message, variant: "destructive" });
                                    }
                                  }}
                                >
                                  <ArrowDownToLine className="h-3 w-3 mr-1" />
                                  Mark Withdrawn
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog(booking, 'refund_guest')}
                                >
                                  Refund
                                </Button>
                              </>
                            ) : booking.escrow_status === 'pending_manual_payout' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={async () => {
                                    try {
                                      const totalPrice = Number(booking.total_price) || 0;
                                      const commission = Math.round(totalPrice * 0.09 * 100) / 100;
                                      const hostPayout = Math.round((totalPrice - commission) * 100) / 100;
                                      const { error } = await supabase
                                        .from('bookings')
                                        .update({ 
                                          escrow_status: 'released', 
                                          status: 'settled',
                                          settled_at: new Date().toISOString(),
                                          escrow_released_at: new Date().toISOString(),
                                          host_payout_amount: hostPayout,
                                          platform_commission: commission,
                                        })
                                        .eq('id', booking.id);
                                      if (error) throw error;
                                      toast({ title: "Success", description: "Marked as withdrawn (manual payout completed)" });
                                      fetchEscrowBookings();
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message, variant: "destructive" });
                                    }
                                  }}
                                >
                                  <ArrowDownToLine className="h-3 w-3 mr-1" />
                                  Mark Withdrawn
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog(booking, 'refund_guest')}
                                >
                                  Refund
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openActionDialog(booking, 'release')}
                                >
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Release
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openActionDialog(booking, 'refund_guest')}
                                >
                                  Refund
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openActionDialog(booking, 'partial_release')}
                                >
                                  Split
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
            </TabsContent>

            {/* STUCK STATES TAB - Requires Admin Intervention */}
            <TabsContent value="stuck">
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">These bookings require manual intervention</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Bookings in these states cannot be resolved automatically. Use Force Release or Refund actions.
                  </p>
                </div>

                {stuckLoading ? (
                  <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : stuckBookings.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No stuck bookings! All escrow states are healthy.</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead>Host / Guest</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Stuck State</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stuckBookings.map((booking) => (
                          <TableRow key={booking.id} className="bg-red-50/50 dark:bg-red-950/50">
                            <TableCell>
                              <div>
                                <div className="font-medium">{booking.property_title}</div>
                                <div className="text-xs text-muted-foreground font-mono">{booking.id.slice(0, 8)}...</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Host: {booking.host_name}</div>
                                <div className="text-muted-foreground">Guest: {booking.guest_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                ${getTotalEscrowAmount(booking).toFixed(2)} {booking.escrow_currency.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getEscrowStatusBadge(booking.escrow_status)}
                              {booking.escrow_status === 'release_pending_host_setup' && (
                                <p className="text-xs text-red-600 mt-1">Host needs to complete Stripe Connect</p>
                              )}
                              {booking.escrow_status === 'pending_manual_payout' && (
                                <p className="text-xs text-purple-600 mt-1">Requires manual bank transfer</p>
                              )}
                              {booking.escrow_status === 'forfeited_split_pending' && (
                                <p className="text-xs text-orange-600 mt-1">Guest forfeited - 50/50 split needs release</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                {booking.host_stripe_account_id ? (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleForceRelease(booking)}
                                  >
                                    <Zap className="h-3 w-3 mr-1" />
                                    Force Release to Host
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-amber-500 text-amber-700 hover:bg-amber-50"
                                      onClick={async () => {
                                        try {
                                          const { error } = await supabase
                                            .from('notifications')
                                            .insert({
                                              user_id: booking.host_id,
                                              type: 'payout_setup_required',
                                              title: 'Set Up Your Payout Method',
                                              message: `You have funds waiting! Please set up Stripe Connect in your profile to receive your payout of $${getTotalEscrowAmount(booking).toFixed(2)}.`,
                                              link: '/profile?tab=settings',
                                              booking_id: booking.id
                                            });
                                          if (error) throw error;
                                          toast({ title: "Notification Sent", description: `Payout setup request sent to ${booking.host_name}` });
                                        } catch (err: any) {
                                          toast({ title: "Error", description: err.message, variant: "destructive" });
                                        }
                                      }}
                                    >
                                      <Send className="h-3 w-3 mr-1" />
                                      Request Payout Setup
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                      onClick={async () => {
                                        try {
                                          const totalPrice = Number(booking.total_price) || 0;
                                          const commission = Math.round(totalPrice * 0.09 * 100) / 100;
                                          const hostPayout = Math.round((totalPrice - commission) * 100) / 100;
                                          const { error } = await supabase
                                            .from('bookings')
                                            .update({ 
                                              escrow_status: 'released', 
                                              status: 'settled',
                                              settled_at: new Date().toISOString(),
                                              escrow_released_at: new Date().toISOString(),
                                              host_payout_amount: hostPayout,
                                              platform_commission: commission,
                                            })
                                            .eq('id', booking.id);
                                          if (error) throw error;
                                          toast({ title: "Success", description: "Marked as withdrawn" });
                                          fetchStuckBookings();
                                          fetchEscrowBookings();
                                        } catch (err: any) {
                                          toast({ title: "Error", description: err.message, variant: "destructive" });
                                        }
                                      }}
                                    >
                                      <ArrowDownToLine className="h-3 w-3 mr-1" />
                                      Mark Withdrawn
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openActionDialog(booking, 'refund_guest')}
                                >
                                  Refund Guest Instead
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Automated Actions Log
                  </h3>
                  <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {auditLoading ? (
                  <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Booking</TableHead>
                          <TableHead>Status Change</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                              No audit logs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                <div className="text-sm">{format(new Date(log.created_at), 'MMM d, HH:mm')}</div>
                                <div className="text-xs text-muted-foreground">{log.triggered_by}</div>
                              </TableCell>
                              <TableCell>{getAuditActionBadge(log.action_type)}</TableCell>
                              <TableCell>
                                <div className="text-xs font-mono">{log.booking_id.slice(0, 8)}...</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {log.previous_status && (
                                    <>
                                      <span className="text-muted-foreground">{log.previous_status}</span>
                                      <span className="mx-1">→</span>
                                    </>
                                  )}
                                  <span className="font-medium">{log.new_status || '-'}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Escrow: {log.new_escrow_status || '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {log.amount_affected ? (
                                  <span className="font-medium">${log.amount_affected.toFixed(2)}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="max-w-[300px]">
                                <p className="text-sm truncate" title={log.action_reason}>
                                  {log.action_reason}
                                </p>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Action Dialog */}
      <Dialog 
        open={actionDialog.open} 
        onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'release' && 'Release Escrow to Host'}
              {actionDialog.action === 'refund_guest' && 'Refund Guest'}
              {actionDialog.action === 'partial_release' && 'Split Escrow'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.booking && (
                <span>
                  Total amount: ${getTotalEscrowAmount(actionDialog.booking).toFixed(2)} {actionDialog.booking.escrow_currency.toUpperCase()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionDialog.action === 'partial_release' && (
              <>
                <div className="space-y-2">
                  <Label>Amount to Host</Label>
                  <Input
                    type="number"
                    value={actionDialog.hostAmount}
                    onChange={(e) => setActionDialog(prev => ({ ...prev, hostAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">10% platform fee will be deducted</p>
                </div>
                <div className="space-y-2">
                  <Label>Refund to Guest</Label>
                  <Input
                    type="number"
                    value={actionDialog.guestRefundAmount}
                    onChange={(e) => setActionDialog(prev => ({ ...prev, guestRefundAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            {actionDialog.action === 'refund_guest' && (
              <div className="space-y-2">
                <Label>Refund Amount</Label>
                <Input
                  type="number"
                  value={actionDialog.guestRefundAmount}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, guestRefundAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea
                value={actionDialog.reason}
                onChange={(e) => setActionDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Enter reason for this action..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Issue Strikes (Abuse Deterrence)</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="strike-host"
                  checked={actionDialog.strikeHost}
                  onCheckedChange={(checked) => 
                    setActionDialog(prev => ({ ...prev, strikeHost: checked === true }))
                  }
                />
                <Label htmlFor="strike-host" className="text-sm font-normal flex items-center gap-1">
                  <Ban className="h-3 w-3 text-destructive" />
                  Strike Host (fake damage claim)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="strike-guest"
                  checked={actionDialog.strikeGuest}
                  onCheckedChange={(checked) => 
                    setActionDialog(prev => ({ ...prev, strikeGuest: checked === true }))
                  }
                />
                <Label htmlFor="strike-guest" className="text-sm font-normal flex items-center gap-1">
                  <Ban className="h-3 w-3 text-destructive" />
                  Strike Guest (fake dispute)
                </Label>
              </div>
            </div>
          </div>

          {/* VALIDATION WARNINGS */}
          {actionDialog.reason.trim().length < 10 && (
            <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
              ⚠️ Reason must be at least 10 characters
            </div>
          )}
          {(actionDialog.strikeHost || actionDialog.strikeGuest) && actionDialog.reason.trim().length < 20 && (
            <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
              ⚠️ Strikes require at least 20 characters explanation
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setActionDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEscrowAction}
              variant={actionDialog.action === 'refund_guest' ? 'destructive' : 'default'}
              disabled={
                actionDialog.reason.trim().length < 10 ||
                ((actionDialog.strikeHost || actionDialog.strikeGuest) && actionDialog.reason.trim().length < 20)
              }
            >
              Confirm {actionDialog.action?.replace('_', ' ')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EscrowDashboard;