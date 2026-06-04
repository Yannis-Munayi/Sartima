const wrap  = { position: 'relative' }
const blur  = { filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }
const overlay = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 10, background: 'rgba(0,0,0,0.22)', borderRadius: 14,
}
const label = { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.72)', margin: 0, textAlign: 'center', padding: '0 16px' }

export default function LockedOverlay({ children, message }) {
  return (
    <div style={wrap}>
      <div style={blur}>{children}</div>
      <div style={overlay}>
        <span style={{ fontSize: 22 }}>🔒</span>
        <p style={label}>{message}</p>
      </div>
    </div>
  )
}
