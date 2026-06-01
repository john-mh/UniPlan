export const EVENT_TYPE_CONFIG = {
  WORKSHOP: { color: '#10B981', bg: 'bg-green-500', text: 'text-white', label: 'Workshop' },
  TALK: { color: '#3B82F6', bg: 'bg-blue-500', text: 'text-white', label: 'Talk' },
  SPORTS_TOURNAMENT: { color: '#F59E0B', bg: 'bg-amber-500', text: 'text-white', label: 'Sports' },
  VOLUNTEERING: { color: '#EC4899', bg: 'bg-pink-500', text: 'text-white', label: 'Volunteering' },
  OTHER: { color: '#6B7280', bg: 'bg-gray-500', text: 'text-white', label: 'Other' },
} as const;

export const EVENT_TYPE_VALUES = Object.keys(EVENT_TYPE_CONFIG) as Array<keyof typeof EVENT_TYPE_CONFIG>;

export const EVENT_TYPE_LABELS = EVENT_TYPE_VALUES.map(k => EVENT_TYPE_CONFIG[k].label);

export function getEventColor(eventType: string): string {
  return EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG]?.color ?? '#6B7280';
}

export function getEventBadgeClasses(eventType: string): { bg: string; text: string } {
  const config = EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG];
  return config ? { bg: config.bg, text: config.text } : { bg: 'bg-gray-500', text: 'text-white' };
}

export function getEventLabel(eventType: string): string {
  return EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG]?.label ?? eventType;
}
