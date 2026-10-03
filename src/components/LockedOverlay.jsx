import Icon from './Icon'

const wrap  = { position: 'relative' }
const blur  = { filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }
const overlay = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 'var(--space-3)', background: 'rgba(0,0,0,0.22)', borderRadius: 'var(--radius-md)',
}
const label = { fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', margin: 0, textAlign: 'center', padding: '0 var(--space-4)' }

export default function LockedOverlay({ children, message }) {
  return (
    <div style={wrap}>
      <div style={blur}>{children}</div>
      <div style={overlay}>
        <Icon name="lock" size={20} />
        <p style={label}>{message}</p>
      </div>
    </div>
  )
}
