import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '../../services/api';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

export function AdminOrganizersPage() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const queryClient = useQueryClient();

  const { data: organizers, isLoading } = useQuery({
    queryKey: ['organizers', filter],
    queryFn: () => api.getOrganizers(filter),
  });

  const approveMutation = useMutation({
    mutationFn: api.approveOrganizer,
    onSuccess: () => {
      toast.success('Organizer approved');
      queryClient.invalidateQueries({ queryKey: ['organizers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: api.rejectOrganizer,
    onSuccess: () => {
      toast.success('Organizer rejected');
      queryClient.invalidateQueries({ queryKey: ['organizers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to reject'),
  });

  const counts = {
    pending: organizers?.filter((o: any) => !o.approved_by_admin && o.is_active).length || 0,
    approved: organizers?.filter((o: any) => o.approved_by_admin).length || 0,
  };

  const filtered = organizers?.filter((o: any) => {
    if (filter === 'pending') return !o.approved_by_admin && o.is_active;
    if (filter === 'approved') return o.approved_by_admin;
    return true;
  }) || [];

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">Organizer Approvals</h2>
      <p className="text-gray-500 text-sm mb-6">Review and approve organizer registration requests</p>
      <div className="flex gap-1 mb-6">
        {[
          ['pending', `Pending (${counts.pending})`],
          ['approved', `Approved (${counts.approved})`],
          ['all', 'All'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton type="table" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title={filter === 'pending' ? 'All caught up!' : 'No organizers'} description={filter === 'pending' ? 'No pending organizer applications to review.' : 'No organizers match this filter.'} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs bg-gray-50">
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Department</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="py-3 px-4 font-medium">{o.first_name} {o.last_name}</td>
                  <td className="py-3 px-4 text-gray-500">{o.email}</td>
                  <td className="py-3 px-4 text-gray-500">{o.organizer_type}</td>
                  <td className="py-3 px-4 text-gray-500">{o.department || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      o.approved_by_admin ? 'bg-green-100 text-green-700' : o.is_active ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {o.approved_by_admin ? 'Approved' : o.is_active ? 'Pending' : 'Rejected'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {!o.approved_by_admin && o.is_active && (
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => approveMutation.mutate(o.id)} loading={approveMutation.isPending}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => rejectMutation.mutate(o.id)} loading={rejectMutation.isPending}>Reject</Button>
                      </div>
                    )}
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
