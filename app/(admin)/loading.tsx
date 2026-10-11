export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" role="status">
      <span className="sr-only">Loading OSA dashboard data</span>
      <div className="skeleton-shimmer h-64 rounded-[28px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton-shimmer h-40 rounded-[22px]" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton-shimmer h-[360px] rounded-[22px]" />)}
      </div>
    </div>
  );
}
