import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';

export function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-page">
      <nav className="h-16 bg-white border-b border-gray-200 flex items-center px-8 sticky top-0 z-50">
        <Link to="/" className="text-primary-600 font-heading font-bold text-2xl">UniPlan</Link>
        <div className="hidden md:flex items-center gap-8 ml-10">
          <Link to="/" className="text-primary-950 font-body text-sm font-medium">Events</Link>
          <Link to="/calendar" className="text-primary-950 font-body text-sm font-medium">Calendar</Link>
          <Link to="/about" className="text-primary-950 font-body text-sm font-medium">About</Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {(user.role === 'ADMIN' || user.role === 'ORGANIZER') && (
                <button
                  onClick={() => navigate('/organizer/events')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Dashboard
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-10 h-10 rounded-full bg-primary-600 text-white font-medium text-sm flex items-center justify-center"
                >
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Profile</Link>
                    {user.role === 'STUDENT' && (
                      <Link to="/organizer/apply" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Become Organizer</Link>
                    )}
                    <hr className="my-1" />
                    <button onClick={logout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Log Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50">Log In</button>
              <button onClick={() => navigate('/register')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Register</button>
            </>
          )}
        </div>
      </nav>
      <main><Outlet /></main>
    </div>
  );
}
