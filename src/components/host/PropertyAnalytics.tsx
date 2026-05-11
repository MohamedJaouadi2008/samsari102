import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Heart, DollarSign, Calendar, TrendingUp, Clock, Users, Timer, LogOut, MousePointer } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig 
} from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import SmartPricingPanel from "@/components/host/SmartPricingPanel";
import OccupancyForecastPanel from "@/components/host/OccupancyForecastPanel";
import AIInsightsPanel from "@/components/host/AIInsightsPanel";

type TimeRange = '7d' | '30d' | '1y' | '5y';

interface PropertyStats {
  totalViews: number;
  uniqueViews: number;
  viewsPerVisit: number;
  avgDuration: number;
  bounceRate: number;
  wishlisted: number;
  totalRevenue: number;
  totalBookings: number;
  averageStay: number;
  conversionRate: number;
  viewsOverTime: { date: string; views: number }[];
  bookingsByPeriod: { period: string; bookings: number; revenue: number }[];
  referrerBreakdown: { name: string; value: number; color: string }[];
  peakPeriod: string;
}

const chartConfig = {
  views: {
    label: "Views",
    color: "hsl(var(--chart-1))",
  },
  bookings: {
    label: "Bookings",
    color: "hsl(var(--chart-2))",
  },
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const PropertyAnalytics: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [propertyTitle, setPropertyTitle] = useState('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [stats, setStats] = useState<PropertyStats>({
    totalViews: 0,
    uniqueViews: 0,
    viewsPerVisit: 0,
    avgDuration: 0,
    bounceRate: 0,
    wishlisted: 0,
    totalRevenue: 0,
    totalBookings: 0,
    averageStay: 0,
    conversionRate: 0,
    viewsOverTime: [],
    bookingsByPeriod: [],
    referrerBreakdown: [],
    peakPeriod: 'N/A',
  });

  const getStartDate = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case '7d':
        return subDays(now, 7);
      case '30d':
        return subDays(now, 30);
      case '1y':
        return subYears(now, 1);
      case '5y':
        return subYears(now, 5);
      default:
        return subDays(now, 30);
    }
  };

  const getTimeRangeLabel = (range: TimeRange): string => {
    switch (range) {
      case '7d':
        return t('analytics.last_7_days');
      case '30d':
        return t('analytics.last_30_days');
      case '1y':
        return t('analytics.last_year');
      case '5y':
        return t('analytics.last_5_years');
      default:
        return t('analytics.last_30_days');
    }
  };

  useEffect(() => {
    if (propertyId && user) {
      fetchAnalytics();
    }
  }, [propertyId, user, timeRange]);

  const fetchAnalytics = async () => {
    if (!propertyId || !user) return;
    
    setLoading(true);
    try {
      // Fetch property to verify ownership and get title
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('title, host_id')
        .eq('id', propertyId)
        .single();

      if (propertyError || !property) {
        toast({
          title: t('common.error'),
          description: t('analytics.property_not_found'),
          variant: "destructive"
        });
        navigate('/profile');
        return;
      }

      if (property.host_id !== user.id) {
        toast({
          title: t('analytics.access_denied'),
          description: t('analytics.no_access'),
          variant: "destructive"
        });
        navigate('/profile');
        return;
      }

      setPropertyTitle(property.title);
      setHostId(property.host_id);

      const startDate = getStartDate(timeRange);

      // Fetch views within time range - EXCLUDE HOST VIEWS
      // Note: .neq() in PostgREST excludes NULL values, so use .or() to include anonymous views
      const { data: views, error: viewsError } = await supabase
        .from('property_views')
        .select('*')
        .eq('property_id', propertyId)
        .gte('viewed_at', startDate.toISOString())
        .or(`viewer_id.neq.${property.host_id},viewer_id.is.null`);

      // Fetch wishlisted count (all time)
      const { count: wishlistCount, error: wishlistError } = await supabase
        .from('saved_properties')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', propertyId);

      // Fetch bookings within time range
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('property_id', propertyId)
        .gte('created_at', startDate.toISOString());

      if (viewsError || wishlistError || bookingsError) {
        console.error('Error fetching analytics:', { viewsError, wishlistError, bookingsError });
      }

      const rawViews = views || [];
      const bookingsData = bookings || [];

      // Quality-view filter: only count views where the visitor stayed at least 15 seconds.
      // Views still in-flight (no duration recorded yet, e.g. user still on page) are excluded
      // from the displayed totals to avoid inflating numbers with bounces.
      const viewsData = rawViews.filter(
        (v) => v.duration_seconds != null && v.duration_seconds >= 15
      );

      // Calculate total views (15s+ quality views, host already excluded by query)
      const totalViews = viewsData.length;

      // Calculate unique visitors (by session_id) from quality views
      const uniqueSessions = new Set(viewsData.map(v => v.session_id).filter(Boolean));
      const uniqueViews = uniqueSessions.size || totalViews;

      // Calculate views per visit
      const viewsPerVisit = uniqueViews > 0 ? Math.round((totalViews / uniqueViews) * 10) / 10 : 0;

      // Calculate average visit duration
      const viewsWithDuration = viewsData.filter(v => v.duration_seconds != null && v.duration_seconds > 0);
      const avgDuration = viewsWithDuration.length > 0
        ? Math.round(viewsWithDuration.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / viewsWithDuration.length)
        : 0;

      // Calculate bounce rate
      // Bounce rate: % of all recorded visits (raw, with duration) that bounced (<15s)
      const viewsWithBounce = rawViews.filter(v => v.is_bounce != null);
      const bounces = viewsWithBounce.filter(v => v.is_bounce === true).length;
      const bounceRate = viewsWithBounce.length > 0
        ? Math.round((bounces / viewsWithBounce.length) * 100)
        : 0;

      // Calculate referrer breakdown (accurate traffic sources)
      const referrerCounts: Record<string, number> = {};
      viewsData.forEach(v => {
        const type = v.referrer_type || 'direct';
        referrerCounts[type] = (referrerCounts[type] || 0) + 1;
      });
      
      const REFERRER_COLORS: Record<string, string> = {
        direct: 'hsl(221, 83%, 53%)',
        homepage: 'hsl(262, 83%, 58%)',
        search: 'hsl(142, 71%, 45%)',
        internal: 'hsl(199, 89%, 48%)',
        facebook: '#1877F2',
        instagram: '#E4405F',
        twitter: '#1DA1F2',
        whatsapp: '#25D366',
        google: '#4285F4',
        external: 'hsl(45, 93%, 47%)',
      };
      
      const referrerBreakdown = Object.entries(referrerCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: REFERRER_COLORS[name] || 'hsl(var(--muted))',
      })).sort((a, b) => b.value - a.value);

      // Calculate total revenue and bookings - use correct status values
      const revenueStatuses = ['settled', 'settlement_pending', 'dispute_window', 'checked_out', 'checked_in', 'deposit_paid'];
      const confirmedBookings = bookingsData.filter(b => 
        revenueStatuses.includes(b.status || '')
      );
      const settledBookings = bookingsData.filter(b => b.status === 'settled');
      // Use host_payout_amount for settled, estimate 91% net for others
      const totalRevenue = confirmedBookings.reduce((sum, b) => {
        if (b.status === 'settled') {
          return sum + (Number(b.host_payout_amount) || 0);
        }
        // For non-settled but confirmed bookings, show expected revenue (91% after platform fee)
        return sum + Math.round((b.total_price || 0) * 0.91);
      }, 0);
      const totalBookings = confirmedBookings.length;

      // Calculate average stay
      let averageStay = 0;
      if (confirmedBookings.length > 0) {
        const totalNights = confirmedBookings.reduce((sum, b) => {
          const checkIn = parseISO(b.check_in_date);
          const checkOut = parseISO(b.check_out_date);
          return sum + differenceInDays(checkOut, checkIn);
        }, 0);
        averageStay = Math.round(totalNights / confirmedBookings.length * 10) / 10;
      }

      // Calculate conversion rate
      const conversionRate = totalViews > 0 
        ? Math.round((totalBookings / totalViews) * 100 * 10) / 10 
        : 0;

      // Generate views and bookings over time based on time range
      const viewsOverTime: { date: string; views: number }[] = [];
      const bookingsByPeriod: { period: string; bookings: number; revenue: number }[] = [];

      if (timeRange === '7d' || timeRange === '30d') {
        // Daily data
        const days = timeRange === '7d' ? 7 : 30;
        for (let i = days - 1; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayViews = viewsData.filter(v => 
            format(parseISO(v.viewed_at), 'yyyy-MM-dd') === dateStr
          ).length;
          viewsOverTime.push({ date: format(date, 'MMM dd'), views: dayViews });

          const dayBookings = confirmedBookings.filter(b => 
            format(parseISO(b.created_at), 'yyyy-MM-dd') === dateStr
          );
          bookingsByPeriod.push({
            period: format(date, 'MMM dd'),
            bookings: dayBookings.length,
            revenue: dayBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
          });
        }
      } else if (timeRange === '1y') {
        // Monthly data for 1 year
        for (let i = 11; i >= 0; i--) {
          const monthDate = subMonths(new Date(), i);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          
          const monthViews = viewsData.filter(v => {
            const viewDate = parseISO(v.viewed_at);
            return viewDate >= monthStart && viewDate <= monthEnd;
          }).length;
          viewsOverTime.push({ date: format(monthDate, 'MMM yyyy'), views: monthViews });

          const monthBookings = confirmedBookings.filter(b => {
            const bookingDate = parseISO(b.created_at);
            return bookingDate >= monthStart && bookingDate <= monthEnd;
          });
          bookingsByPeriod.push({
            period: format(monthDate, 'MMM yyyy'),
            bookings: monthBookings.length,
            revenue: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
          });
        }
      } else if (timeRange === '5y') {
        // Yearly data for 5 years
        for (let i = 4; i >= 0; i--) {
          const yearDate = subYears(new Date(), i);
          const yearStart = new Date(yearDate.getFullYear(), 0, 1);
          const yearEnd = new Date(yearDate.getFullYear(), 11, 31, 23, 59, 59);
          
          const yearViews = viewsData.filter(v => {
            const viewDate = parseISO(v.viewed_at);
            return viewDate >= yearStart && viewDate <= yearEnd;
          }).length;
          viewsOverTime.push({ date: format(yearDate, 'yyyy'), views: yearViews });

          const yearBookings = confirmedBookings.filter(b => {
            const bookingDate = parseISO(b.created_at);
            return bookingDate >= yearStart && bookingDate <= yearEnd;
          });
          bookingsByPeriod.push({
            period: format(yearDate, 'yyyy'),
            bookings: yearBookings.length,
            revenue: yearBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
          });
        }
      }

      // Find peak booking period
      const monthCounts: Record<string, number> = {};
      confirmedBookings.forEach(b => {
        const month = format(parseISO(b.check_in_date), 'MMMM');
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });
      const peakMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
      const peakPeriod = peakMonth ? peakMonth[0] : 'N/A';

      setStats({
        totalViews,
        uniqueViews,
        viewsPerVisit,
        avgDuration,
        bounceRate,
        wishlisted: wishlistCount || 0,
        totalRevenue,
        totalBookings,
        averageStay,
        conversionRate,
        viewsOverTime,
        bookingsByPeriod,
        referrerBreakdown,
        peakPeriod,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: t('common.error'),
        description: t('analytics.load_error'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile?tab=properties')}
            className="mb-4 md:mb-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('analytics.back_to_properties')}
          </Button>
          
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('analytics.select_period')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('analytics.last_7_days')}</SelectItem>
              <SelectItem value="30d">{t('analytics.last_30_days')}</SelectItem>
              <SelectItem value="1y">{t('analytics.last_year')}</SelectItem>
              <SelectItem value="5y">{t('analytics.last_5_years')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{propertyTitle}</p>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('analytics.total_views')}</CardTitle>
              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.totalViews.toLocaleString()}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {stats.uniqueViews.toLocaleString()} {t('analytics.unique_visitors')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/50 dark:to-pink-900/30 border-pink-200 dark:border-pink-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-pink-700 dark:text-pink-300">{t('analytics.wishlisted')}</CardTitle>
              <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-900 dark:text-pink-100">{stats.wishlisted}</div>
              <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                {t('analytics.people_saved')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">{t('analytics.total_revenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {stats.totalBookings} {t('analytics.bookings')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">{t('analytics.conversion_rate')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.conversionRate}%</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {t('analytics.views_to_bookings')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.views_per_visit')}</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.viewsPerVisit}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.pages_per_session')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.visit_duration')}</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgDuration >= 60 
                  ? `${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s`
                  : `${stats.avgDuration}s`
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.average_time_on_page')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.bounce_rate')}</CardTitle>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bounceRate}%</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.left_quickly')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.average_stay')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageStay} {t('analytics.nights')}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.per_booking')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Views Over Time - Modern Area Chart */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                {t('analytics.views_over_time')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{getTimeRangeLabel(timeRange)}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.viewsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="views" 
                      stroke="hsl(221, 83%, 53%)" 
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorViews)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Bookings & Revenue - Modern Bar Chart */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                {t('analytics.bookings_revenue')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{getTimeRangeLabel(timeRange)}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.bookingsByPeriod} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? `${value.toLocaleString()}` : value,
                        name === 'revenue' ? t('analytics.total_revenue') : t('analytics.total_bookings')
                      ]}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(value) => value === 'bookings' ? t('analytics.total_bookings') : t('analytics.total_revenue')}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="bookings" 
                      fill="hsl(262, 83%, 58%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="revenue" 
                      fill="hsl(142, 71%, 45%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Traffic Sources - Full Width */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              {t('analytics.traffic_sources')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Where your visitors come from</p>
          </CardHeader>
          <CardContent>
            {stats.referrerBreakdown.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="w-full lg:w-1/2 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.referrerBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {stats.referrerBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value} visits`, '']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 space-y-3">
                  {stats.referrerBreakdown.map((source, index) => {
                    const percentage = stats.totalViews > 0 ? Math.round((source.value / stats.totalViews) * 100) : 0;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full shadow-sm" 
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="font-medium">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: source.color 
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold min-w-[40px] text-right">{source.value}</span>
                          <span className="text-xs text-muted-foreground min-w-[35px] text-right">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t('analytics.no_traffic_data')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.peak_period')}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.peakPeriod}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.most_popular_month')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.total_bookings')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.confirmed_reservations')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('analytics.total_revenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} TND</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.from_bookings').replace('{count}', stats.totalBookings.toString())}
              </p>
            </CardContent>
          </Card>
        </div>

        {propertyId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <SmartPricingPanel propertyId={propertyId} />
            <OccupancyForecastPanel propertyId={propertyId} />
            <div className="lg:col-span-2">
              <AIInsightsPanel scope="property" propertyId={propertyId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyAnalytics;
