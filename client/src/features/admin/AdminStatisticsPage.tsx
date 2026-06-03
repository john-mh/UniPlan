import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AdminStatisticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['allStatistics'],
    queryFn: api.getAllStatistics,
  });

  if (isLoading) return <div><h2 className="font-heading font-bold text-2xl text-primary-950 mb-6">Event Statistics</h2><Skeleton type="table" count={8} /></div>;

  const items: any[] = stats || [];
  const totalEvents = items.length;
  const totalRegistered = items.reduce((s: number, i: any) => s + Number(i.totalRegistered), 0);
  const totalCancelled = items.reduce((s: number, i: any) => s + Number(i.totalCancelled), 0);
  const avgOccupancy = totalEvents > 0
    ? Math.round(items.reduce((s: number, i: any) => s + Number(i.occupancyPercentage), 0) / totalEvents)
    : 0;

  const byType: Record<string, number> = {};
  items.forEach((i: any) => {
    byType[i.eventType] = (byType[i.eventType] || 0) + Number(i.totalRegistered);
  });
  const chartData = Object.entries(byType).map(([type, count]) => ({ type: type.replace('_', ' '), registrations: count }));

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">Event Statistics</h2>
      <p className="text-gray-500 text-sm mb-6">Overview of all event metrics and participation data</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          [totalEvents, 'Total Events', '#7C3AED'],
          [totalRegistered.toLocaleString(), 'Registrations', '#3B82F6'],
          [totalCancelled, 'Cancellations', '#EF4444'],
          [`${avgOccupancy}%`, 'Avg Occupancy', '#10B981'],
        ].map(([val, label, color]) => (
          <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="font-heading font-bold text-3xl" style={{ color: color as string }}>{val}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="📊" title="No data yet" description="Statistics will appear once events are created and registrations begin." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Registrations by Event Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="registrations" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
          </div>
        </>
      )}
    </div>
  );
}
