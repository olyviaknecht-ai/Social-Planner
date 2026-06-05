export default function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl text-valmer-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-valmer-slate/70">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
