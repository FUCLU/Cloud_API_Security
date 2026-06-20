import React, { useMemo, useState } from 'react'

const PRODUCT_IMAGES = {
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  mouse: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  headphone: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
  polo: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
}

const INITIAL_PRODUCTS = [
  { id: 1, n: 'Laptop ASUS VivoBook 15', c: 'Điện tử', price: 15490000, s: 'ok', stock: 24, img: PRODUCT_IMAGES.laptop },
  { id: 2, n: 'Chuột Logitech MX3', c: 'Điện tử', price: 1890000, s: 'ok', stock: 18, img: PRODUCT_IMAGES.mouse },
  { id: 3, n: 'Bàn phím Keychron K2', c: 'Điện tử', price: 2450000, s: 'low', stock: 4, img: PRODUCT_IMAGES.keyboard },
  { id: 4, n: 'Tai nghe Sony WH-1000XM5', c: 'Điện tử', price: 7990000, s: 'ok', stock: 11, img: PRODUCT_IMAGES.headphone },
  { id: 5, n: 'Cà phê Arabica Đà Lạt', c: 'Thực phẩm', price: 180000, s: 'ok', stock: 80, img: PRODUCT_IMAGES.coffee },
  { id: 6, n: 'Áo polo nam Uniqlo', c: 'Thời trang', price: 490000, s: 'low', stock: 6, img: PRODUCT_IMAGES.polo },
  { id: 7, n: 'Giày Nike Air Max', c: 'Thời trang', price: 2200000, s: 'out', stock: 0, img: PRODUCT_IMAGES.shoes },
  { id: 8, n: 'Màn hình LG 27"', c: 'Điện tử', price: 6800000, s: 'low', stock: 3, img: PRODUCT_IMAGES.monitor },
]

const STATUS_LABEL = { ok: 'Còn hàng', low: 'Sắp hết', out: 'Hết hàng' }
const STATUS_BADGE = { ok: 'badge-green', low: 'badge-amber', out: 'badge-red' }

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function deriveStatus(stock) {
  if (Number(stock) <= 0) return 'out'
  if (Number(stock) <= 6) return 'low'
  return 'ok'
}

function ProductPhoto({ item }) {
  return (
    <>
      <img
        className="product-photo"
        src={item.img}
        alt={item.n}
        loading="lazy"
        onError={event => {
          event.currentTarget.style.display = 'none'
          event.currentTarget.nextElementSibling?.classList.add('show')
        }}
      />
      <span className="product-image-fallback">{item.n}</span>
    </>
  )
}

export default function StaffProducts() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [search, setSearch] = useState('')
  const [editProduct, setEditProduct] = useState(null)
  const [newStock, setNewStock] = useState('')

  const filtered = products.filter(product =>
    `${product.n} ${product.c}`.toLowerCase().includes(search.toLowerCase())
  )

  const stats = useMemo(() => ({
    total: products.length,
    low: products.filter(product => product.s === 'low').length,
    out: products.filter(product => product.s === 'out').length,
  }), [products])

  function saveStock() {
    const stock = Math.max(0, Number(newStock || 0))
    setProducts(prev => prev.map(product =>
      product.id === editProduct.id ? { ...product, stock, s: deriveStatus(stock) } : product
    ))
    setEditProduct(null)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Sản phẩm</div>
          <div className="topbar-sub">Theo dõi tồn kho và cập nhật số lượng sẵn bán</div>
        </div>
      </div>

      <div className="content ops-page">
        <div className="ops-stat-grid">
          <div className="ops-stat"><span>Sản phẩm phụ trách</span><strong>{stats.total}</strong></div>
          <div className="ops-stat amber"><span>Cần nhập thêm</span><strong>{stats.low}</strong></div>
          <div className="ops-stat red"><span>Hết hàng</span><strong>{stats.out}</strong></div>
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm sản phẩm..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <span className="filter-count">{filtered.length} sản phẩm</span>
        </div>

        <div className="product-grid ops-product-grid">
          {filtered.map(product => (
            <div key={product.id} className="product-card ops-product-card">
              <div className="product-img">
                <ProductPhoto item={product} />
                <span className={`stock-chip ${STATUS_BADGE[product.s]}`}>{STATUS_LABEL[product.s]}</span>
              </div>
              <div className="product-body">
                <div className="product-name">{product.n}</div>
                <div className="product-cat">{product.c} · SKU #{product.id}</div>
                <div className="ops-stock-row">
                  <span>Tồn kho</span>
                  <strong>{product.stock}</strong>
                </div>
                <div className="product-price">{formatMoney(product.price)}</div>
                <button
                  className="btn btn-outline btn-sm stock-update-btn"
                  onClick={() => {
                    setEditProduct(product)
                    setNewStock(String(product.stock))
                  }}
                >
                  Cập nhật tồn kho
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editProduct ? (
        <div className="modal-overlay open" onClick={event => event.target === event.currentTarget && setEditProduct(null)}>
          <div className="modal stock-modal">
            <div className="modal-header">
              <div className="modal-title">Cập nhật tồn kho</div>
              <button className="modal-close" onClick={() => setEditProduct(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="stock-modal-product">
                <img src={editProduct.img} alt={editProduct.n} />
                <div>
                  <strong>{editProduct.n}</strong>
                  <span>{formatMoney(editProduct.price)}</span>
                </div>
              </div>
              <div className="stock-edit-grid">
                <div className="stock-current">
                  <span>Hiện tại</span>
                  <strong>{editProduct.stock}</strong>
                </div>
                <div className="field">
                  <label>Số lượng mới</label>
                  <input type="number" min="0" value={newStock} onChange={event => setNewStock(event.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStock}>Lưu tồn kho</button>
                <button className="btn btn-outline" onClick={() => setEditProduct(null)}>Hủy</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
