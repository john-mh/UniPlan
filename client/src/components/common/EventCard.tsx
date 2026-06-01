import type { EventDto } from '@uniplan/shared';
import { Badge } from './Badge';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatTime } from '../../lib/format';
import { getEventColor } from '../../lib/eventTypes';

interface EventCardProps {
  event: EventDto;
}

export function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();
  const pct = Math.round((event.currentRegistrations / event.maxAttendees) * 100);
  const nearFull = event.maxAttendees - event.currentRegistrations <= 5 && event.currentRegistrations < event.maxAttendees;

  const eventDate = new Date(event.date + 'T' + (event.startTime || '00:00'));
  const now = new Date();
  const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const urgencyBadge = diffDays === 0 ? 'TODAY' : diffDays <= 3 && diffDays > 0 ? `In ${diffDays} days` : null;

  return (
    <div
      onClick={() => navigate(`/events/${event.id}`)}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
    >
      <div className="h-1.5" style={{ backgroundColor: getEventColor(event.eventType) }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Badge type="event" value={event.eventType} />
          {urgencyBadge && <Badge type="urgency" value={urgencyBadge} />}
        </div>
        <h3 className="font-heading font-medium text-lg text-primary-950 mb-3 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {event.title}
        </h3>
        <div className="space-y-1.5 text-sm text-gray-500">
          <p>📅 {formatDate(event.date)}</p>
          <p>🕐 {formatTime(event.startTime)} — {formatTime(event.endTime)}</p>
          <p>📍 {event.location}</p>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{event.currentRegistrations} / {event.maxAttendees} spots</span>
            <span>{pct}% filled</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: getEventColor(event.eventType) }}
            />
          </div>
        </div>
        <div className="mt-4">
          <span
            className={`block text-center py-2 rounded-lg text-sm font-medium transition-colors ${
              nearFull ? 'bg-amber-500 text-white' : 'bg-primary-600 text-white group-hover:bg-primary-700'
            }`}
          >
            {nearFull ? 'Almost Full!' : 'View & Register'}
          </span>
        </div>
      </div>
    </div>
  );
}


