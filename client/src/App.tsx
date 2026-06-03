import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { OrganizerLayout } from './components/layout/OrganizerLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { EventCatalogPage } from './features/events/EventCatalogPage';
import { EventDetailPage } from './features/events/EventDetailPage';
import { CalendarPage } from './features/events/CalendarPage';
import { AboutPage } from './features/AboutPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ProfilePage } from './features/auth/ProfilePage';
import { OrganizerDashboardPage } from './features/admin/OrganizerDashboardPage';
import { CreateEventPage } from './features/events/CreateEventPage';
import { EventManagementPage } from './features/events/EventManagementPage';
import { AdminOrganizersPage } from './features/admin/AdminOrganizersPage';
import { AdminStatisticsPage } from './features/admin/AdminStatisticsPage';
import { AdminReportsPage } from './features/admin/AdminReportsPage';
import { NotFoundPage } from './features/NotFoundPage';
import { ApplyOrganizerPage } from './features/auth/ApplyOrganizerPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<EventCatalogPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/organizer/apply" element={<ProtectedRoute><ApplyOrganizerPage /></ProtectedRoute>} />

        <Route element={<ProtectedRoute roles={['ORGANIZER', 'ADMIN']}><OrganizerLayout /></ProtectedRoute>}>
          <Route path="/organizer/dashboard" element={<OrganizerDashboardPage />} />
          <Route path="/organizer/events" element={<OrganizerDashboardPage />} />
          <Route path="/organizer/events/new" element={<CreateEventPage />} />
          <Route path="/organizer/events/:id" element={<EventManagementPage />} />
          <Route path="/organizer/events/:id/edit" element={<CreateEventPage />} />
          <Route path="/organizer/statistics" element={<AdminStatisticsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route path="/admin/organizers" element={<AdminOrganizersPage />} />
          <Route path="/admin/statistics" element={<AdminStatisticsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
