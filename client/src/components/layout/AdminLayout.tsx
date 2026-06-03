import { SidebarLayout } from './SidebarLayout';

const navItems = [
  { label: '📅  Events', path: '/organizer/events' },
  { label: '➕  Create Event', path: '/organizer/events/new' },
  { label: '👥  Organizers', path: '/admin/organizers' },
  { label: '📊  Statistics', path: '/admin/statistics' },
  { label: '📈  Reports', path: '/admin/reports' },
  { label: '⚙️  Settings', path: '#' },
];

export function AdminLayout() {
  return <SidebarLayout subtitle="ADMIN PORTAL" navItems={navItems} userPrefix="Admin" />;
}
