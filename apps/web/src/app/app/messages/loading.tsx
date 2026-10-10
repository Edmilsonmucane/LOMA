import { Skeleton } from '@loma/ui';
export default function Loading() {
  return (
    <div className="drawer-form">
      <Skeleton className="communication-heading-skeleton" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="communication-row-skeleton" />
      ))}
    </div>
  );
}
