import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = ({ rows = 8, columns = 5 }: TableSkeletonProps) => (
  <div className="w-full space-y-2">
    {/* Header */}
    <div className="flex gap-4 px-4 py-3 border-b border-border/50">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={`h-${i}`} className="h-4 flex-1 rounded" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 px-4 py-3 items-center">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton
            key={`r-${rowIdx}-${colIdx}`}
            className={`h-4 rounded ${colIdx === 0 ? 'w-10' : 'flex-1'}`}
          />
        ))}
      </div>
    ))}
  </div>
);

export default TableSkeleton;
