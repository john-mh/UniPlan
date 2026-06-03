import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/api';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { formatDate } from '../../lib/format';

export function OrganizerDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['organizerEvents', user?.id],
    queryFn: () => api.getEvents({ organizerId: user?.id || '', limit: 100 }),
    enabled: !!user?.id,
  });

  const events = eventsData?.data || [];
  const totalEvents = events.length;
  const totalRegistrations = events.reduce((s: number, e: any) => s + (Number(e.currentRegistrations) || 0), 0);
  const avgOccupancy = totalEvents > 0
    ? Math.round(events.reduce((s: number, e: any) => s + (e.maxAttendees > 0 ? (Number(e.currentRegistrations) / e.maxAttendees) * 100 : 0), 0) / totalEvents)
    : 0;
  const activeEvents = events.filter((e: any) => {
    const d = new Date(e.date + 'T00:00:00');
    const now = new Date();
    return d.toDateString() === now.toDateString() || d > now;
  }).length;

  const duplicateMutation = useMutation({
    mutationFn: ({ id, newDate }: { id: string; newDate?: string }) => api.duplicateEvent(id, newDate),
    onSuccess: () => {
      toast.success('Event duplicated!');
      queryClient.invalidateQueries({ queryKey: ['organizerEvents'] });
      setDuplicatingId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to duplicate');
      setDuplicatingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      toast.success('Event deleted!');
      queryClient.invalidateQueries({ queryKey: ['organizerEvents'] });
      setDeletingId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete');
      setDeletingId(null);
    },
  });

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">Dashboard</h2>
      <p className="text-gray-500 text-sm mb-6">Welcome back, {user?.firstName}! Here's your event overview.</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          [totalEvents, 'Total Events', '#7C3AED'],
          [totalRegistrations, 'Registrations', '#3B82F6'],
          [`${avgOccupancy}%`, 'Avg Occupancy', '#10B981'],
          [activeEvents, 'Active Now', '#F59E0B'],
        ].map(([val, label, color]) => (
          <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="font-heading font-bold text-3xl" style={{ color: color as string }}>{val}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-lg text-primary-950">My Events</h3>
        <Link to="/organizer/events/new">
          <Button variant="primary" size="sm">+ New Event</Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton type="table" count={6} />
      ) : events.length === 0 ? (
        <EmptyState icon="📅" title="No events yet" description="Create your first event to get started." action={{ label: 'Create Event', onClick: () => {} }} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs bg-gray-50">
                <th className="py-3 px-4 font-medium">Code</th>
                <th className="py-3 px-4 font-medium">Event</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Reg.</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="py-3 px-4 text-gray-500">{e.uniqueCode}</td>
                  <td className="py-3 px-4 font-medium">{e.title}</td>
                  <td className="py-3 px-4 text-gray-500">{formatDate(e.date)}</td>
                  <td className="py-3 px-4"><Badge type="event" value={e.eventType} /></td>
                  <td className="py-3 px-4">{e.currentRegistrations}/{e.maxAttendees}</td>
                  <td className="py-3 px-4"><Badge type="status" value={e.status} /></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <Link to={`/organizer/events/${e.id}`}><Button variant="outline" size="sm">Manage</Button></Link>
                      <Link to={`/organizer/events/${e.id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
                      <Button variant="outline" size="sm" loading={duplicatingId === e.id && duplicateMutation.isPending} onClick={() => { setDuplicatingId(e.id); duplicateMutation.mutate({ id: e.id }); }}>Dup</Button>
                      <Button variant="outline" size="sm" loading={deletingId === e.id && deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete "${e.title}"? This cannot be undone.`)) { setDeletingId(e.id); deleteMutation.mutate(e.id); } }} className="text-red-600 border-red-300 hover:bg-red-50">Del</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
