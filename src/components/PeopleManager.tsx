import { useStore } from '../store/useStore'

export default function PeopleManager({ onClose }: { onClose: () => void }) {
  const { people, addPerson, updatePerson, removePerson } = useStore()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl bg-valmer-mist shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">People Valmer knows</div>
            <div className="text-xs text-valmer-slate/60">Captions use these to be specific about who is in a photo.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-3 p-5">
          {people.length === 0 && (
            <div className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-valmer-slate/50">
              No people yet. Add your team and recurring partners so captions can name them with the right role.
            </div>
          )}
          {people.map((p) => (
            <div key={p.id} className="card flex items-start gap-3 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-valmer-slate text-sm font-semibold text-white">
                {(p.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                <input value={p.name} onChange={(e) => updatePerson(p.id, { name: e.target.value })} placeholder="Name" className="input py-1.5" />
                <input value={p.role} onChange={(e) => updatePerson(p.id, { role: e.target.value })} placeholder="Role (e.g. closing coordinator)" className="input py-1.5" />
                <input value={p.notes} onChange={(e) => updatePerson(p.id, { notes: e.target.value })} placeholder="Notes (optional)" className="input col-span-2 py-1.5" />
              </div>
              <button onClick={() => removePerson(p.id)} className="text-valmer-slate/30 hover:text-rose-500">✕</button>
            </div>
          ))}
          <button onClick={() => addPerson()} className="btn-outline w-full">+ Add person</button>
        </div>
      </div>
    </div>
  )
}
