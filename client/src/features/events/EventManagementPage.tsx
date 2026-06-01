import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '../../services/api';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../lib/format';

export function EventManagementPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'registrations' | 'messages'>('registrations');
  const [messageText, setMessageText] = useState('');

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(Number(id)),
    enabled: !!id,
  });

  const { data: eventStats } = useQuery({
    queryKey: ['eventStats', id],
    queryFn: () => api.getEventStatistics(Number(id)),
    enabled: !!id,
  });

  const { data: registrations, isLoading: regLoading } = useQuery({
    queryKey: ['eventRegistrations', id],
    queryFn: () => api.getEventRegistrations(Number(id)),
    enabled: !!id && activeTab === 'registrations',
  });

  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api.getMessageHistory(Number(id)),
    enabled: !!id && activeTab === 'messages',
  });

  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => api.sendMessage(Number(id), text),
    onSuccess: () => {
      toast.success('Message sent');
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send'),
  });

  const handleExportCSV = async () => {
    try {
      const csv = await api.exportEventCSV(Number(id));
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inscriptions-${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const regs: any[] = registrations || [];
  const pct = event ? Math.round((event.currentRegistrations / event.maxAttendees) * 100) : 0;

  return (
    <div>
      <Link to="/organizer/dashboard" className="text-gray-500 text-sm mb-4 block hover:text-gray-700">← Back to My Events</Link>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">{event?.title || 'Event Management'}</h2>
      <p className="text-gray-500 text-xs mb-4">{event?.uniqueCode} — {event?.eventType} — {event?.date}</p>
      {event && <Badge type="status" value={event.status} />}

      <div className="grid grid-cols-4 gap-4 my-6">
        {[
          [event?.maxAttendees || 0, 'Max Spots', '#7E6B9E'],
          [eventStats?.total_registered ?? event?.currentRegistrations ?? 0, 'Registered', '#7C3AED'],
          [eventStats?.total_cancelled ?? 0, 'Cancelled', '#EF4444'],
          [`${pct}%`, 'Occupancy', '#10B981'],
        ].map(([val, label, color]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="font-heading font-bold text-2xl" style={{ color }}>{val}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActiveTab('registrations')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'registrations' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Inscription List ({regs.length})
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`text-sm transition-colors ${activeTab === 'messages' ? 'text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Messages
        </button>
        <div className="ml-auto">
          <button onClick={handleExportCSV} className="px-4 py-1.5 border border-primary-600 text-primary-600 rounded-lg text-sm hover:bg-primary-50">Export CSV</button>
        </div>
      </div>

      {activeTab === 'registrations' ? (
        regLoading ? (
          <Skeleton type="table" count={5} />
        ) : regs.length === 0 ? (
          <EmptyState icon="📋" title="No registrations yet" description="Students will appear here once they register." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs bg-gray-50">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Student Code</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r: any, i: number) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4 font-medium">{r.firstName} {r.lastName}</td>
                    <td className="py-3 px-4 text-gray-500">{r.studentId}</td>
                    <td className="py-3 px-4 text-gray-500">{r.email}</td>
                    <td className="py-3 px-4 text-gray-500">{formatDate(r.registrationDate)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'REGISTERED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 max-h-96 overflow-y-auto">
            {msgLoading ? (
              <Skeleton type="table" count={3} />
            ) : messages && messages.length > 0 ? (
              messages.map((m: any, i: number) => (
                <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{m.senderName || m.sentBy}</span>
                    <span className="text-xs text-gray-400">{new Date(m.sentAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-600">{m.text}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No messages yet. Send updates to registered students.</p>
            )}
          </div>
          <div className="flex gap-3">
            <textarea
              className="flex-1 h-20 px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none"
              placeholder="Write a message to registered participants..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={() => messageText.trim() && sendMessageMutation.mutate(messageText.trim())}
              loading={sendMessageMutation.isPending}
              disabled={!messageText.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
