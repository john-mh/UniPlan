import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function AdminReportsPage() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
  });

  const { data: occupancy, isLoading: occLoading } = useQuery({
    queryKey: ['occupancyReport'],
    queryFn: api.getOccupancyReport,
  });

  const { data: participation, isLoading: partLoading } = useQuery({
    queryKey: ['participationReport'],
    queryFn: api.getParticipationReport,
  });

  const { data: engagement, isLoading: engLoading } = useQuery({
    queryKey: ['engagementReport'],
    queryFn: api.getEngagementReport,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['trendsReport'],
    queryFn: () => api.getTrendsReport(12),
  });

  const { data: organizerPerf, isLoading: orgLoading } = useQuery({
    queryKey: ['organizerPerformance'],
    queryFn: () => api.getOrganizerPerformance(12),
  });

  const { data: facultyBreakdown, isLoading: facLoading } = useQuery({
    queryKey: ['facultyByEventType'],
    queryFn: () => api.getFacultyByEventType(12),
  });

  const occItems: any[] = occupancy || [];
  const topStudents: any[] = participation?.topStudents || [];
  const byEventType: any[] = participation?.byEventType || [];
  const bySemester: any[] = engagement?.bySemester || [];
  const byFaculty: any[] = engagement?.byFaculty || [];
  const trendData: any[] = trends || [];
  const orgData: any[] = organizerPerf || [];
  const dash: any = dashboard || {};

  const isLoading = dashLoading || occLoading || partLoading || engLoading || trendsLoading || orgLoading || facLoading;

  const facultyFlatData = (() => {
    if (!facultyBreakdown) return [];
    const flat: Array<{ eventType: string; faculty: string; count: number }> = [];
    for (const [eventType, entries] of Object.entries(facultyBreakdown as Record<string, Array<{ faculty: string; count: number }>>)) {
      for (const e of entries.slice(0, 5)) flat.push({ eventType, faculty: e.faculty, count: e.count });
    }
    return flat;
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading font-bold text-2xl text-primary-950">Reports</h2>
        <div className="flex gap-2">
          <button onClick={() => api.downloadCSV('/statistics/dashboard?format=csv', 'dashboard.csv')} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">📥 Dashboard CSV</button>
          <button onClick={() => api.downloadExcel()} className="text-xs px-3 py-1.5 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg font-medium">📥 Excel (All Reports)</button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">In-depth analytics, charts, and downloadable reports</p>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton type="table" count={4} />
          <Skeleton type="table" count={4} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              [dash.totalEvents ?? 0, 'Total Events', '#7C3AED'],
              [dash.totalRegistrations ?? 0, 'Registrations', '#3B82F6'],
              [dash.totalUniqueStudents ?? 0, 'Unique Students', '#10B981'],
              [dash.totalOrganizers ?? 0, 'Organizers', '#F59E0B'],
              [`${dash.avgOccupancy ?? 0}%`, 'Avg Occupancy', '#EC4899'],
            ].map(([val, label, color]) => (
              <div key={label as string} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="font-heading font-bold text-2xl" style={{ color: color as string }}>{val}</p>
                <p className="text-gray-500 text-xs mt-1">{label as string}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Monthly Trends</h3>
              {trendData.length === 0 ? (
                <EmptyState icon="📈" title="No trend data" description="Trends will appear with more data over time." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="registrations" stroke="#7C3AED" strokeWidth={2} name="Registrations" />
                    <Line type="monotone" dataKey="events" stroke="#10B981" strokeWidth={2} name="Events" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Organizer Performance</h3>
              {orgData.length === 0 ? (
                <EmptyState icon="👤" title="No organizer data" description="Organizer metrics will appear with more events." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={orgData.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="organizerName" tick={{ fontSize: 11 }} width={95} />
                    <Tooltip />
                    <Bar dataKey="totalRegistrations" fill="#7C3AED" radius={[0, 4, 4, 0]} name="Registrations" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Faculty by Event Type</h3>
            {facultyFlatData.length === 0 ? (
              <EmptyState icon="🏛️" title="No faculty data" description="Faculty breakdown will appear with more registrations." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={facultyFlatData} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="faculty" tick={{ fontSize: 11 }} width={135} />
                  <Tooltip />
                  <Legend />
                  {[...new Set(facultyFlatData.map((d: any) => d.eventType))].map((et, i) => (
                    <Bar key={et as string} dataKey={(entry: any) => entry.eventType === et ? entry.count : 0} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} name={et as string} stackId="a" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Occupancy Report</h3>
              {occItems.length === 0 ? (
                <EmptyState icon="📊" title="No data" description="No events with registrations yet." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs">
                      <th className="pb-2">Event Type</th>
                      <th className="pb-2">Events</th>
                      <th className="pb-2">Avg Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occItems.map((r: any) => (
                      <tr key={r.eventType} className="border-b border-gray-100">
                        <td className="py-2.5 font-medium">{r.eventType}</td>
                        <td className="py-2.5 text-gray-500">{r.totalEvents}</td>
                        <td className="py-2.5 font-heading font-bold">{r.avgOccupancy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => api.downloadCSV('/reports/occupancy?format=csv', 'occupancy.csv')} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">📥 CSV</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Student Participation</h3>
              {topStudents.length === 0 ? (
                <EmptyState icon="👤" title="No data" description="No student registrations yet." />
              ) : (
                <>
                  {topStudents.map((s: any, i: number) => (
                    <div key={s.studentId} className="flex items-center gap-3 py-2 border-b border-gray-100">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.studentName}</p>
                        <p className="text-xs text-gray-400">{s.studentId}</p>
                      </div>
                      <span className="font-heading font-bold text-primary-600">{s.eventCount} events</span>
                    </div>
                  ))}
                  {byEventType.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-2">By Event Type</p>
                      {byEventType.map((t: any) => (
                        <div key={t.eventType} className="flex justify-between text-sm py-1">
                          <span>{t.eventType}</span>
                          <span className="font-medium">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => api.downloadCSV('/reports/participation?format=csv', 'participation.csv')} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">📥 CSV</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Engagement Breakdown</h3>
            {bySemester.length === 0 && byFaculty.length === 0 ? (
              <EmptyState icon="📈" title="No engagement data" description="Engagement metrics will appear with more registrations." />
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {bySemester.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">By Semester</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 text-xs">
                          <th className="pb-2">Semester</th>
                          <th className="pb-2">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySemester.map((s: any) => (
                          <tr key={s.semester} className="border-b border-gray-100">
                            <td className="py-2">{s.semester}</td>
                            <td className="py-2 font-medium">{s.studentCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {byFaculty.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">By Faculty</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 text-xs">
                          <th className="pb-2">Faculty</th>
                          <th className="pb-2">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byFaculty.map((f: any) => (
                          <tr key={f.faculty} className="border-b border-gray-100">
                            <td className="py-2">{f.faculty}</td>
                            <td className="py-2 font-medium">{f.studentCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => api.downloadCSV('/reports/engagement?format=csv', 'engagement.csv')} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">📥 CSV</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
