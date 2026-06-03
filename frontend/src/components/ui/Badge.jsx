export default function Badge({ children, tone = 'ok' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
