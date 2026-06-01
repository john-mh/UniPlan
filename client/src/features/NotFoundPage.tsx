import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/common/EmptyState';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <EmptyState
        icon="🔍"
        title="Page not found"
        description="The page you're looking for\ndoesn't exist."
        action={{ label: 'Go Home', onClick: () => navigate('/') }}
      />
    </div>
  );
}
