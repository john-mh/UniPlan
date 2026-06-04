import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { formatDate, formatTime } from '../../lib/format';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id!),
    enabled: !!id,
  });

  const { data: myRegs } = useQuery({
    queryKey: ['myRegistrations'],
    queryFn: () => api.getMyRegistrations(),
    enabled: isAuthenticated,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.registerForEvent(id!),
    onSuccess: () => {
      toast.success('Successfully registered!');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['myRegistrations'] });
      setShowConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Registration failed');
      setShowConfirm(false);
    },
  });

  if (isLoading) return <div className="max-w-6xl mx-auto px-8 py-12"><Skeleton type="detail" /></div>;
  if (!event) return <div className="max-w-6xl mx-auto px-8 py-12"><p className="text-gray-500">Event not found</p></div>;

  const ev = event as any;
  const detail = ev.typeSpecificFields;
  const spotsLeft = ev.maxAttendees - ev.currentRegistrations;
  const pct = Math.round((ev.currentRegistrations / ev.maxAttendees) * 100);
  const alreadyRegistered = myRegs?.some((r: any) => r.eventId === ev.id && r.status === 'REGISTERED');
  const eventDate = new Date(ev.date);
  const today = new Date(new Date().toDateString());
  const isPastEvent = eventDate < today;

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <button onClick={() => navigate(-1)} className="text-gray-500 text-sm mb-4 hover:text-gray-700">← Back to Events</button>
      <p className="text-xs text-gray-400 mb-6">Events  ›  {ev.title}</p>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <h1 className="font-heading font-bold text-3xl text-primary-950 mb-3">{ev.title}</h1>
          <div className="flex items-center gap-3 mb-6">
            <Badge type="event" value={ev.eventType} />
            {alreadyRegistered && <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Registered</span>}
          </div>

          <div className="space-y-2 text-gray-500 text-sm mb-6">
            <p>📅  {formatDate(ev.date, true)}</p>
            <p>🕐  {formatTime(ev.startTime)} — {formatTime(ev.endTime)}</p>
            <p>📍  {ev.location}</p>
          </div>

          <hr className="mb-6" />

          <h2 className="font-heading font-medium text-lg text-primary-950 mb-3">About this event</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-lg">{ev.description}</p>

          {detail && (
            <TypeSpecificSection eventType={ev.eventType} detail={detail} />
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
            <span className="inline-block px-3 py-1 bg-green-500 text-white text-xs font-medium rounded mb-4">FREE</span>
            <p className="font-heading font-bold text-2xl text-primary-950 mb-1">{spotsLeft} spots left</p>
            <p className="text-gray-400 text-xs mb-4">out of {ev.maxAttendees} total</p>
            <div className="h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400 mb-6">{pct}% filled</p>

            {isPastEvent ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm font-medium">This event has ended</p>
                <p className="text-gray-400 text-xs mt-1">{formatDate(ev.date, true)}</p>
              </div>
            ) : !isAuthenticated ? (
              <Button variant="primary" className="w-full" onClick={() => navigate('/login')}>Log in to Register</Button>
            ) : alreadyRegistered ? (
              <Button variant="outline" className="w-full" disabled>Already Registered</Button>
            ) : spotsLeft <= 0 ? (
              <Button variant="outline" className="w-full" disabled>Full</Button>
            ) : (
              <>
                <Button variant="primary" className="w-full mb-3" onClick={() => setShowConfirm(true)}>Register Now</Button>
                <Button variant="outline" className="w-full" onClick={() => {
                  const start = `${ev.date}T${ev.startTime}:00`;
                  const end = `${ev.date}T${ev.endTime}:00`;
                  const params = new URLSearchParams({
                    action: 'TEMPLATE',
                    text: ev.title,
                    dates: `${start.replace(/[-:]/g, '')}/${end.replace(/[-:]/g, '')}`,
                    details: ev.description || '',
                    location: ev.location || '',
                  });
                  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
                }}>
                  Add to Calendar
                </Button>
              </>
            )}

            <hr className="my-6" />
            <div className="space-y-3 text-sm">
              {[
                ['📅', 'Date', formatDate(ev.date, true)],
                ['🕐', 'Time', `${formatTime(ev.startTime)} — ${formatTime(ev.endTime)}`],
                ['📍', 'Location', ev.location],
                ['🏷️', 'Type', ev.eventType],
              ].map(([icon, label, value]) => (
                <div key={label}>
                  <p className="text-gray-400 text-xs">{icon} {label}</p>
                  <p className="text-primary-950 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Registration"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => registerMutation.mutate()} loading={registerMutation.isPending}>
              Confirm Registration
            </Button>
          </>
        }
      >
        <div className="bg-primary-50 rounded-lg p-4 mb-4">
          <p className="font-medium text-primary-950">{ev.title}</p>
          <p className="text-sm text-gray-500">{formatDate(ev.date, true)} · {formatTime(ev.startTime)} — {formatTime(ev.endTime)} · {ev.location}</p>
        </div>
        <p className="text-sm text-gray-500">You're about to register for this event. No additional prerequisites required.</p>
      </Modal>
    </div>
  );
}

