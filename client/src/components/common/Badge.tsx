import { getEventBadgeClasses, getEventLabel } from '../../lib/eventTypes';

const statusColors: Record<string, { bg: string; text: string }> = {
  REGISTERED: { bg: 'bg-green-50 border-green-500', text: 'text-green-600' },
  CANCELLED: { bg: 'bg-red-50 border-red-500', text: 'text-red-600' },
  ATTENDED: { bg: 'bg-blue-50 border-blue-500', text: 'text-blue-600' },
  UPCOMING: { bg: 'bg-white border-primary-600', text: 'text-primary-600' },
  FINISHED: { bg: 'bg-white border-gray-500', text: 'text-gray-500' },
  IN_PROGRESS: { bg: 'bg-white border-amber-500', text: 'text-amber-600' },
};

interface BadgeProps {
  type: 'event' | 'status' | 'urgency';
  value: string;
  className?: string;
}

export function Badge({ type, value, className = '' }: BadgeProps) {
  if (type === 'event') {
    const c = getEventBadgeClasses(value);
    return (
      <span className={`inline-block px-3 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text} ${className}`}>
        {getEventLabel(value)}
      </span>
    );
  }
  if (type === 'urgency') {
    const urgencyColors: Record<string, string> = {
      TODAY: 'bg-red-500 text-white',
      'In 3 days': 'bg-amber-500 text-white',
      'In 7 days': 'bg-gray-400 text-white',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${urgencyColors[value] || 'bg-gray-200 text-gray-600'} ${className}`}>
        {value}
      </span>
    );
  }
  const c = statusColors[value] || statusColors.FINISHED;
  return (
    <span className={`inline-block px-3 py-0.5 rounded-md text-xs font-medium border ${c.bg} ${c.text} ${className}`}>
      {value}
    </span>
  );
}
