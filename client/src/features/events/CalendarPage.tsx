import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { getEventColor } from '../../lib/eventTypes';
import { Button } from '../../components/common/Button';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function CalendarPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [selectedDay, setSelectedDay] = useState<{ day: number; events: any[] } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker && !selectedDay) return;
    const handler = (e: MouseEvent) => {
      if (showPicker && pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
      if (selectedDay && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedDay(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker, selectedDay]);

  const handleDayClick = (d: number, dayEvents: any[]) => {
    if (dayEvents.length === 0) return;
    if (dayEvents.length === 1) {
      navigate(`/events/${dayEvents[0].id}`);
      return;
    }
    setSelectedDay({ day: d, events: dayEvents });
  };

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'calendar', fmt(startOfMonth), fmt(endOfMonth)],
    queryFn: async () => {
      const res = await api.getEvents({ dateFrom: fmt(startOfMonth), dateTo: fmt(endOfMonth), limit: 200 });
      return res.data || [];
    },
  });

  const go = (dir: 'prev' | 'next') => {
    setSlideDir(dir === 'next' ? 'left' : 'right');
    if (dir === 'prev') {
      if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    } else {
      if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    }
    setTimeout(() => setSlideDir(null), 50);
  };

  const goToToday = () => {
    setSlideDir('left');
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setPickerYear(t.getFullYear());
    setTimeout(() => setSlideDir(null), 50);
  };

  const selectMonth = (m: number) => {
    setMonth(m);
    setYear(pickerYear);
    setShowPicker(false);
  };

  const getEventsForDate = (day: number) => {
    if (!events) return [];
    const dateStr = fmt(new Date(year, month, day));
    return events.filter((e: any) => e.date && e.date.slice(0, 10) === dateStr);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="bg-gray-50 rounded-lg" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = getEventsForDate(d);
    const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
    cells.push(
      <div
        key={d}
        onClick={() => handleDayClick(d, dayEvents)}
        className={`rounded-lg border p-1.5 min-h-[72px] transition-colors relative ${dayEvents.length > 0 ? 'cursor-pointer hover:shadow-md' : ''} ${isToday ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      >
        <span className={`text-xs font-medium ${isToday ? 'text-primary-600' : 'text-gray-500'}`}>{d}</span>
        <div className="mt-0.5 space-y-0.5">
          {dayEvents.slice(0, 2).map((ev: any) => (
            <div key={ev.id} className="text-[10px] leading-tight px-1 py-0.5 rounded truncate" style={{ backgroundColor: getEventColor(ev.eventType) + '20', color: getEventColor(ev.eventType) }}>
              {ev.title.slice(0, 18)}{ev.title.length > 18 ? '…' : ''}
            </div>
          ))}
          {dayEvents.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 2}</div>}
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="max-w-6xl mx-auto px-8 py-12"><Skeleton type="detail" /></div>;

  const startYear = pickerYear - 3;

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-950">Event Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Browse events by date</p>
        </div>
        <div className="flex items-center gap-2 relative">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => go('prev')}>←</Button>
          <button
            ref={headerRef}
            onClick={() => { setPickerYear(year); setShowPicker(!showPicker); }}
            className="text-lg font-heading font-medium text-primary-950 min-w-[180px] text-center rounded-lg py-1 px-3 cursor-pointer"
          >
            {MONTHS[month]} {year}
          </button>
          <Button variant="outline" size="sm" onClick={() => go('next')}>→</Button>

          {showPicker && (
            <div ref={pickerRef} className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 w-[320px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-medium mb-2">YEAR</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Array.from({ length: 7 }, (_, i) => startYear + i).map(y => (
                      <button
                        key={y}
                        onClick={() => setPickerYear(y)}
                        className={`py-1.5 px-2 rounded-lg text-sm transition-colors ${y === pickerYear ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-medium mb-2">{pickerYear}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        onClick={() => selectMonth(i)}
                        className={`py-1.5 px-2 rounded-lg text-sm transition-colors text-left ${i === month && pickerYear === year ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        {m.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="overflow-hidden">
        <div
          key={`${year}-${month}`}
          className={`grid grid-cols-7 gap-1 transition-all duration-300 ease-in-out ${
            slideDir === 'left' ? '-translate-x-4 opacity-0' : slideDir === 'right' ? 'translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
          }`}
        >
          {cells}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setSelectedDay(null)}>
          <div ref={popoverRef} className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 min-w-[340px] max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-lg text-primary-950">
                {MONTHS[month]} {selectedDay.day}, {year}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="space-y-2">
              {selectedDay.events.map((ev: any) => (
                <div
                  key={ev.id}
                  onClick={() => { navigate(`/events/${ev.id}`); setSelectedDay(null); }}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 border border-gray-100 transition-colors"
                >
                  <span className="mt-0.5 shrink-0"><Badge type="event" value={ev.eventType} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-primary-950">{ev.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.startTime} — {ev.endTime} · {ev.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-heading font-medium text-lg text-primary-950 mb-3">Upcoming Events</h2>
        <div className="space-y-2">
          {events?.filter((e: any) => new Date(e.date) >= today).slice(0, 5).map((ev: any) => (
            <div
              key={ev.id}
              onClick={() => navigate(`/events/${ev.id}`)}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-sm"
            >
              <Badge type="event" value={ev.eventType} />
              <span className="font-medium text-sm flex-1">{ev.title}</span>
              <span className="text-xs text-gray-400">{fmt(new Date(ev.date))} · {ev.startTime}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
