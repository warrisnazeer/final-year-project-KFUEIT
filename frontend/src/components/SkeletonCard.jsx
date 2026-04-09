export default function SkeletonCard({ featured = false }) {
  return (
    <div className={`bg-white border border-brand-border rounded-xl overflow-hidden animate-pulse shadow-sm`}>
      {featured && <div className="w-full h-44 bg-stone-100" />}
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-3.5 bg-stone-200 rounded-full w-14" />
          <div className="h-3.5 bg-stone-200 rounded-full w-10" />
        </div>
        <div className="h-4 bg-stone-200 rounded w-full" />
        <div className="h-4 bg-stone-200 rounded w-5/6" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 bg-stone-100 rounded-full w-16" />
          <div className="h-5 bg-stone-100 rounded-full w-16" />
          <div className="h-5 bg-stone-100 rounded-full w-20" />
        </div>
        <div className="h-1.5 bg-amber-100 rounded-full w-full" />
      </div>
    </div>
  )
}
