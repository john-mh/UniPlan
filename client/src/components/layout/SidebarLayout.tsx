import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  path: string;
}

interface SidebarLayoutProps {
  subtitle: string;
  navItems: NavItem[];
  userPrefix?: string;
}

export function SidebarLayout({ subtitle, navItems, userPrefix }: SidebarLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-primary-950 flex flex-col shrink-0">
        <div className="p-7">
          <Link to="/" className="text-white font-heading font-bold text-2xl">UniPlan</Link>
          <p className="text-primary-300 text-xs mt-1">{subtitle}</p>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map(({ label, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={label}
                to={path}
                className={`block px-4 py-2.5 rounded-lg text-sm mb-1 ${
                  active ? 'bg-primary-600 text-white font-medium' : 'text-primary-300 hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="p-6 border-t border-primary-800">
            <p className="text-white text-sm font-medium">
              {userPrefix ? `${userPrefix}: ` : ''}{user.firstName} {user.lastName}
            </p>
            <p className="text-primary-300 text-xs">{user.email}</p>
            <button onClick={logout} className="text-red-400 text-xs mt-2 hover:text-red-300">Log out</button>
          </div>
        )}
      </aside>
      <main className="flex-1 p-8"><Outlet /></main>
    </div>
  );
}
