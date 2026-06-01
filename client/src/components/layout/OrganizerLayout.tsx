import { SidebarLayout } from './SidebarLayout';

const navItems = [
  { label: '📋  Dashboard', path: '/organizer/events' },
  { label: '➕  Create Event', path: '/organizer/events/new' },
  { label: '📅  My Events', path: '/organizer/events' },
  { label: '📊  Statistics', path: '/admin/statistics' },
  { label: '⚙️  Settings', path: '#' },
];

export function OrganizerLayout() {
  return <SidebarLayout subtitle="ORGANIZER PORTAL" navItems={navItems} />;
}
