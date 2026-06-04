import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const PIE_COLORS = ['#7C3AED', '#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
const PAGE_SIZE = 25;

export function AdminStatisticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
  });

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['allStatistics', page, search],
    queryFn: () => api.getAllStatistics({ page, limit: PAGE_SIZE, ...(search ? { search } : {}) }),
  });

  const items: any[] = statsData?.data || [];
  const total = statsData?.total || 0;
  const totalPages = statsData?.totalPages || 1;
  const dash: any = dashboard || {};

  const chartData = (dash.registrationsByEventType || []).map((t: any) => ({
    type: t.eventType?.replace('_', ' ') || t.eventType,
    registered: t.registered,
    cancelled: t.cancelled,
    attended: t.attended,
  }));

  const statusData = (dash.eventsByStatus || []).map((s: any) => ({
    name: s.status?.replace('_', ' ') || s.status,
    value: s.count,
  }));

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  if (isLoading || dashLoading) return <div><h2 className="font-heading font-bold text-2xl text-primary-950 mb-6">Event Statistics</h2><Skeleton type="table" count={8} /></div>;

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">Event Statistics</h2>
      <p className="text-gray-500 text-sm mb-6">Overview of all event metrics and participation data</p>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          [dash.totalEvents ?? 0, 'Total Events', '#7C3AED'],
          [dash.activeEvents ?? 0, 'Active Events', '#3B82F6'],
          [dash.finishedEvents ?? 0, 'Finished', '#10B981'],
          [dash.totalRegistrations ?? 0, 'Registrations', '#F59E0B'],
          [`${dash.avgOccupancy ?? 0}%`, 'Avg Occupancy', '#EC4899'],
        ].map(([val, label, color]) => (
          <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="font-heading font-bold text-2xl" style={{ color: color as string }}>{val}</p>
            <p className="text-gray-500 text-xs mt-1">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Registrations by Event Type</h3>
          {chartData.length === 0 ? (
            <EmptyState icon="📊" title="No data" description="Data will appear once registrations begin." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="registered" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Registered" />
                <Bar dataKey="attended" fill="#10B981" radius={[4, 4, 0, 0]} name="Attended" />
                <Bar dataKey="cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} name="Cancelled" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Events by Status</h3>
          {statusData.length === 0 ? (
            <EmptyState icon="📊" title="No data" description="Status data will appear once events are created." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">{total} event{total !== 1 ? 's' : ''} total</p>
          <input
            type="text"
            placeholder="Search events..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-300"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState icon="🔍" title="No events found" description={search ? `No events matching "${search}"` : 'Statistics will appear once events are created.'} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs bg-gray-50">
                <th className="py-3 px-4 font-medium">Event</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Registered</th>
                <th className="py-3 px-4 font-medium">Cancelled</th>
                <th className="py-3 px-4 font-medium">Attended</th>
                <th className="py-3 px-4 font-medium">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s: any) => (
                <tr key={s.eventId} className="border-t border-gray-100">
                  <td className="py-3 px-4 font-medium">{s.eventTitle}</td>
                  <td className="py-3 px-4 text-gray-500">{s.eventType}</td>
                  <td className="py-3 px-4">{s.totalRegistered}</td>
                  <td className="py-3 px-4">{s.totalCancelled}</td>
                  <td className="py-3 px-4">{s.totalAttended}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-gray-100 rounded-full flex-1 max-w-[80px] overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.occupancyPercentage}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{s.occupancyPercentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
