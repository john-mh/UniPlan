import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EventCard } from '../../components/common/EventCard';
import { formatDate } from '../../lib/format';

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'registrations' | 'recommended'>('registrations');

  const { data: registrations, isLoading: regLoading, isError: regError, refetch: regRefetch } = useQuery({
    queryKey: ['myRegistrations'],
    queryFn: () => api.getMyRegistrations(),
  });

  const { data: eventsData, isLoading: evLoading } = useQuery({
    queryKey: ['events', 'recommended'],
    queryFn: () => api.getEvents({ limit: 6 }),
    enabled: activeTab === 'recommended',
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelRegistration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRegistrations'] });
      toast.success('Registration cancelled');
      setCancelId(null);
    },
    onError: () => toast.error('Failed to cancel'),
  });

  const regs = registrations || [];

  const attendedCount = regs.filter((r: any) => r.status === 'ATTENDED').length;
  const upcomingCount = regs.filter((r: any) => r.status === 'REGISTERED').length;

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-6">My Profile</h2>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary-600 text-white text-2xl font-heading font-bold flex items-center justify-center mx-auto mb-4">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <h3 className="font-heading font-medium text-lg text-primary-950">{user?.firstName} {user?.lastName}</h3>
          <p className="text-gray-500 text-sm mb-1">{user?.email}</p>
          <p className="text-gray-400 text-xs mb-4">ID: {user?.id}</p>
          <hr className="mb-4" />
          <div className="flex justify-around mb-4">
            <div><p className="font-heading font-bold text-xl text-primary-600">{attendedCount}</p><p className="text-xs text-gray-400">Attended</p></div>
            <div><p className="font-heading font-bold text-xl text-primary-600">{upcomingCount}</p><p className="text-xs text-gray-400">Upcoming</p></div>
          </div>
          <Button variant="outline" className="w-full mb-2" onClick={() => navigate('/organizer/apply')}>
            Become an Organizer
          </Button>
        </div>

        <div className="flex-1">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'registrations' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              My Registrations
            </button>
            <button
              onClick={() => setActiveTab('recommended')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'recommended' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Recommended
            </button>
          </div>

          {activeTab === 'registrations' ? (
            regError ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Failed to load registrations.</p>
                <Button variant="outline" onClick={() => regRefetch()}>Retry</Button>
              </div>
            ) : regLoading ? (
              <Skeleton type="table" count={5} />
            ) : regs.length === 0 ? (
              <EmptyState icon="📋" title="No registrations yet" description="You haven't registered for any events." action={{ label: 'Browse Events', onClick: () => navigate('/') }} />
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs bg-gray-50">
                      <th className="py-3 px-4 font-medium">Event</th>
                      <th className="py-3 px-4 font-medium">Date</th>
                      <th className="py-3 px-4 font-medium">Type</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regs.map((reg: any) => (
                      <tr key={reg.id} className="border-t border-gray-100">
                        <td className="py-3 px-4 font-medium text-primary-950">{reg.eventTitle || `Event #${reg.eventId}`}</td>
                        <td className="py-3 px-4 text-gray-500">{reg.eventDate ? formatDate(reg.eventDate) : '-'}</td>
                        <td className="py-3 px-4">{reg.eventType && <Badge type="event" value={reg.eventType} />}</td>
                        <td className="py-3 px-4"><Badge type="status" value={reg.status} /></td>
                        <td className="py-3 px-4">
                          {reg.status === 'REGISTERED' && (
                            <button onClick={() => setCancelId(reg.id)} className="text-red-500 text-sm hover:underline">Cancel</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            evLoading ? (
              <Skeleton type="card" count={3} />
            ) : eventsData && eventsData.data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventsData.data.slice(0, 6).map((ev: any) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            ) : (
              <EmptyState icon="🎯" title="No recommendations" description="Browse events to find ones that interest you." action={{ label: 'Browse Events', onClick: () => navigate('/') }} />
            )
          )}
        </div>
      </div>

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Registration"
        actions={
          <>
            <Button variant="outline" onClick={() => setCancelId(null)}>Keep</Button>
            <Button variant="danger" onClick={() => cancelId && cancelMutation.mutate(cancelId)} loading={cancelMutation.isPending}>
              Yes, Cancel
            </Button>
          </>
        }
      >
        <p className="text-gray-500 text-sm">This will free up your spot for another student.</p>
      </Modal>
    </div>
  );
}
