import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Home, CalendarCheck, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useCurrency } from '@/hooks/useCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface EarningsData {
  totalEarnings: number;
  pendingEarnings: number;
  totalBookings: number;
  settledBookings: number;
  avgPerBooking: number;
  platformFees: number;
  earningsOverTime: { date: string; earnings: number; bookings: number }[];
  propertyBreakdown: { id: string; title: string; earnings: number; bookings: number; status: string }[];
}

const chartConfig: ChartConfig = {
  earnings: { label: "Earnings", color: "hsl(var(--chart-1))" },
  bookings: { label: "Bookings", color: "hsl(var(--chart-2))" },
};

const HostEarnings = () => {
  const { user } = useAuth();
  const { formatPrice, convertPrice, preferredCurrency } = useCurrency();
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EarningsData | null>(null);

  useEffect(() => {
    if (user) fetchEarnings();
  }, [user, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '7d': return subDays(now, 7);
      case '30d': return subDays(now, 30);
      case '90d': return subDays(now, 90);
      case '1y': return subMonths(now, 12);
      case 'all': return new Date('2020-01-01');
    }
  };

  const fetchEarnings = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const startDate = getDateRange().toISOString();

      // Fetch all bookings where user is host
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, status, total_price, host_payout_amount, platform_commission, guest_service_fee, settled_at, created_at, property_id, escrow_status')
        .eq('host_id', user.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch properties
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, status')
        .eq('host_id', user.id);

      const propertyMap = new Map(properties?.map(p => [p.id, p]) || []);

      // Calculate totals
      const settled = bookings?.filter(b => b.status === 'settled') || [];
      const pending = bookings?.filter(b => 
        ['deposit_paid', 'checked_in', 'checked_out', 'settlement_pending', 'dispute_window'].includes(b.status || '')
      ) || [];

      const totalEarnings = settled.reduce((sum, b) => sum + (Number(b.host_payout_amount) || 0), 0);
      const pendingEarnings = pending.reduce((sum, b) => {
        // Estimate: 91% of total_price
        return sum + (Number(b.total_price) * 0.91);
      }, 0);
      const platformFees = settled.reduce((sum, b) => sum + (Number(b.platform_commission) || 0), 0);

      // Earnings over time (group by day/week/month depending on range)
      const earningsMap = new Map<string, { earnings: number; bookings: number }>();
      
      settled.forEach(b => {
        const dateKey = timeRange === '7d' || timeRange === '30d'
          ? format(parseISO(b.settled_at || b.created_at), 'MMM dd')
          : format(parseISO(b.settled_at || b.created_at), 'MMM yyyy');
        
        const existing = earningsMap.get(dateKey) || { earnings: 0, bookings: 0 };
        earningsMap.set(dateKey, {
          earnings: existing.earnings + (Number(b.host_payout_amount) || 0),
          bookings: existing.bookings + 1,
        });
      });

      const earningsOverTime = Array.from(earningsMap.entries()).map(([date, vals]) => ({
        date,
        earnings: Math.round(vals.earnings * 100) / 100,
        bookings: vals.bookings,
      }));

      // Property breakdown
      const propEarnings = new Map<string, { earnings: number; bookings: number }>();
      (bookings || []).forEach(b => {
        const existing = propEarnings.get(b.property_id) || { earnings: 0, bookings: 0 };
        const earning = b.status === 'settled' ? (Number(b.host_payout_amount) || 0) : 0;
        propEarnings.set(b.property_id, {
          earnings: existing.earnings + earning,
          bookings: existing.bookings + 1,
        });
      });

      const propertyBreakdown = Array.from(propEarnings.entries()).map(([id, vals]) => {
        const prop = propertyMap.get(id);
        return {
          id,
          title: prop?.title || 'Unknown Property',
          earnings: Math.round(vals.earnings * 100) / 100,
          bookings: vals.bookings,
          status: prop?.status || 'unknown',
        };
      }).sort((a, b) => b.earnings - a.earnings);

      setData({
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        totalBookings: bookings?.length || 0,
        settledBookings: settled.length,
        avgPerBooking: settled.length > 0 ? Math.round((totalEarnings / settled.length) * 100) / 100 : 0,
        platformFees: Math.round(platformFees * 100) / 100,
        earningsOverTime,
        propertyBreakdown,
      });
    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with time range */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('earn.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('earn.subtitle')}</p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{t('earn.range_7d')}</SelectItem>
            <SelectItem value="30d">{t('earn.range_30d')}</SelectItem>
            <SelectItem value="90d">{t('earn.range_90d')}</SelectItem>
            <SelectItem value="1y">{t('earn.range_1y')}</SelectItem>
            <SelectItem value="all">{t('earn.range_all')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('earn.total_earned')}</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(data.totalEarnings)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.settledBookings === 1
                ? t('earn.from_settled', { count: data.settledBookings })
                : t('earn.from_settled_p', { count: data.settledBookings })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('earn.pending')}</p>
                <p className="text-2xl font-bold text-amber-600">{formatPrice(data.pendingEarnings)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('earn.awaiting_settlement')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('earn.avg_per_booking')}</p>
                <p className="text-2xl font-bold">{formatPrice(data.avgPerBooking)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-chart-2" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('earn.per_settled')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('earn.total_bookings')}</p>
                <p className="text-2xl font-bold">{data.totalBookings}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-chart-3/10 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-chart-3" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('earn.bookings_split', { settled: data.settledBookings, progress: data.totalBookings - data.settledBookings })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Chart */}
      {data.earningsOverTime.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('earn.over_time')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              {data.earningsOverTime.length <= 3 ? (
                <BarChart data={data.earningsOverTime} barCategoryGap="30%">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(v)} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                  <Bar dataKey="earnings" fill="url(#barGradient)" radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              ) : (
                <AreaChart data={data.earningsOverTime}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(v)} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: '#3b82f6', strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#3b82f6"
                    fill="url(#areaGradient)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    animationDuration={800}
                  />
                </AreaChart>
              )}
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Earnings Chart */}
      {data.earningsOverTime.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              {t('earn.daily')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('earn.daily_desc')}</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={data.earningsOverTime}>
                <defs>
                  <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(v)} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: '#6366f1', strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="#6366f1"
                  fill="url(#dailyGradient)"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={800}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Cumulative Growth Chart */}
      {data.earningsOverTime.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {t('earn.cumulative')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t('earn.cumulative_desc')}</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ cumulative: { label: "Total Earned", color: "#10b981" } }} className="h-[300px] w-full">
              <AreaChart data={(() => {
                let cumulative = 0;
                return data.earningsOverTime.map(d => {
                  cumulative += d.earnings;
                  return { date: d.date, cumulative: Math.round(cumulative * 100) / 100 };
                });
              })()}>
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(v)} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: '#10b981', strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#10b981"
                  fill="url(#growthGradient)"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1000}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {data.propertyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('earn.by_property')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.propertyBreakdown.map((prop) => (
                <div key={prop.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Home className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{prop.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {prop.bookings === 1
                          ? t('earn.bookings_one', { count: prop.bookings })
                          : t('earn.bookings_other', { count: prop.bookings })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(prop.earnings)}</p>
                    <Badge variant={prop.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                      {prop.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart for property comparison */}
            {data.propertyBreakdown.length > 1 && (
              <div className="mt-6">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={data.propertyBreakdown.slice(0, 10).map(p => ({ name: p.title.substring(0, 15), earnings: p.earnings }))} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="propBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPrice(v)} />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                    <Bar dataKey="earnings" fill="url(#propBarGradient)" radius={[6, 6, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Platform fees summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('earn.fee_summary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">{t('earn.gross')}</p>
              <p className="text-xl font-bold">{formatPrice(data.totalEarnings + data.platformFees)}</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">{t('earn.platform_fees_9')}</p>
              <p className="text-xl font-bold text-destructive">-{formatPrice(data.platformFees)}</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">{t('earn.net')}</p>
              <p className="text-xl font-bold text-primary">{formatPrice(data.totalEarnings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {data.totalBookings === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('earn.no_earnings_title')}</h3>
            <p className="text-muted-foreground">
              {t('earn.no_earnings_desc')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HostEarnings;
