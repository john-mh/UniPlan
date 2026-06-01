interface SkeletonProps {
  type: 'card' | 'table' | 'detail';
  count?: number;
}

export function Skeleton({ type, count = 3 }: SkeletonProps) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-5 w-full bg-gray-200 rounded mb-3" />
            <div className="h-4 w-3/4 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-1/2 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-2/3 bg-gray-200 rounded mb-4" />
            <div className="h-2 bg-gray-100 rounded-full mb-4" />
            <div className="h-10 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  if (type === 'table') {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" style={{ width: `${85 - i * 10}%` }} />
        ))}
      </div>
    );
  }
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-1/3 bg-gray-200 rounded" />
      <div className="h-4 w-1/2 bg-gray-200 rounded" />
      <div className="h-4 w-3/4 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-100 rounded" />
    </div>
  );
}
