import { SidebarLayout } from './SidebarLayout';

const navItems = [
  { label: '👥  Organizers', path: '/admin/organizers' },
  { label: '📊  Statistics', path: '/admin/statistics' },
  { label: '📈  Reports', path: '/admin/reports' },
  { label: '⚙️  Settings', path: '#' },
];

export function AdminLayout() {
  return <SidebarLayout subtitle="ADMIN PORTAL" navItems={navItems} userPrefix="Admin" />;
}
