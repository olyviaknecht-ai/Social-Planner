import { useState } from 'react'
import { useStore } from '../store/useStore'
import { cls } from '../lib/ui'
import ShareBrand from './ShareBrand'

export default function BrandSwitcher() {
  const { brands, activeBrandId, switchBrand, addBrand, renameBrand, removeBrand } = useStore()
  const [open, setOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const active = brands.find((b) => b.id === activeBrandId) || brands[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white/10"
      >
        <span className="truncate font-serif text-lg leading-tight text-white">{active?.name}</span>
        <span className="text-white/60">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-black/10 bg-white text-valmer-ink shadow-xl animate-fadeup">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-valmer-slate/50">Your brands</div>
            {brands.map((b) => (
              <div key={b.id} className={cls('group flex items-center gap-1 px-2 py-1', b.id === activeBrandId && 'bg-valmer-clay/10')}>
                <button
                  onClick={() => { switchBrand(b.id); setOpen(false) }}
                  className="flex flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-black/5"
                >
                  <span className={cls('h-2 w-2 rounded-full', b.id === activeBrandId ? 'bg-valmer-clay' : 'bg-black/20')} />
                  <span className="truncate">{b.name}</span>
                </button>
                <button
                  onClick={() => { const n = prompt('Rename brand', b.name); if (n?.trim()) renameBrand(b.id, n.trim()) }}
                  className="rounded px-1 text-xs text-valmer-slate/40 opacity-0 hover:text-valmer-slate group-hover:opacity-100"
                  title="Rename"
                >
                  ✎
                </button>
                {brands.length > 1 && (
                  <button
                    onClick={() => { if (confirm(`Delete brand "${b.name}" and all its content? This cannot be undone.`)) removeBrand(b.id) }}
                    className="rounded px-1 text-xs text-valmer-slate/40 opacity-0 hover:text-rose-500 group-hover:opacity-100"
                    title="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => { setShareOpen(true); setOpen(false) }}
              className="block w-full border-t border-black/5 px-4 py-2.5 text-left text-sm text-valmer-slate hover:bg-black/5"
            >
              Share this brand
            </button>
            <button
              onClick={() => { const n = prompt('New brand name'); if (n?.trim()) { addBrand(n.trim()); setOpen(false) } }}
              className="block w-full border-t border-black/5 px-4 py-2.5 text-left text-sm font-medium text-valmer-clay hover:bg-valmer-clay/5"
            >
              + Add a brand
            </button>
          </div>
        </>
      )}

      {shareOpen && <ShareBrand onClose={() => setShareOpen(false)} />}
    </div>
  )
}
