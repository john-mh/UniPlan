import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username, password);
      toast.success('Welcome back!');
      if (result.role === 'ADMIN' || result.role === 'ORGANIZER') {
        navigate('/organizer/events');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="font-heading font-bold text-2xl text-primary-600 mb-2">UniPlan</h2>
          <p className="text-gray-500 text-sm">Welcome back! Log in to your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Email</label>
            <input
              type="text"
              className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-600"
              placeholder="you@univcali.edu.co"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-950 mb-1">Password</label>
            <input
              type="password"
              className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-600"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>Log In</Button>
        </form>
        <div className="text-center text-sm text-gray-400 my-4">or</div>
        <p className="text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">Create one</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-6">© 2026 UniPlan · Universidad Icesi</p>
      </div>
    </div>
  );
}
