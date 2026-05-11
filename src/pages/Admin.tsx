
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, XCircle, Clock, FileText, User, Home, 
  Search, Ban, Snowflake, Trash2, ShieldAlert, AlertTriangle,
  Shield, Eye, EyeOff, DollarSign, Settings, Percent, Save, MessageSquare,
  Gavel, ScanSearch, Loader2, Play, RefreshCw, Star, Headphones, Sparkles
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import EscrowDashboard from "@/components/admin/EscrowDashboard";
import DisputeResolutionDashboard from "@/components/admin/DisputeResolutionDashboard";
import { AuthenticatedImage } from "@/components/admin/AuthenticatedImage";
import { ImageLightbox } from "@/components/admin/ImageLightbox";
import ReviewModerationDashboard from "@/components/admin/ReviewModerationDashboard";
import SupportChatPanel from "@/components/admin/SupportChatPanel";
import DailyPicksManager from "@/components/admin/DailyPicksManager";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type PanelRole = 'admin' | 'moderator' | 'support' | 'dispute_manager' | 'logistics';

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [panelRole, setPanelRole] = useState<PanelRole | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [banAppeals, setBanAppeals] = useState<any[]>([]);
  
  // Platform settings state
  const [platformFeeRate, setPlatformFeeRate] = useState<string>("7");
  const [savingSettings, setSavingSettings] = useState(false);
  const [featuredPropertyIds, setFeaturedPropertyIds] = useState<string[]>([]);
  const [savingFeatured, setSavingFeatured] = useState(false);
  
  // Search states
  const [propertySearch, setPropertySearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  
  // Dialog states
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean;
    verificationId: string | null;
    notes: string;
    allowResubmit: boolean;
  }>({
    open: false,
    verificationId: null,
    notes: '',
    allowResubmit: true
  });

  const [propertyActionDialog, setPropertyActionDialog] = useState<{
    open: boolean;
    propertyId: string | null;
    action: 'freeze' | 'ban' | 'delete' | null;
    reason: string;
  }>({
    open: false,
    propertyId: null,
    action: null,
    reason: ''
  });

  const [userActionDialog, setUserActionDialog] = useState<{
    open: boolean;
    userId: string | null;
    action: 'ban' | 'warn' | 'role' | null;
    reason: string;
    selectedRole: string;
  }>({
    open: false,
    userId: null,
    action: null,
    reason: '',
    selectedRole: ''
  });

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    alt: string;
  }>({
    isOpen: false,
    imageSrc: null,
    alt: ''
  });

  // Orphan cleanup state
  const [orphanedRecords, setOrphanedRecords] = useState<string[]>([]);
  const [scanningOrphans, setScanningOrphans] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [deletingOrphans, setDeletingOrphans] = useState(false);

  // Cron trigger state
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [lastCronResult, setLastCronResult] = useState<any>(null);

  useEffect(() => {
    if (!authLoading) {
      checkAdminAccess();
    }
  }, [user, authLoading]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      // Check panel role (admin or moderator)
      const { data: role, error } = await supabase.rpc('get_panel_role');

      if (error) throw error;

      if (!role) {
        toast({
          title: t('admin.access_denied'),
          description: t('admin.no_privileges'),
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      setPanelRole(role as PanelRole);
      setIsAdmin(true);
      loadAdminData();
    } catch (error) {
      console.error('Admin check error:', error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      // Load ID verifications
      const { data: verificationsData, error: verError } = await supabase
        .from('id_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (verError) throw verError;

      // Load profiles separately and merge
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;
      setProfiles(profilesData || []);

      // Load user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('*');
      setUserRoles(rolesData || []);

      // Get current session for auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Merge verifications with profiles and build proxy URLs for images
      const verificationsWithProfiles = (verificationsData || []).map((ver: any) => {
        const profile = profilesData?.find((p: any) => p.id === ver.user_id);
        
        // Build proxy URLs for ID verification images (avoids CORS issues with R2)
        const baseUrl = 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/get-r2-image';
        
        return {
          ...ver,
          cin_front_signed_url: ver.cin_front_url 
            ? `${baseUrl}?path=${encodeURIComponent('id-verification/' + ver.cin_front_url)}`
            : null,
          cin_back_signed_url: ver.cin_back_url 
            ? `${baseUrl}?path=${encodeURIComponent('id-verification/' + ver.cin_back_url)}`
            : null,
          selfie_signed_url: ver.selfie_url 
            ? `${baseUrl}?path=${encodeURIComponent('id-verification/' + ver.selfie_url)}`
            : null,
          accessToken, // Store token for authenticated image requests
          profiles: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null
        };
      });
      setVerifications(verificationsWithProfiles);

      // Load all properties
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propError) throw propError;

      // Merge properties with profiles
      const propertiesWithProfiles = propertiesData?.map((prop: any) => {
        const profile = profilesData?.find((p: any) => p.id === prop.host_id);
        return {
          ...prop,
          profiles: profile ? { full_name: profile.full_name } : null
        };
      }) || [];
      setProperties(propertiesWithProfiles);

      // Load platform settings
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'platform_fee_rate')
        .single();
      
      if (settingsData?.value) {
        const ratePercent = (parseFloat(settingsData.value) * 100).toString();
        setPlatformFeeRate(ratePercent);
      }

      // Load featured property IDs
      const { data: featuredData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'featured_property_ids')
        .single();
      
      if (featuredData?.value) {
        try {
          setFeaturedPropertyIds(JSON.parse(featuredData.value));
        } catch { setFeaturedPropertyIds([]); }
      }

      // Load ban appeals
      const { data: appealsData, error: appealsError } = await supabase
        .from('ban_appeals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!appealsError && appealsData) {
        // Merge with profiles
        const appealsWithProfiles = appealsData.map((appeal: any) => {
          const profile = profilesData?.find((p: any) => p.id === appeal.user_id);
          return {
            ...appeal,
            profiles: profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null
          };
        });
        setBanAppeals(appealsWithProfiles);
      }

    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({
        title: t('common.error'),
        description: t('admin.error_loading'),
        variant: "destructive"
      });
    }
  };

  const handleVerificationUpdate = async (verificationId: string, status: string, notes?: string, allowResubmit: boolean = true) => {
    try {
      const verification = verifications.find((v: any) => v.id === verificationId);
      
      // Update verification record
      const { error } = await supabase
        .from('id_verifications')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes || null,
          allow_resubmit: allowResubmit,
          warning_count: status === 'rejected' ? (verification?.warning_count || 0) + 1 : verification?.warning_count || 0
        })
        .eq('id', verificationId);

      if (error) throw error;

      // Update profile verification status
      if (verification) {
        const newStatus = status === 'approved' 
          ? 'verified' 
          : (status === 'rejected_final' ? 'rejected' : 'unverified');
        
        const updateData: any = {
          verification_status: newStatus
        };

        // Add warning if rejected
        if (status === 'rejected' || status === 'rejected_final') {
          updateData.warning_count = (profiles.find((p: any) => p.id === verification.user_id)?.warning_count || 0) + 1;
          updateData.last_warning_at = new Date().toISOString();
          updateData.last_warning_reason = notes || 'ID verification rejected';
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', verification.user_id);

        if (profileError) throw profileError;
      }

      toast({
        title: t('common.success'),
        description: t('admin.verification_updated'),
      });

      loadAdminData();
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({
        title: t('common.error'),
        description: t('admin.error_updating'),
        variant: "destructive"
      });
    }
  };

  const openRejectionDialog = (verificationId: string) => {
    setRejectionDialog({
      open: true,
      verificationId,
      notes: '',
      allowResubmit: true
    });
  };

  const handleReject = () => {
    if (!rejectionDialog.verificationId) return;
    
    const status = rejectionDialog.allowResubmit ? 'rejected' : 'rejected_final';
    handleVerificationUpdate(
      rejectionDialog.verificationId, 
      status, 
      rejectionDialog.notes,
      rejectionDialog.allowResubmit
    );
    
    setRejectionDialog({
      open: false,
      verificationId: null,
      notes: '',
      allowResubmit: true
    });
  };

  // Property actions
  const handlePropertyAction = async () => {
    if (!propertyActionDialog.propertyId || !propertyActionDialog.action) return;

    try {
      const now = new Date().toISOString();

      if (propertyActionDialog.action === 'delete') {
        const { error } = await supabase
          .from('properties')
          .delete()
          .eq('id', propertyActionDialog.propertyId);
        if (error) throw error;
      } else if (propertyActionDialog.action === 'freeze') {
        const property = properties.find((p: any) => p.id === propertyActionDialog.propertyId);
        const { error } = await supabase
          .from('properties')
          .update({
            is_frozen: !property?.is_frozen,
            frozen_at: !property?.is_frozen ? now : null,
            frozen_reason: !property?.is_frozen ? propertyActionDialog.reason : null
          })
          .eq('id', propertyActionDialog.propertyId);
        if (error) throw error;
      } else if (propertyActionDialog.action === 'ban') {
        const property = properties.find((p: any) => p.id === propertyActionDialog.propertyId);
        const { error } = await supabase
          .from('properties')
          .update({
            is_banned: !property?.is_banned,
            banned_at: !property?.is_banned ? now : null,
            banned_reason: !property?.is_banned ? propertyActionDialog.reason : null,
            is_public: false // Always hide banned properties
          })
          .eq('id', propertyActionDialog.propertyId);
        if (error) throw error;
      }

      toast({
        title: t('common.success'),
        description: `Property ${propertyActionDialog.action}ed successfully`
      });

      setPropertyActionDialog({ open: false, propertyId: null, action: null, reason: '' });
      loadAdminData();
    } catch (error) {
      console.error('Property action error:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to perform action',
        variant: "destructive"
      });
    }
  };

  // User actions
  const handleUserAction = async () => {
    if (!userActionDialog.userId || !userActionDialog.action) return;

    try {
      const now = new Date().toISOString();
      const profile = profiles.find((p: any) => p.id === userActionDialog.userId);

      if (userActionDialog.action === 'ban') {
        const { error } = await supabase
          .from('profiles')
          .update({
            is_banned: !profile?.is_banned,
            banned_at: !profile?.is_banned ? now : null,
            banned_reason: !profile?.is_banned ? userActionDialog.reason : null
          })
          .eq('id', userActionDialog.userId);
        if (error) throw error;
      } else if (userActionDialog.action === 'warn') {
        const newWarningCount = (profile?.warning_count || 0) + 1;
        const willBeBanned = newWarningCount >= 3;
        
        const updateData: any = {
          warning_count: newWarningCount,
          last_warning_at: now,
          last_warning_reason: userActionDialog.reason
        };
        
        // Auto-ban at 3 warnings
        if (willBeBanned) {
          updateData.is_banned = true;
          updateData.banned_at = now;
          updateData.banned_reason = 'Automatic ban: 3 warnings reached. ' + userActionDialog.reason;
        }
        
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userActionDialog.userId);
        if (error) throw error;
        
        // Send notification email
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: willBeBanned ? 'account_banned' : 'warning_issued',
              userId: userActionDialog.userId,
              recipientName: profile?.full_name || 'User',
              reason: willBeBanned ? updateData.banned_reason : userActionDialog.reason,
              message: userActionDialog.reason
            }
          });
        } catch (emailError) {
          console.error('Failed to send warning email:', emailError);
        }
      } else if (userActionDialog.action === 'role' && userActionDialog.selectedRole) {
        // Check if role already exists
        const existingRole = userRoles.find(
          (r: any) => r.user_id === userActionDialog.userId && r.role === userActionDialog.selectedRole
        );
        
        if (existingRole) {
          // Remove role
          const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('id', existingRole.id);
          if (error) throw error;
        } else {
          // Add role - cast to bypass strict typing until types are regenerated
          const { error } = await supabase
            .from('user_roles')
            .insert([{
              user_id: userActionDialog.userId,
              role: userActionDialog.selectedRole as 'admin' | 'moderator' | 'support',
              created_by: user?.id
            }]);
          if (error) throw error;
        }
      }

      toast({
        title: t('common.success'),
        description: `User ${userActionDialog.action} action completed`
      });

      setUserActionDialog({ open: false, userId: null, action: null, reason: '', selectedRole: '' });
      loadAdminData();
    } catch (error) {
      console.error('User action error:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to perform action',
        variant: "destructive"
      });
    }
  };

  // Appeal actions
  const handleAppealAction = async (appealId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const appeal = banAppeals.find((a: any) => a.id === appealId);
      if (!appeal) return;

      // Update appeal status
      const { error: appealError } = await supabase
        .from('ban_appeals')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: notes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', appealId);

      if (appealError) throw appealError;

      // If approved, unban the user
      if (action === 'approve') {
        const now = new Date().toISOString();
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_banned: false,
            banned_at: null,
            banned_reason: null,
            unbanned_at: now
          })
          .eq('id', appeal.user_id);

        if (profileError) throw profileError;
        
        // Send unban notification email
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'account_unbanned',
              userId: appeal.user_id,
              reason: notes || 'Your ban appeal has been approved.'
            }
          });
        } catch (emailError) {
          console.error('Failed to send unban email:', emailError);
        }
        
        // Create in-app notification
        await supabase.from('notifications').insert({
          user_id: appeal.user_id,
          type: 'account_unbanned',
          title: 'Account Reinstated',
          message: 'Your ban appeal has been approved. Welcome back!',
          link: '/profile'
        });
      }

      toast({
        title: t('common.success'),
        description: `Appeal ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      loadAdminData();
    } catch (error) {
      console.error('Appeal action error:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to process appeal',
        variant: "destructive"
      });
    }
  };

  const pendingAppeals = banAppeals.filter((a: any) => a.status === 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{t('status.pending')}</Badge>;
      case 'approved':
      case 'verified':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />{t('status.approved')}</Badge>;
      case 'rejected':
      case 'rejected_final':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('status.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUserRoleBadges = (userId: string) => {
    const roles = userRoles.filter((r: any) => r.user_id === userId);
    return roles.map((r: any) => (
      <Badge key={r.id} variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">
        <Shield className="w-3 h-3 mr-1" />
        {r.role}
      </Badge>
    ));
  };

  // Filter properties
  const filteredProperties = properties.filter((property: any) => {
    if (!propertySearch) return true;
    const search = propertySearch.toLowerCase();
    return (
      property.title?.toLowerCase().includes(search) ||
      property.id?.toLowerCase().includes(search) ||
      property.short_code?.toLowerCase().includes(search)
    );
  });

  // Filter users
  const filteredProfiles = profiles.filter((profile: any) => {
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return (
      profile.full_name?.toLowerCase().includes(search) ||
      profile.username?.toLowerCase().includes(search) ||
      profile.phone?.toLowerCase().includes(search) ||
      profile.id?.toLowerCase().includes(search)
    );
  });

  // Lightbox handlers
  const openLightbox = (imageSrc: string, alt: string) => {
    setLightbox({ isOpen: true, imageSrc, alt });
  };

  const closeLightbox = () => {
    setLightbox({ isOpen: false, imageSrc: null, alt: '' });
  };

  // Scan for orphaned verification records (images return 404)
  const scanForOrphanedRecords = async () => {
    setScanningOrphans(true);
    setOrphanedRecords([]);
    
    const orphaned: string[] = [];
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    if (!token) {
      toast({
        title: t('common.error'),
        description: 'Authentication required',
        variant: "destructive"
      });
      setScanningOrphans(false);
      return;
    }
    
    for (const verification of verifications) {
      // Check all three images for each verification
      const urls = [
        verification.cin_front_signed_url,
        verification.cin_back_signed_url,
        verification.selfie_signed_url
      ].filter(Boolean);
      
      let allMissing = true;
      
      for (const url of urls) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            allMissing = false;
            break;
          }
        } catch {
          // Continue checking
        }
      }
      
      if (allMissing && urls.length > 0) {
        orphaned.push(verification.id);
      }
    }
    
    setOrphanedRecords(orphaned);
    setScanningOrphans(false);
    
    toast({
      title: 'Scan Complete',
      description: orphaned.length > 0 
        ? `Found ${orphaned.length} orphaned record(s)` 
        : 'No orphaned records found'
    });
  };

  // Delete all orphaned records
  const deleteOrphanedRecords = async () => {
    if (orphanedRecords.length === 0) return;
    
    setDeletingOrphans(true);
    
    try {
      const { error } = await supabase
        .from('id_verifications')
        .delete()
        .in('id', orphanedRecords);
      
      if (error) throw error;
      
      toast({
        title: t('common.success'),
        description: `Deleted ${orphanedRecords.length} orphaned record(s)`
      });
      
      setOrphanedRecords([]);
      setCleanupDialogOpen(false);
      loadAdminData();
    } catch (error) {
      console.error('Failed to delete orphaned records:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to delete orphaned records',
        variant: "destructive"
      });
    } finally {
      setDeletingOrphans(false);
    }
  };

  // Delete single verification record
  const deleteVerificationRecord = async (verificationId: string) => {
    try {
      const { error } = await supabase
        .from('id_verifications')
        .delete()
        .eq('id', verificationId);
      
      if (error) throw error;
      
      toast({
        title: t('common.success'),
        description: 'Verification record deleted'
      });
      
      setOrphanedRecords(prev => prev.filter(id => id !== verificationId));
      loadAdminData();
    } catch (error) {
      console.error('Failed to delete verification:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to delete record',
        variant: "destructive"
      });
    }
  };

  // Trigger escrow-deadline-cron manually
  const triggerEscrowCron = async () => {
    setTriggeringCron(true);
    setLastCronResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-trigger-cron', {
        method: 'POST'
      });
      
      if (error) throw error;
      
      setLastCronResult(data);
      
      toast({
        title: "Cron Triggered Successfully",
        description: `Triggered by ${data?.triggered_by || 'admin'}`,
      });
      
      // Reload data to reflect any changes from the cron
      loadAdminData();
    } catch (error: any) {
      console.error('Failed to trigger cron:', error);
      setLastCronResult({ error: error.message });
      toast({
        title: "Failed to Trigger Cron",
        description: error.message || 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setTriggeringCron(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Role helper */}
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">{t('admin.title')}</h1>
          {panelRole && panelRole !== 'admin' && (
            <p className="text-sm text-muted-foreground mb-6">
              <Badge variant="outline" className="mr-2 capitalize">{panelRole.replace('_', ' ')}</Badge>
              You have limited access to the admin panel.
            </p>
          )}

          {(() => {
            // Permission matrix: which tabs each role can access
            const tabPerms: Record<PanelRole, string[]> = {
              admin: ['verifications', 'users', 'properties', 'reviews', 'disputes', 'appeals', 'support', 'escrow', 'picks', 'settings'],
              moderator: ['verifications', 'users', 'properties', 'reviews', 'disputes', 'appeals', 'support', 'picks', 'settings'],
              dispute_manager: ['disputes', 'appeals'],
              logistics: ['escrow', 'settings'],
              support: ['support', 'appeals'],
            };
            const visibleTabs = panelRole ? tabPerms[panelRole] : [];
            const requestedTab = searchParams.get('tab');
            const defaultTab = requestedTab && visibleTabs.includes(requestedTab) ? requestedTab : visibleTabs[0] ?? 'verifications';
            const can = (tab: string) => visibleTabs.includes(tab);
            const colCount = visibleTabs.length;

            return (
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
              {can('verifications') && (
              <TabsTrigger value="verifications">
                <FileText className="w-4 h-4 mr-2" />
                {t('admin.verifications')} ({verifications.length})
              </TabsTrigger>
              )}
              {can('users') && (
              <TabsTrigger value="users">
                <User className="w-4 h-4 mr-2" />
                {t('admin.users')} ({profiles.length})
              </TabsTrigger>
              )}
              {can('properties') && (
              <TabsTrigger value="properties">
                <Home className="w-4 h-4 mr-2" />
                {t('admin.properties')} ({properties.length})
              </TabsTrigger>
              )}
              {can('reviews') && (
              <TabsTrigger value="reviews">
                <Star className="w-4 h-4 mr-2" />
                Reviews
              </TabsTrigger>
              )}
              {can('disputes') && (
              <TabsTrigger value="disputes">
                <Gavel className="w-4 h-4 mr-2" />
                Disputes
              </TabsTrigger>
              )}
              {can('appeals') && (
              <TabsTrigger value="appeals" className="relative">
                <MessageSquare className="w-4 h-4 mr-2" />
                Appeals
                {pendingAppeals.length > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {pendingAppeals.length}
                  </span>
                )}
              </TabsTrigger>
              )}
              {can('support') && (
              <TabsTrigger value="support">
                <Headphones className="w-4 h-4 mr-2" />
                Support
              </TabsTrigger>
              )}
              {can('escrow') && (
                <TabsTrigger value="escrow">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Escrow
                </TabsTrigger>
              )}
              {can('picks') && (
              <TabsTrigger value="picks">
                <Sparkles className="w-4 h-4 mr-2" />
                Picks
              </TabsTrigger>
              )}
              {can('settings') && (
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
              )}
            </TabsList>


            <TabsContent value="picks">
              <DailyPicksManager />
            </TabsContent>

            <TabsContent value="reviews">
              <ReviewModerationDashboard />
            </TabsContent>

            <TabsContent value="disputes">
              <DisputeResolutionDashboard />
            </TabsContent>

            <TabsContent value="support">
              <SupportChatPanel />
            </TabsContent>

            <TabsContent value="verifications" className="space-y-4">
              {/* Cleanup toolbar */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {verifications.length} verification record(s)
                  </span>
                  {orphanedRecords.length > 0 && (
                    <Badge variant="destructive">
                      {orphanedRecords.length} orphaned
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scanForOrphanedRecords}
                    disabled={scanningOrphans}
                  >
                    {scanningOrphans ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ScanSearch className="w-4 h-4 mr-2" />
                    )}
                    {scanningOrphans ? 'Scanning...' : 'Scan for Orphans'}
                  </Button>
                  {orphanedRecords.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCleanupDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete {orphanedRecords.length} Orphaned
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                {verifications.map((verification: any) => {
                  const isOrphaned = orphanedRecords.includes(verification.id);
                  return (
                    <Card key={verification.id} className={isOrphaned ? 'border-destructive bg-destructive/5' : ''}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {verification.profiles?.full_name || t('admin.unknown_user')}
                              {isOrphaned && (
                                <Badge variant="destructive" className="text-xs">
                                  Orphaned
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {t('admin.submitted')}: {new Date(verification.submitted_at).toLocaleDateString()}
                              {verification.warning_count > 0 && (
                                <span className="ml-2 text-orange-600">
                                  • {verification.warning_count} warning(s)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(verification.status)}
                          {isOrphaned && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteVerificationRecord(verification.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="font-medium mb-2">{t('admin.cin_front')}</p>
                            {verification.cin_front_signed_url ? (
                              <AuthenticatedImage 
                                src={verification.cin_front_signed_url} 
                                alt={t('admin.cin_front')} 
                                className="w-full h-32 object-cover rounded border"
                                onClick={(src) => openLightbox(src, t('admin.cin_front'))}
                                fallback={
                                  <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                    No image
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium mb-2">{t('admin.cin_back')}</p>
                            {verification.cin_back_signed_url ? (
                              <AuthenticatedImage 
                                src={verification.cin_back_signed_url} 
                                alt={t('admin.cin_back')} 
                                className="w-full h-32 object-cover rounded border"
                                onClick={(src) => openLightbox(src, t('admin.cin_back'))}
                                fallback={
                                  <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                    No image
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium mb-2">{t('admin.selfie')}</p>
                            {verification.selfie_signed_url ? (
                              <AuthenticatedImage 
                                src={verification.selfie_signed_url} 
                                alt={t('admin.selfie')} 
                                className="w-full h-32 object-cover rounded border"
                                onClick={(src) => openLightbox(src, t('admin.selfie'))}
                                fallback={
                                  <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                    No image
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                        </div>
                      
                      {verification.status === 'pending' && (
                        <div className="flex space-x-2">
                          <Button 
                            variant="default" 
                            onClick={() => handleVerificationUpdate(verification.id, 'approved')}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {t('admin.approve')}
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => openRejectionDialog(verification.id)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {t('admin.reject')}
                          </Button>
                        </div>
                      )}
                      
                      {verification.reviewer_notes && (
                        <div className="mt-4 p-3 bg-muted rounded">
                          <p className="font-medium">{t('admin.reviewer_notes')}:</p>
                          <p className="text-sm">{verification.reviewer_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, username, phone, or ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid gap-4">
                {filteredProfiles.map((profile: any) => (
                  <Card key={profile.id} className={profile.is_banned ? 'border-red-300 bg-red-50/30' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-12 h-12 bg-muted rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/user/${profile.id}`)}
                          >
                            {profile.avatar_url ? (
                              <img 
                                src={profile.avatar_url} 
                                alt={profile.full_name || 'User'} 
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="flex items-center">
                              <span 
                                className="cursor-pointer hover:underline hover:text-primary transition-colors"
                                onClick={() => navigate(`/user/${profile.id}`)}
                              >
                                {profile.full_name || 'No name'}
                              </span>
                              {getUserRoleBadges(profile.id)}
                              {profile.is_banned && (
                                <Badge variant="destructive" className="ml-2">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Banned
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {t('admin.joined')}: {new Date(profile.created_at).toLocaleDateString()}
                              {profile.warning_count > 0 && (
                                <span className="ml-2 text-orange-600">
                                  • {profile.warning_count} warning(s)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {getStatusBadge(profile.verification_status)}
                          {profile.is_host && <Badge variant="outline">{t('admin.host')}</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-end">
                        <div className="text-sm text-muted-foreground">
                          <p>{t('admin.phone')}: {profile.phone || t('admin.not_provided')}</p>
                          <p>{t('admin.username')}: {profile.username || t('admin.not_set')}</p>
                          <p className="text-xs mt-1 font-mono">{profile.id}</p>
                        </div>
                        <div className="flex gap-2">
                          {panelRole === 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserActionDialog({
                              open: true,
                              userId: profile.id,
                              action: 'role',
                              reason: '',
                              selectedRole: ''
                            })}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Roles
                          </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserActionDialog({
                              open: true,
                              userId: profile.id,
                              action: 'warn',
                              reason: '',
                              selectedRole: ''
                            })}
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Warn
                          </Button>
                          <Button
                            variant={profile.is_banned ? "default" : "destructive"}
                            size="sm"
                            onClick={() => setUserActionDialog({
                              open: true,
                              userId: profile.id,
                              action: 'ban',
                              reason: '',
                              selectedRole: ''
                            })}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            {profile.is_banned ? 'Unban' : 'Ban'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="properties" className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, ID, or short code..."
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid gap-4">
                {filteredProperties.map((property: any) => (
                  <Card 
                    key={property.id} 
                    className={
                      property.is_banned ? 'border-red-300 bg-red-50/30' : 
                      property.is_frozen ? 'border-blue-300 bg-blue-50/30' : ''
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {property.title}
                            {property.is_frozen && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                <Snowflake className="w-3 h-3 mr-1" />
                                Frozen
                              </Badge>
                            )}
                            {property.is_banned && (
                              <Badge variant="destructive">
                                <Ban className="w-3 h-3 mr-1" />
                                Banned
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.host')}: {property.profiles?.full_name} • {property.city}, {property.governorate}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            ID: {property.id} {property.short_code && `• Code: ${property.short_code}`}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {getStatusBadge(property.status)}
                          {property.is_public ? (
                            <Badge variant="default"><Eye className="w-3 h-3 mr-1" />{t('admin.public')}</Badge>
                          ) : (
                            <Badge variant="secondary"><EyeOff className="w-3 h-3 mr-1" />{t('admin.private')}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-end">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-1">
                          <div>
                            <p className="font-medium">{t('admin.price')}</p>
                            <p>{property.price_per_night} TND/{t('admin.night')}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('admin.guests')}</p>
                            <p>{property.max_guests} {t('admin.guests').toLowerCase()}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('admin.bedrooms')}</p>
                            <p>{property.bedrooms} {t('admin.bedrooms').toLowerCase()}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('admin.bathrooms')}</p>
                            <p>{property.bathrooms} {t('admin.bathrooms').toLowerCase()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPropertyActionDialog({
                              open: true,
                              propertyId: property.id,
                              action: 'freeze',
                              reason: ''
                            })}
                          >
                            <Snowflake className="w-4 h-4 mr-1" />
                            {property.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </Button>
                          <Button
                            variant={property.is_banned ? "default" : "destructive"}
                            size="sm"
                            onClick={() => setPropertyActionDialog({
                              open: true,
                              propertyId: property.id,
                              action: 'ban',
                              reason: ''
                            })}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            {property.is_banned ? 'Unban' : 'Ban'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setPropertyActionDialog({
                              open: true,
                              propertyId: property.id,
                              action: 'delete',
                              reason: ''
                            })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="appeals" className="space-y-4">
              {banAppeals.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No ban appeals yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {banAppeals.map((appeal: any) => {
                    const profile = profiles.find((p: any) => p.id === appeal.user_id);
                    return (
                      <Card 
                        key={appeal.id} 
                        className={
                          appeal.status === 'pending' ? 'border-amber-300 bg-amber-50/30' :
                          appeal.status === 'approved' ? 'border-green-300 bg-green-50/30' :
                          'border-red-300 bg-red-50/30'
                        }
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                                {appeal.profiles?.avatar_url ? (
                                  <img 
                                    src={appeal.profiles.avatar_url} 
                                    alt={appeal.profiles?.full_name || 'User'} 
                                    className="w-12 h-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="w-6 h-6" />
                                )}
                              </div>
                              <div>
                                <CardTitle>{appeal.profiles?.full_name || 'Unknown User'}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Submitted: {new Date(appeal.created_at).toLocaleDateString()} at {new Date(appeal.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={
                                appeal.status === 'pending' ? 'secondary' : 
                                appeal.status === 'approved' ? 'default' : 
                                'destructive'
                              }
                            >
                              {appeal.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                              {appeal.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {appeal.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                              {appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {profile?.banned_reason && (
                            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">Ban Reason:</p>
                              <p className="text-sm text-red-700 dark:text-red-300">{profile.banned_reason}</p>
                            </div>
                          )}
                          
                          <div className="bg-muted p-3 rounded-lg">
                            <p className="text-sm font-medium mb-1">Appeal Reason:</p>
                            <p className="text-sm">{appeal.appeal_reason}</p>
                          </div>

                          {appeal.admin_notes && (
                            <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Admin Notes:</p>
                              <p className="text-sm text-blue-700 dark:text-blue-300">{appeal.admin_notes}</p>
                            </div>
                          )}

                          {appeal.status === 'pending' && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleAppealAction(appeal.id, 'approve')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve & Unban
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleAppealAction(appeal.id, 'reject')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          
                          {appeal.reviewed_at && (
                            <p className="text-xs text-muted-foreground">
                              Reviewed on {new Date(appeal.reviewed_at).toLocaleDateString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {panelRole === 'admin' && (
              <TabsContent value="escrow">
                <EscrowDashboard />
              </TabsContent>
            )}

            <TabsContent value="settings" className="space-y-6">
              {panelRole === 'admin' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Platform Fee Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="platformFee" className="text-base font-medium">
                        Platform Commission Rate
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        This percentage is deducted from each booking payment. Host receives the remaining amount.
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-xs">
                          <Input
                            id="platformFee"
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={platformFeeRate}
                            onChange={(e) => setPlatformFeeRate(e.target.value)}
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                        <Button 
                          onClick={async () => {
                            const rate = parseFloat(platformFeeRate);
                            if (isNaN(rate) || rate < 0 || rate > 50) {
                              toast({
                                title: "Invalid rate",
                                description: "Please enter a rate between 0 and 50%",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            setSavingSettings(true);
                            try {
                              const { error } = await supabase
                                .from('platform_settings')
                                .upsert({
                                  key: 'platform_fee_rate',
                                  value: (rate / 100).toString(),
                                  description: 'Platform commission rate (e.g., 0.09 = 9%)',
                                  updated_at: new Date().toISOString(),
                                  updated_by: user?.id
                                }, { onConflict: 'key' });
                              
                              if (error) throw error;
                              
                              toast({
                                title: "Settings saved",
                                description: `Platform fee updated to ${rate}%`
                              });
                            } catch (error) {
                              console.error('Error saving settings:', error);
                              toast({
                                title: "Error",
                                description: "Failed to save settings",
                                variant: "destructive"
                              });
                            } finally {
                              setSavingSettings(false);
                            }
                          }}
                          disabled={savingSettings}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {savingSettings ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <h4 className="font-medium mb-2">Fee Breakdown Example</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>For a 1000 TND booking:</p>
                        <p>• Platform fee: <span className="font-medium text-foreground">{parseFloat(platformFeeRate) || 0} TND</span></p>
                        <p>• Host receives: <span className="font-medium text-foreground">{1000 - (parseFloat(platformFeeRate) * 10 || 0)} TND</span></p>
                      </div>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-200">Important</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Changes to the platform fee rate will only affect new bookings. 
                            Existing bookings will use the rate that was set when they were created.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Featured Properties Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Featured Properties
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select which properties appear in the "Featured Properties" section on the landing page. 
                    Set to 0 properties to show a "No featured properties yet" message.
                  </p>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-3">
                    {properties
                      .filter((p: any) => p.status === 'published' && p.is_public && !p.is_banned)
                      .map((property: any) => (
                        <div key={property.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            id={`featured-${property.id}`}
                            checked={featuredPropertyIds.includes(property.id)}
                            onCheckedChange={(checked) => {
                              setFeaturedPropertyIds(prev => 
                                checked 
                                  ? [...prev, property.id]
                                  : prev.filter(id => id !== property.id)
                              );
                            }}
                          />
                          <label htmlFor={`featured-${property.id}`} className="flex-1 cursor-pointer text-sm">
                            <span className="font-medium">{property.title}</span>
                            <span className="text-muted-foreground ml-2">— {property.city}, {property.governorate}</span>
                          </label>
                          <Badge variant="outline" className="text-xs">{property.price_per_night} TND</Badge>
                        </div>
                      ))}
                    {properties.filter((p: any) => p.status === 'published' && p.is_public && !p.is_banned).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No published properties available</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {featuredPropertyIds.length} properties selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFeaturedPropertyIds([])}
                      >
                        Clear All
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingFeatured}
                        onClick={async () => {
                          setSavingFeatured(true);
                          try {
                            const { error } = await supabase
                              .from('platform_settings')
                              .upsert({
                                key: 'featured_property_ids',
                                value: JSON.stringify(featuredPropertyIds),
                                description: 'IDs of properties featured on the landing page',
                                updated_at: new Date().toISOString(),
                                updated_by: user?.id
                              }, { onConflict: 'key' });
                            
                            if (error) throw error;
                            
                            toast({
                              title: "Featured properties saved",
                              description: `${featuredPropertyIds.length} properties will be featured on the landing page`
                            });
                          } catch (error) {
                            console.error('Error saving featured properties:', error);
                            toast({
                              title: "Error",
                              description: "Failed to save featured properties",
                              variant: "destructive"
                            });
                          } finally {
                            setSavingFeatured(false);
                          }
                        }}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {savingFeatured ? "Saving..." : "Save Featured"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Automation Section - Admin Only */}
              {panelRole === 'admin' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Automation & Cron Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Escrow Deadline Cron</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Manually trigger the escrow lifecycle enforcement cron job. This processes:
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside mb-4 space-y-1">
                        <li>No-show cancellations (guests who didn't check in)</li>
                        <li>Payment deadline enforcement</li>
                        <li>Auto-settlements after dispute window expires</li>
                        <li>Stuck bookings recovery</li>
                      </ul>
                      
                      <div className="flex items-center gap-4">
                        <Button 
                          onClick={triggerEscrowCron}
                          disabled={triggeringCron}
                          className="gap-2"
                        >
                          {triggeringCron ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Triggering...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Trigger Cron Now
                            </>
                          )}
                        </Button>
                        
                        {lastCronResult && (
                          <div className="text-sm">
                            {lastCronResult.error ? (
                              <span className="text-destructive">
                                Error: {lastCronResult.error}
                              </span>
                            ) : (
                              <span className="text-green-600">
                                ✓ Last run: {lastCronResult.cron_response?.bookingsProcessed || 0} bookings processed
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <h4 className="font-medium mb-2">Scheduled Execution</h4>
                      <p className="text-sm text-muted-foreground">
                        The cron job is scheduled to run automatically every 15 minutes via <code className="bg-muted px-1 rounded">pg_cron</code>. 
                        Use the manual trigger above for immediate processing of stuck bookings or to verify the cron is working correctly.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </TabsContent>
          </Tabs>
            );
          })()}
        </div>
      </main>

      <Footer />

      {/* Rejection Dialog */}
      <Dialog 
        open={rejectionDialog.open} 
        onOpenChange={(open) => setRejectionDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.reject_verification')}</DialogTitle>
            <DialogDescription>
              {t('admin.reject_description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-notes">{t('admin.rejection_reason')}</Label>
              <Textarea
                id="rejection-notes"
                placeholder={t('admin.rejection_placeholder')}
                value={rejectionDialog.notes}
                onChange={(e) => setRejectionDialog(prev => ({ ...prev, notes: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-resubmit"
                checked={rejectionDialog.allowResubmit}
                onCheckedChange={(checked) => 
                  setRejectionDialog(prev => ({ ...prev, allowResubmit: checked === true }))
                }
              />
              <Label htmlFor="allow-resubmit" className="text-sm font-normal">
                {t('admin.allow_resubmit')}
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectionDialog(prev => ({ ...prev, open: false }))}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectionDialog.notes.trim()}
            >
              {t('admin.confirm_reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Action Dialog */}
      <Dialog 
        open={propertyActionDialog.open} 
        onOpenChange={(open) => setPropertyActionDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {propertyActionDialog.action === 'delete' && 'Delete Property'}
              {propertyActionDialog.action === 'freeze' && 'Freeze/Unfreeze Property'}
              {propertyActionDialog.action === 'ban' && 'Ban/Unban Property'}
            </DialogTitle>
            <DialogDescription>
              {propertyActionDialog.action === 'delete' && 'This action cannot be undone.'}
              {propertyActionDialog.action === 'freeze' && 'Frozen properties cannot receive new bookings.'}
              {propertyActionDialog.action === 'ban' && 'Banned properties will be hidden from search.'}
            </DialogDescription>
          </DialogHeader>
          
          {propertyActionDialog.action !== 'delete' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Enter reason..."
                  value={propertyActionDialog.reason}
                  onChange={(e) => setPropertyActionDialog(prev => ({ ...prev, reason: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPropertyActionDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button 
              variant={propertyActionDialog.action === 'delete' ? 'destructive' : 'default'}
              onClick={handlePropertyAction}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Action Dialog */}
      <Dialog 
        open={userActionDialog.open} 
        onOpenChange={(open) => setUserActionDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userActionDialog.action === 'ban' && 'Ban/Unban User'}
              {userActionDialog.action === 'warn' && 'Warn User'}
              {userActionDialog.action === 'role' && 'Manage User Roles'}
            </DialogTitle>
            <DialogDescription>
              {userActionDialog.action === 'ban' && 'Banned users cannot access the platform.'}
              {userActionDialog.action === 'warn' && 'Send a warning to this user.'}
              {userActionDialog.action === 'role' && 'Assign or remove roles for this user.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {userActionDialog.action === 'role' ? (
              <div className="space-y-2">
                <Label>Select Role</Label>
                <Select
                  value={userActionDialog.selectedRole}
                  onValueChange={(value) => setUserActionDialog(prev => ({ ...prev, selectedRole: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Current roles: {userRoles.filter((r: any) => r.user_id === userActionDialog.userId).map((r: any) => r.role).join(', ') || 'None'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Enter reason..."
                  value={userActionDialog.reason}
                  onChange={(e) => setUserActionDialog(prev => ({ ...prev, reason: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setUserActionDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button 
              variant={userActionDialog.action === 'ban' ? 'destructive' : 'default'}
              onClick={handleUserAction}
              disabled={userActionDialog.action === 'role' && !userActionDialog.selectedRole}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orphan Cleanup Dialog */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Orphaned Records</DialogTitle>
            <DialogDescription>
              You are about to delete {orphanedRecords.length} verification record(s) that have missing images (404 errors). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCleanupDialogOpen(false)}
              disabled={deletingOrphans}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={deleteOrphanedRecords}
              disabled={deletingOrphans}
            >
              {deletingOrphans ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={lightbox.isOpen}
        onClose={closeLightbox}
        imageSrc={lightbox.imageSrc}
        alt={lightbox.alt}
      />
    </div>
  );
};

export default Admin;
