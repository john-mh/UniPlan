import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '../../services/api';
import { Button } from '../../components/common/Button';
import { Skeleton } from '../../components/common/Skeleton';
import { EVENT_TYPE_VALUES } from '../../lib/eventTypes';

interface TypeSpecificFields {
  [key: string]: string | number | boolean | string[] | Record<string, unknown>;
}

export function CreateEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '', description: '', eventType: 'WORKSHOP', date: '',
    startTime: '', endTime: '', location: '', maxAttendees: 30,
  });
  const [typeFields, setTypeFields] = useState<TypeSpecificFields>({});
  const [loading, setLoading] = useState(false);

  const { data: existingEvent, isLoading: loadingEvent } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingEvent) {
      setForm({
        title: existingEvent.title || '',
        description: existingEvent.description || '',
        eventType: existingEvent.eventType || 'WORKSHOP',
        date: existingEvent.date || '',
        startTime: existingEvent.startTime || '',
        endTime: existingEvent.endTime || '',
        location: existingEvent.location || '',
        maxAttendees: existingEvent.maxAttendees || 30,
      });
      const tsFields = (existingEvent as any).typeSpecificFields;
      if (tsFields) {
        const { _id, __v, eventId, eventType, createdAt, updatedAt, ...fields } = tsFields;
        setTypeFields(fields as TypeSpecificFields);
      }
    }
  }, [existingEvent]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createEvent(data),
    onSuccess: () => {
      toast.success('Event published!');
      navigate('/organizer/events');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create event'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updateEvent(Number(id), data),
    onSuccess: () => {
      toast.success('Event updated!');
      navigate('/organizer/events');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update event'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, typeSpecificFields: typeFields };
    if (isEdit) {
      const updates: Record<string, unknown> = {};
      if (payload.title !== existingEvent?.title) updates.title = payload.title;
      if (payload.description !== existingEvent?.description) updates.description = payload.description;
      if (payload.eventType !== existingEvent?.eventType) updates.eventType = payload.eventType;
      if (payload.date !== existingEvent?.date) updates.date = payload.date;
      if (payload.startTime !== existingEvent?.startTime) updates.startTime = payload.startTime;
      if (payload.endTime !== existingEvent?.endTime) updates.endTime = payload.endTime;
      if (payload.location !== existingEvent?.location) updates.location = payload.location;
      if (payload.maxAttendees !== existingEvent?.maxAttendees) updates.maxAttendees = payload.maxAttendees;
      if (Object.keys(typeFields).length > 0) (updates as any).typeSpecificFields = typeFields;
      updateMutation.mutate(updates);
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));
  const updateType = (field: string, value: unknown) => setTypeFields((f) => ({ ...f, [field]: value }) as TypeSpecificFields);

  const handleEventTypeChange = (newType: string) => {
    update('eventType', newType);
    setTypeFields({});
  };

  if (isEdit && loadingEvent) return <div className="max-w-2xl"><Skeleton type="detail" /></div>;

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
      <p className="text-gray-500 text-sm mb-6">{isEdit ? 'Update the event details below.' : 'Fill in the details below.'}</p>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Event Title</label>
            <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.title} onChange={(e) => update('title', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Event Type</label>
            <select className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.eventType} onChange={(e) => handleEventTypeChange(e.target.value)}>
              {EVENT_TYPE_VALUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-primary-950 mb-1">Description</label>
            <textarea className="w-full h-24 px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.description} onChange={(e) => update('description', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Date</label>
            <input type="date" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.date} onChange={(e) => update('date', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Location</label>
            <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.location} onChange={(e) => update('location', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Start Time</label>
            <input type="time" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">End Time</label>
            <input type="time" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Max Attendees</label>
            <input type="number" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" value={form.maxAttendees} onChange={(e) => update('maxAttendees', Number(e.target.value))} min={1} required />
          </div>
        </div>

        {form.eventType === 'WORKSHOP' && (
          <TypeSection title="Workshop Details">
            <Field label="Materials (comma-separated)">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.materials as string[])?.join(', ') || ''}
                onChange={(e) => updateType('materials', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prerequisite Subject Code">
                <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                  value={(typeFields.prerequisiteSubjectCode as string) || ''}
                  onChange={(e) => updateType('prerequisiteSubjectCode', e.target.value)} />
              </Field>
              <Field label="Prerequisite Semester">
                <input type="number" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" min={1} max={12}
                  value={(typeFields.prerequisiteSemester as number) || ''}
                  onChange={(e) => updateType('prerequisiteSemester', Number(e.target.value))} />
              </Field>
            </div>
          </TypeSection>
        )}

        {form.eventType === 'TALK' && (
          <TypeSection title="Talk Details">
            <Field label="Speaker Name">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.speakerName as string) || ''}
                onChange={(e) => updateType('speakerName', e.target.value)} />
            </Field>
            <Field label="Speaker Affiliation">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.speakerAffiliation as string) || ''}
                onChange={(e) => updateType('speakerAffiliation', e.target.value)} />
            </Field>
            <Field label="Speaker Profile/Bio">
              <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.speakerProfile as string) || ''}
                onChange={(e) => updateType('speakerProfile', e.target.value)} />
            </Field>
            <Field label="Related Links (comma-separated URLs)">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.relatedLinks as string[])?.join(', ') || ''}
                onChange={(e) => updateType('relatedLinks', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Extended Description">
              <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.extendedDescription as string) || ''}
                onChange={(e) => updateType('extendedDescription', e.target.value)} />
            </Field>
          </TypeSection>
        )}

        {form.eventType === 'SPORTS_TOURNAMENT' && (
          <TypeSection title="Sports Tournament Details">
            <Field label="Sport Type">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" required
                value={(typeFields.sportType as string) || ''}
                onChange={(e) => updateType('sportType', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Players Per Team">
                <input type="number" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" min={1}
                  value={(typeFields.playersPerTeam as number) || ''}
                  onChange={(e) => updateType('playersPerTeam', Number(e.target.value))} />
              </Field>
              <Field label="Tournament Structure">
                <select className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                  value={(typeFields.tournamentStructure as string) || 'KNOCKOUT'}
                  onChange={(e) => updateType('tournamentStructure', e.target.value)}>
                  <option value="KNOCKOUT">Knockout</option>
                  <option value="LEAGUE">League</option>
                  <option value="GROUPS">Groups + Knockout</option>
                </select>
              </Field>
            </div>
            <Field label="Rules">
              <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.rules as string) || ''}
                onChange={(e) => updateType('rules', e.target.value)} />
            </Field>
          </TypeSection>
        )}

        {form.eventType === 'VOLUNTEERING' && (
          <TypeSection title="Volunteering Details">
            <Field label="Cause">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.cause as string) || ''}
                onChange={(e) => updateType('cause', e.target.value)} />
            </Field>
            <Field label="Hours Required">
              <input type="number" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" min={1} required
                value={(typeFields.hoursRequired as number) || ''}
                onChange={(e) => updateType('hoursRequired', Number(e.target.value))} />
            </Field>
            <Field label="Activities (comma-separated)">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.activities as string[])?.join(', ') || ''}
                onChange={(e) => updateType('activities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Meeting Points (comma-separated)">
              <input className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm"
                value={(typeFields.meetingPoints as string[])?.join(', ') || ''}
                onChange={(e) => updateType('meetingPoints', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </Field>
          </TypeSection>
        )}

        {form.eventType === 'OTHER' && (
          <TypeSection title="Additional Information">
            <Field label="Additional Info (JSON)">
              <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono"
                placeholder='{"key": "value"}'
                value={JSON.stringify(typeFields.additionalInfo || {}, null, 2)}
                onChange={(e) => {
                  try { updateType('additionalInfo', JSON.parse(e.target.value)); } catch {}
                }} />
            </Field>
          </TypeSection>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? 'Save Changes' : 'Publish Event'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/organizer/events')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

function TypeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-heading font-medium text-primary-950 border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-950 mb-1">{label}</label>
      {children}
    </div>
  );
}
