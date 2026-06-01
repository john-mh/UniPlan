import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register(studentCode, email, password);
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md">
        <h2 className="font-heading font-bold text-xl text-primary-950 mb-2">Create your account</h2>
        <p className="text-gray-500 text-sm mb-6">Register with your institutional credentials</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Student Code</label>
            <input
              type="text" className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="e.g. A00374201" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Institutional Email</label>
            <input
              type="email" className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="you@univcali.edu.co" value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Password</label>
            <input
              type="password" className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Confirm Password</label>
            <input
              type="password" className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Re-enter your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>Create Account</Button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
