import { SidebarLayout } from './SidebarLayout';

const navItems = [
  { label: '📋  Dashboard', path: '/organizer/events' },
  { label: '➕  Create Event', path: '/organizer/events/new' },
  { label: '📊  Statistics', path: '/organizer/statistics' },
  { label: '⚙️  Settings', path: '#' },
];

export function OrganizerLayout() {
  return <SidebarLayout subtitle="ORGANIZER PORTAL" navItems={navItems} />;
}
