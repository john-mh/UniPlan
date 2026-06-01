import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

export function AdminReportsPage() {
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

  const occItems: any[] = occupancy || [];
  const topStudents: any[] = participation?.topStudents || [];
  const byEventType: any[] = participation?.byEventType || [];
  const bySemester: any[] = engagement?.bySemester || [];
  const byFaculty: any[] = engagement?.byFaculty || [];

  return (
    <div>
      <h2 className="font-heading font-bold text-2xl text-primary-950 mb-1">Reports</h2>
      <p className="text-gray-500 text-sm mb-6">In-depth analytics and downloadable reports</p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Occupancy Report</h3>
          {occLoading ? (
            <Skeleton type="table" count={5} />
          ) : occItems.length === 0 ? (
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
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Student Participation</h3>
          {partLoading ? (
            <Skeleton type="table" count={5} />
          ) : topStudents.length === 0 ? (
            <EmptyState icon="👤" title="No data" description="No student registrations yet." />
          ) : (
            <>
              {topStudents.map((s: any, i: number) => (
                <div key={s.studentId} className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-heading font-bold text-lg text-primary-950 mb-4">Engagement Breakdown</h3>
        {engLoading ? (
          <Skeleton type="table" count={6} />
        ) : bySemester.length === 0 && byFaculty.length === 0 ? (
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
      </div>
    </div>
  );
}
