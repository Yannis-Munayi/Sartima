import { useEffect, useRef, useState } from 'react'
import { fetchPhotosWithFallback } from '../services/pexels'
import { useWishlist } from '../context/WishlistContext'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import styles from './OutfitBoardScreen.module.css'

function ItemThumb({ entry, selected, onClick, size = 'md' }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const { state } = useApp()
  const hint = state.gender === 'women' ? 'women' : state.gender === 'men' ? 'men' : ''

  useEffect(() => {
    let cancelled = false
    const queries = [
      `${entry.name} ${hint} fashion outfit`.trim(),
      `${entry.name} fashion`,
    ]
    fetchPhotosWithFallback(queries, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [entry.id, entry.name, hint])

  return (
    <button
      className={`${styles.thumb} ${styles[`thumb_${size}`]} ${selected ? styles.thumbSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.thumbPhoto} style={{ background: entry.gradient ?? '#222' }}>
        {photo && (
          <img
            src={photo}
            alt={entry.name}
            className={styles.thumbImg}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
      </div>
      {selected && <div className={styles.thumbCheck}>✓</div>}
      <p className={styles.thumbLabel}>{entry.name}</p>
    </button>
  )
}

function BoardCard({ board, onEdit, onDelete }) {
  return (
    <div className={styles.boardCard}>
      <div className={styles.boardHeader}>
        <div>
          <h3 className={styles.boardName}>{board.name}</h3>
          <p className={styles.boardMeta}>{board.items.length} piece{board.items.length !== 1 ? 's' : ''} · {board.aesthetic ?? 'Custom'}</p>
        </div>
        <div className={styles.boardActions}>
          <button className={styles.editBtn} onClick={() => onEdit(board)}>Edit</button>
          <button className={styles.deleteBtn} onClick={() => onDelete(board.id)}>✕</button>
        </div>
      </div>
      <div className={styles.boardGrid}>
        {board.items.slice(0, 6).map((item) => (
          <SmallThumb key={item.id} entry={item} />
        ))}
        {board.items.length > 6 && (
          <div className={styles.moreChip}>+{board.items.length - 6}</div>
        )}
      </div>
    </div>
  )
}

function SmallThumb({ entry }) {
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPhotosWithFallback([`${entry.name} fashion`], 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [entry.id])

  return (
    <div className={styles.smallThumb} style={{ background: entry.gradient ?? '#222' }}>
      {photo && (
        <img
          src={photo}
          alt={entry.name}
          className={styles.thumbImg}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
    </div>
  )
}

function BoardEditor({ board, pool, onSave, onCancel }) {
  const [name, setName]         = useState(board?.name ?? '')
  const [selected, setSelected] = useState(() => new Set((board?.items ?? []).map((i) => i.id)))
  const [aesthetic, setAesthetic] = useState(board?.aesthetic ?? '')
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  function toggle(item) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(item.id) ? next.delete(item.id) : next.add(item.id)
      return next
    })
  }

  function handleSave() {
    if (!name.trim()) { nameRef.current?.focus(); return }
    const items = pool.filter((i) => selected.has(i.id))
    onSave({
      id: board?.id ?? `board-${Date.now()}`,
      name: name.trim(),
      aesthetic: aesthetic.trim(),
      items,
      createdAt: board?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  const selectedCount = selected.size

  return (
    <div className={styles.editorOverlay}>
      <div className={styles.editor}>
        <div className={styles.editorHandle} />
        <div className={styles.editorTop}>
          <h2 className={styles.editorTitle}>{board ? 'Edit Outfit' : 'New Outfit Board'}</h2>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        </div>

        <div className={styles.editorFields}>
          <input
            ref={nameRef}
            className={styles.nameInput}
            placeholder="Outfit name (e.g. Weekend in Paris)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <input
            className={styles.aestheticInput}
            placeholder="Aesthetic tag (optional)"
            value={aesthetic}
            onChange={(e) => setAesthetic(e.target.value)}
            maxLength={40}
          />
        </div>

        <p className={styles.pickLabel}>
          Pick pieces · {selectedCount} selected
        </p>

        {pool.length === 0 ? (
          <p className={styles.emptyPool}>
            Like or save items first — they'll appear here.
          </p>
        ) : (
          <div className={styles.pickerGrid}>
            {pool.map((item) => (
              <ItemThumb
                key={item.id}
                entry={item}
                selected={selected.has(item.id)}
                onClick={() => toggle(item)}
                size="sm"
              />
            ))}
          </div>
        )}

        <div className={styles.editorFooter}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!name.trim() || selectedCount === 0}
          >
            {board ? 'Update Board' : `Save Board (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}

const GHOST_BOARDS = [
  { name: 'Weekend Casual', aesthetic: 'Streetwear', count: 4, colors: ['#2d3a2e','#4a3728','#1a1a2e','#2a2a2a'] },
  { name: 'Office Ready',   aesthetic: 'Old Money',  count: 3, colors: ['#3d2b1f','#2c3e50','#1a2634'] },
  { name: 'Date Night',     aesthetic: 'Dark Academia', count: 5, colors: ['#1a0a2e','#2d1b3d','#0d1b2a','#1a2634','#2a1a0a'] },
]

export default function OutfitBoardScreen() {
  const { user } = useAuth()
  const { outfitBoards, saveOutfitBoard, deleteOutfitBoard, liked, wishlist } = useWishlist()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)

  const pool = [
    ...liked,
    ...wishlist.filter((w) => !liked.some((l) => l.id === w.id)),
  ]

  function handleSave(board) {
    saveOutfitBoard(board)
    setEditing(null)
    setCreating(false)
  }

  if (!user) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <h1 className={styles.title}>Outfit Boards</h1>
        </div>
        <div className={styles.subheader}>
          <p className={styles.subtitle}>Curate outfits from your liked &amp; saved pieces.</p>
        </div>
        <div className={styles.lockedWrap}>
          <div className={styles.lockedContent}>
            <div className={styles.boardList} style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
              {GHOST_BOARDS.map((b) => (
                <div key={b.name} className={styles.boardCard}>
                  <div className={styles.boardHeader}>
                    <div>
                      <h3 className={styles.boardName}>{b.name}</h3>
                      <p className={styles.boardMeta}>{b.count} pieces · {b.aesthetic}</p>
                    </div>
                  </div>
                  <div className={styles.boardGrid}>
                    {b.colors.map((c, i) => (
                      <div key={i} className={styles.smallThumb} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.lockedOverlay}>
              <span className={styles.lockIcon}>🔒</span>
              <p className={styles.lockLabel}>Sign in to create outfit boards</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Outfit Boards</h1>
      </div>

      <div className={styles.subheader}>
        <p className={styles.subtitle}>Curate outfits from your liked &amp; saved pieces.</p>
        <button className={styles.newBtn} onClick={() => setCreating(true)}>
          + New Board
        </button>
      </div>

      {outfitBoards.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🗂️</div>
          <h2 className={styles.emptyTitle}>No boards yet</h2>
          <p className={styles.emptyText}>
            Tap <strong>+ New Board</strong> to start building your first outfit.
          </p>
          <button className={styles.newBtnLarge} onClick={() => setCreating(true)}>
            Create your first outfit
          </button>
        </div>
      ) : (
        <div className={styles.boardList}>
          {outfitBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onEdit={(b) => setEditing(b)}
              onDelete={deleteOutfitBoard}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BoardEditor
          board={editing ?? null}
          pool={pool}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setCreating(false) }}
        />
      )}
    </div>
  )
}
