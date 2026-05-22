export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
