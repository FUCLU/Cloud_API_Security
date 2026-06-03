export default function ProductCard({ product }) {
  return (
    <article className="card">
      <div className="card-title">{product?.name}</div>
      <div className="card-sub">Tồn kho: {product?.stock}</div>
      <strong>{product?.price}</strong>
    </article>
  )
}
