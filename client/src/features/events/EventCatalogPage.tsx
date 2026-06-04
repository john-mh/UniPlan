import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../lib/useDebounce';
import * as api from '../../services/api';
import { EventCard } from '../../components/common/EventCard';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { EVENT_TYPE_LABELS } from '../../lib/eventTypes';

export function EventCatalogPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput, 300);
  const typeParam = activeTab === 'All' ? undefined : activeTab.toUpperCase();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['events', typeParam, debouncedSearch, page],
    queryFn: () => api.getEvents({ type: typeParam || '', search: debouncedSearch || '', limit: 12, page, status: 'UPCOMING' }),
  });

  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <div className="bg-primary-950 px-8 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-heading font-bold text-4xl md:text-5xl text-white mb-4">Discover University Events</h1>
          <p className="text-primary-200 text-base md:text-lg mb-6 max-w-xl">
            Workshops, talks, sports tournaments, volunteering — all in one place.
          </p>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search events..."
                className="w-full h-12 pl-4 pr-4 rounded-xl bg-white/15 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:border-primary-400"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 -mt-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {['All', ...EVENT_TYPE_LABELS].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeTab === tab ? 'bg-primary-600 text-white font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="border-l border-gray-200 pl-3 flex gap-1">
              <button onClick={() => setView('grid')} className={`px-2 py-1 rounded text-sm ${view === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-500'}`}>Grid</button>
              <button onClick={() => setView('calendar')} className={`px-2 py-1 rounded text-sm ${view === 'calendar' ? 'bg-primary-100 text-primary-600' : 'text-gray-500'}`}>Calendar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 pb-12">
        {isError ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Failed to load events.</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : view === 'calendar' ? (
          <CalendarView events={data?.data || []} />
        ) : isLoading ? (
          <Skeleton type="card" count={6} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.data.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-8">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="🔍"
            title="No events found"
            description="Try adjusting your filters or search terms."
            action={{ label: 'Clear Filters', onClick: () => { setActiveTab('All'); setSearchInput(''); } }}
          />
        )}
      </div>
    </div>
  );
}

function CalendarView({ events }: { events: any[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();

  const eventDays = new Set<number>();
  events.forEach((e) => {
    const d = new Date(e.date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      eventDays.add(d.getDate());
    }
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-heading font-bold text-xl text-primary-950 mb-4">{monthNames[month]} {year}</h3>
      <div className="grid grid-cols-7 text-center text-sm text-gray-400 mb-2">
        {dayNames.map(d => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="p-2" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const hasEvent = eventDays.has(day);
          return (
            <div key={day} className={`p-2 border border-gray-100 min-h-[60px] ${day === today ? 'bg-primary-50' : ''}`}>
              <span className={`text-sm font-medium ${day === today ? 'text-primary-600' : 'text-gray-700'}`}>{day}</span>
              {hasEvent && <div className="flex gap-1 mt-1 justify-center"><div className="w-2 h-2 rounded-full bg-primary-400" /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
