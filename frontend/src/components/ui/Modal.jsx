export default function Modal({ open, children, onClose }) {
  if (!open) return null
  return (
    <div className="modal-overlay open" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal">{children}</div>
    </div>
  )
}
