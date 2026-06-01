import { useState } from 'react';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';
import * as api from '../../services/api';

export function ApplyOrganizerPage() {
  const [type, setType] = useState<'PROFESSOR' | 'STUDENT_LEADER' | 'BIENESTAR_STAFF'>('PROFESSOR');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [specialization, setSpecialization] = useState('');
  const [studentGroup, setStudentGroup] = useState('');
  const [semester, setSemester] = useState('');
  const [adminArea, setAdminArea] = useState('');
  const [positionTitle, setPositionTitle] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.applyAsOrganizer({
        organizerType: type,
        specialization: type === 'PROFESSOR' ? specialization : undefined,
        studentGroup: type === 'STUDENT_LEADER' ? studentGroup : undefined,
        semester: type === 'STUDENT_LEADER' ? Number(semester) || undefined : undefined,
        adminArea: type === 'BIENESTAR_STAFF' ? adminArea : undefined,
        positionTitle: type === 'BIENESTAR_STAFF' ? positionTitle : undefined,
      });
      setSubmitted(true);
      toast.success('Application submitted for review');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-8 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="font-heading font-bold text-xl text-primary-950 mb-2">Application Submitted</h2>
        <p className="text-gray-500 text-sm">An admin will review your request. You'll be notified when approved.</p>
      </div>
    );
  }

  const types = [
    { value: 'PROFESSOR' as const, label: '👨‍🏫  Professor', color: '#3B82F6' },
    { value: 'STUDENT_LEADER' as const, label: '🎓  Student Leader', color: '#EC4899' },
    { value: 'BIENESTAR_STAFF' as const, label: '🏛  Bienestar Staff', color: '#10B981' },
  ];

  return (
    <div className="max-w-lg mx-auto px-8 py-12">
      <h2 className="font-heading font-bold text-xl text-primary-950 mb-2">Become an Organizer</h2>
      <p className="text-gray-500 text-sm mb-6">I want to organize as a:</p>
      <div className="flex gap-3 mb-8">
        {types.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`flex-1 py-3 px-3 rounded-lg text-sm font-medium text-center transition-all ${
              type === t.value ? 'text-white' : 'border border-gray-200 text-gray-500'
            }`}
            style={type === t.value ? { backgroundColor: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-medium text-primary-950 text-sm mb-3">Your details:</h3>
        {type === 'PROFESSOR' && (
          <div className="space-y-3">
            <p className="text-green-600 text-xs">✓ Faculty: Facultad de Ingeniería (from institutional DB)</p>
            <p className="text-green-600 text-xs">✓ Department: Ingeniería de Sistemas (from institutional DB)</p>
            <input placeholder="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        )}
        {type === 'STUDENT_LEADER' && (
          <div className="space-y-3">
            <input placeholder="Student group/association" value={studentGroup} onChange={(e) => setStudentGroup(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            <input placeholder="Semester" type="number" value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        )}
        {type === 'BIENESTAR_STAFF' && (
          <div className="space-y-3">
            <input placeholder="Admin area" value={adminArea} onChange={(e) => setAdminArea(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            <input placeholder="Position title" value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        )}
      </div>

      <Button onClick={handleSubmit} loading={loading} className="w-full">Submit Application</Button>
    </div>
  );
}