function TypeSpecificSection({ eventType, detail }: { eventType: string; detail: any }) {
  if (!detail) return null;

  if (eventType === 'WORKSHOP') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-medium text-primary-950 mb-3">Workshop Details</h3>
        {detail.materials?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1">Materials</p>
            <div className="flex flex-wrap gap-1">
              {detail.materials.map((m: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">{m}</span>
              ))}
            </div>
          </div>
        )}
        {detail.prerequisiteSubjectCode && (
          <div className="mb-2">
            <p className="text-xs text-gray-400">Prerequisite</p>
            <p className="text-sm">{detail.prerequisiteSubjectCode}{detail.prerequisiteSemester ? ` (Semester ${detail.prerequisiteSemester}+)` : ''}</p>
          </div>
        )}
        {!detail.materials?.length && !detail.prerequisiteSubjectCode && (
          <p className="text-sm text-gray-500">No additional requirements.</p>
        )}
      </div>
    );
  }

  if (eventType === 'TALK') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
        <h3 className="font-medium text-primary-950">Talk Details</h3>
        {detail.speakerName && (
          <div>
            <p className="text-xs text-gray-400">Speaker</p>
            <p className="text-sm font-medium">{detail.speakerName}</p>
            {detail.speakerAffiliation && <p className="text-xs text-gray-500">{detail.speakerAffiliation}</p>}
          </div>
        )}
        {detail.speakerProfile && (
          <div>
            <p className="text-xs text-gray-400">About the Speaker</p>
            <p className="text-sm text-gray-600">{detail.speakerProfile}</p>
          </div>
        )}
        {detail.extendedDescription && (
          <div>
            <p className="text-xs text-gray-400">Extended Description</p>
            <p className="text-sm text-gray-600">{detail.extendedDescription}</p>
          </div>
        )}
        {detail.relatedLinks?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Related Links</p>
            {detail.relatedLinks.map((link: string, i: number) => (
              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary-600 hover:underline">{link}</a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (eventType === 'SPORTS_TOURNAMENT') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
        <h3 className="font-medium text-primary-950">Tournament Details</h3>
        {detail.sportType && (
          <div>
            <p className="text-xs text-gray-400">Sport</p>
            <p className="text-sm font-medium">{detail.sportType}</p>
          </div>
        )}
        <div className="flex gap-6">
          {detail.playersPerTeam && (
            <div>
              <p className="text-xs text-gray-400">Players Per Team</p>
              <p className="text-sm font-medium">{detail.playersPerTeam}</p>
            </div>
          )}
          {detail.tournamentStructure && (
            <div>
              <p className="text-xs text-gray-400">Structure</p>
              <p className="text-sm font-medium">{detail.tournamentStructure}</p>
            </div>
          )}
        </div>
        {detail.rules && (
          <div>
            <p className="text-xs text-gray-400">Rules</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{detail.rules}</p>
          </div>
        )}
      </div>
    );
  }

  if (eventType === 'VOLUNTEERING') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
        <h3 className="font-medium text-primary-950">Volunteering Details</h3>
        {detail.cause && (
          <div>
            <p className="text-xs text-gray-400">Cause</p>
            <p className="text-sm font-medium">{detail.cause}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400">Hours Required</p>
          <p className="text-sm font-bold text-primary-600">{detail.hoursRequired}h</p>
        </div>
        {detail.activities?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Activities</p>
            <ul className="list-disc list-inside text-sm text-gray-600">
              {detail.activities.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
        {detail.meetingPoints?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Meeting Points</p>
            {detail.meetingPoints.map((mp: string, i: number) => (
              <p key={i} className="text-sm text-gray-600">{mp}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (eventType === 'OTHER') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-medium text-primary-950 mb-3">Additional Information</h3>
        {detail.additionalInfo && Object.keys(detail.additionalInfo).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(detail.additionalInfo).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-gray-400 capitalize">{key}:</span>
                <span className="text-gray-700">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No additional details.</p>
        )}
      </div>
    );
  }

  return null;
}
