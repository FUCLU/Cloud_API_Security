export default function Drawer({ open, children }) {
  if (!open) return null
  return <aside className="drawer open">{children}</aside>
}
