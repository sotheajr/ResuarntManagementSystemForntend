import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Table,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const rangeOptions = ['today', 'week', 'month', 'year'];
const paymentColors = ['#f97316', '#10b981', '#3b82f6', '#a78bfa', '#f43f5e', '#f59e0b'];

const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [range, setRange] = useState('today');
  const [data, setData] = useState({
    summary: {},
    chart: [],
    currentMonthWeeks: [0, 0, 0, 0],
    previousMonthWeeks: [0, 0, 0, 0],
    paymentMethods: [],
    topItems: [],
    tableStatus: [],
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredBar, setHoveredBar] = useState(null);

  const fetchDashboardData = async (selectedRange = range) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/dashboard/stats', { params: { range: selectedRange } });
      const payload = response.data?.data || response.data || {};
      setData({
        summary: payload.summary || {},
        chart: payload.chart || [],
        currentMonthWeeks: payload.current_month_weeks || payload.currentMonthWeeks || [0, 0, 0, 0],
        previousMonthWeeks: payload.previous_month_weeks || payload.previousMonthWeeks || [0, 0, 0, 0],
        paymentMethods: payload.paymentMethods || [],
        topItems: payload.topItems || [],
        tableStatus: payload.tableStatus || [],
        recentOrders: payload.recentOrders || [],
      });
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError('Failed to load dashboard metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(range);
  }, [range]);

  const chartData = useMemo(() => {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return labels.map((label, index) => ({
      label,
      previous: Number(data.previousMonthWeeks[index] || 0),
      current: Number(data.currentMonthWeeks[index] || 0),
    }));
  }, [data.currentMonthWeeks, data.previousMonthWeeks]);

  const chartMax = useMemo(() => {
    const highestValue = Math.max(
      1000,
      ...chartData.flatMap((item) => [Number(item.previous || 0), Number(item.current || 0)])
    );

    return Math.ceil(highestValue / 100) * 100;
  }, [chartData]);

  const chartMeta = useMemo(() => {
    const width = 760;
    const height = 280;
    const padding = { top: 20, right: 30, bottom: 42, left: 54 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const tickValues = Array.from({ length: 11 }, (_, index) => index * 100);
    const groupWidth = 120;
    const barWidth = 24;
    const groupGap = 24;

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      tickValues,
      groupWidth,
      barWidth,
      groupGap,
    };
  }, [chartMax]);

  const totalPaymentValue = useMemo(
    () => data.paymentMethods.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [data.paymentMethods]
  );

  const topRevenue = useMemo(
    () => data.topItems.reduce((max, item) => Math.max(max, Number(item.revenue || 0)), 0),
    [data.topItems]
  );

  const donutSegments = useMemo(() => {
    if (!data.paymentMethods.length || totalPaymentValue === 0) {
      return 'rgba(148,163,184,0.2)';
    }

    let cursor = 0;
    const segments = data.paymentMethods.map((item, index) => {
      const percentage = (Number(item.total || 0) / totalPaymentValue) * 100;
      const start = cursor;
      cursor += percentage;
      return `${paymentColors[index % paymentColors.length]} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }, [data.paymentMethods, totalPaymentValue]);

  const summaryCards = [
    { label: 'Revenue', value: formatCurrency(data.summary.revenue), icon: DollarSign, tone: 'bg-emerald-100 text-emerald-600' },
    { label: 'Orders', value: data.summary.orders ?? 0, icon: ShoppingBag, tone: 'bg-blue-100 text-blue-600' },
    { label: 'Customers', value: data.summary.customers ?? 0, icon: Users, tone: 'bg-violet-100 text-violet-600' },
    { label: 'Avg. Order', value: formatCurrency(data.summary.avgOrderValue), icon: CircleDollarSign, tone: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-500">Operations overview</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Welcome back, {user?.full_name || 'Admin'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {rangeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                  range === option ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchDashboardData(range)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <LoadingSpinner message="Loading dashboard metrics..." size="lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="card flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Revenue overview</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Weekly sales</h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                  {formatCurrency(data.summary.revenue)}
                </div>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex-1">
                  {chartData.length > 0 ? (
                    <svg viewBox={`0 0 ${chartMeta.width} ${chartMeta.height}`} className="h-[300px] w-full">
                      {chartMeta.tickValues.map((tickValue) => {
                        const y = chartMeta.padding.top + chartMeta.innerHeight - (tickValue / chartMax) * chartMeta.innerHeight;
                        return (
                          <g key={`grid-${tickValue}`}>
                            <line
                              x1={chartMeta.padding.left}
                              x2={chartMeta.width - chartMeta.padding.right}
                              y1={y}
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                            <text
                              x={chartMeta.padding.left - 12}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="11"
                              fill="#64748b"
                              fontWeight="600"
                            >
                              {`$${tickValue}`}
                            </text>
                          </g>
                        );
                      })}

                      {chartData.map((entry, index) => {
                        const startX = chartMeta.padding.left + index * (chartMeta.groupWidth + chartMeta.groupGap) + 40;
                        const previousHeight = (entry.previous / chartMax) * chartMeta.innerHeight;
                        const currentHeight = (entry.current / chartMax) * chartMeta.innerHeight;
                        const previousY = chartMeta.padding.top + chartMeta.innerHeight - previousHeight;
                        const currentY = chartMeta.padding.top + chartMeta.innerHeight - currentHeight;
                        const active = hoveredBar === entry.label;

                        return (
                          <g key={entry.label}>
                            <rect
                              x={startX}
                              y={previousY}
                              width={chartMeta.barWidth}
                              height={previousHeight}
                              rx={6}
                              ry={6}
                              fill="#3b82f6"
                              opacity={active ? 1 : 0.95}
                              onMouseEnter={() => setHoveredBar(entry.label)}
                              onMouseLeave={() => setHoveredBar(null)}
                              style={{ cursor: 'pointer' }}
                            />

                            <rect
                              x={startX + chartMeta.barWidth + 12}
                              y={currentY}
                              width={chartMeta.barWidth}
                              height={currentHeight}
                              rx={6}
                              ry={6}
                              fill="#b91c1c"
                              opacity={active ? 1 : 0.95}
                              onMouseEnter={() => setHoveredBar(entry.label)}
                              onMouseLeave={() => setHoveredBar(null)}
                              style={{ cursor: 'pointer' }}
                            />

                            <text
                              x={startX + chartMeta.barWidth + 6}
                              y={chartMeta.height - 18}
                              textAnchor="middle"
                              fontSize="12"
                              fill="#334155"
                              fontWeight="700"
                            >
                              {entry.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    <div className="flex min-h-[220px] w-full items-center justify-center text-sm text-slate-500">No weekly revenue data available.</div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:w-44">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <span className="h-3.5 w-3.5 rounded-sm bg-[#3b82f6]" />
                    Previous Month
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <span className="h-3.5 w-3.5 rounded-sm bg-[#b91c1c]" />
                    Current Month
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Payment split</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Payment methods</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{data.paymentMethods.length} active</div>
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-slate-100" style={{ background: donutSegments }}>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Total</div>
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(totalPaymentValue)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {data.paymentMethods.length > 0 ? data.paymentMethods.map((method, index) => (
                  <div key={`${method.payment_method}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />
                      <span className="text-sm font-medium text-slate-700">{method.payment_method}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{formatCurrency(method.total)}</div>
                      <div className="text-xs text-slate-500">{method.count} payments</div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No payment data recorded.</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="card p-0">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Best performers</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Top selling items</h3>
                </div>
                <UtensilsCrossed className="h-5 w-5 text-slate-400" />
              </div>

              <div className="space-y-4 p-5">
                {data.topItems.length > 0 ? data.topItems.map((item, index) => (
                  <div key={`${item.name}-${index}`}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{formatCurrency(item.revenue)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                        style={{ width: `${(Number(item.revenue || 0) / Math.max(topRevenue, 1)) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.qty_sold} sold</div>
                  </div>
                )) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No top selling items yet.</div>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Floor status</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Table occupancy</h3>
                </div>
                <Table className="h-5 w-5 text-slate-400" />
              </div>

              <div className="space-y-4">
                {data.tableStatus.length > 0 ? data.tableStatus.map((row) => {
                  const total = data.tableStatus.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
                  const percent = ((Number(row.count || 0) / total) * 100).toFixed(0);
                  return (
                    <div key={row.status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700 capitalize">{row.status}</span>
                        <span className="text-slate-500">{row.count} ({percent}%)</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            row.status === 'Available' ? 'bg-emerald-500' : row.status === 'Occupied' ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No table data available.</div>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Occupancy rate</span>
                  <span className="text-lg font-bold text-slate-900">{data.summary.tableOccupancy ?? 0}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: `${data.summary.tableOccupancy ?? 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent activity</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Recent orders</h3>
              </div>
              <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-rose-600">
                View all
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Order</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Table</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Payment</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.recentOrders.length > 0 ? data.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">#{order.id}</td>
                      <td className="px-5 py-3 text-slate-700">{order.customer_name}</td>
                      <td className="px-5 py-3 text-slate-700">{order.table_number}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{order.payment_status}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(order.total_amount)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" className="px-5 py-6 text-center text-slate-500">No recent orders available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;