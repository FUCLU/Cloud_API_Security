import React, { useMemo, useState } from 'react'

const PRODUCT_IMAGES = {
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  mouse: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  headphone: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
  tea: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80',
  polo: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  pen: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?auto=format&fit=crop&w=900&q=80',
  notebook: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
  webcam: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=900&q=80',
}

const INITIAL_PRODUCTS = [
  { id: 1, n: 'Laptop ASUS VivoBook 15', c: 'Điện tử', price: 15490000, s: 'ok', stock: 24, img: PRODUCT_IMAGES.laptop, d: 'Core i5, 8GB RAM, 512GB SSD' },
  { id: 2, n: 'Chuột Logitech MX3', c: 'Điện tử', price: 1890000, s: 'ok', stock: 18, img: PRODUCT_IMAGES.mouse, d: 'Bluetooth, USB-C' },
  { id: 3, n: 'Bàn phím Keychron K2', c: 'Điện tử', price: 2450000, s: 'low', stock: 4, img: PRODUCT_IMAGES.keyboard, d: 'Switch Brown, layout 75%' },
  { id: 4, n: 'Tai nghe Sony WH-1000XM5', c: 'Điện tử', price: 7990000, s: 'ok', stock: 11, img: PRODUCT_IMAGES.headphone, d: 'ANC, 30h pin' },
  { id: 5, n: 'Cà phê Arabica Đà Lạt', c: 'Thực phẩm', price: 180000, s: 'ok', stock: 80, img: PRODUCT_IMAGES.coffee, d: '500g, rang mộc' },
  { id: 6, n: 'Trà Oolong Lâm Đồng', c: 'Thực phẩm', price: 95000, s: 'ok', stock: 46, img: PRODUCT_IMAGES.tea, d: '100g, thượng hạng' },
  { id: 7, n: 'Áo polo nam Uniqlo', c: 'Thời trang', price: 490000, s: 'low', stock: 6, img: PRODUCT_IMAGES.polo, d: 'Cotton 100%' },
  { id: 8, n: 'Giày Nike Air Max', c: 'Thời trang', price: 2200000, s: 'out', stock: 0, img: PRODUCT_IMAGES.shoes, d: 'Air Max 270' },
  { id: 9, n: 'Bút bi Thiên Long', c: 'Văn phòng', price: 8000, s: 'ok', stock: 220, img: PRODUCT_IMAGES.pen, d: 'Hộp 20 cây' },
  { id: 10, n: 'Sổ tay A5 dotted', c: 'Văn phòng', price: 65000, s: 'ok', stock: 64, img: PRODUCT_IMAGES.notebook, d: '160 trang, bìa cứng' },
  { id: 11, n: 'Màn hình LG 27"', c: 'Điện tử', price: 6800000, s: 'low', stock: 3, img: PRODUCT_IMAGES.monitor, d: 'IPS, 144Hz' },
  { id: 12, n: 'Webcam Logitech C920', c: 'Điện tử', price: 2100000, s: 'ok', stock: 15, img: PRODUCT_IMAGES.webcam, d: 'Full HD 1080p' },
]

const STATUS_LABEL = { ok: 'Còn hàng', low: 'Sắp hết', out: 'Hết hàng' }
const STATUS_BADGE = { ok: 'badge-green', low: 'badge-amber', out: 'badge-red' }
const EMPTY_FORM = { n: '', d: '', c: 'Điện tử', price: '', stock: 0, s: 'ok', img: '' }

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
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

export default function AdminProducts() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = products.filter(product => {
    const haystack = `${product.n} ${product.c} ${product.d}`.toLowerCase()
    return (status === 'all' || product.s === status) && haystack.includes(search.toLowerCase())
  })

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(product => product.s !== 'out').length,
    low: products.filter(product => product.s === 'low').length,
    out: products.filter(product => product.s === 'out').length,
  }), [products])

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(product) {
    setEditId(product.id)
    setForm({
      n: product.n,
      d: product.d,
      c: product.c,
      price: product.price,
      stock: product.stock,
      s: product.s,
      img: product.img,
    })
    setShowModal(true)
  }

  function saveProduct() {
    if (!form.n.trim()) return
    const nextProduct = {
      ...form,
      id: editId ?? Date.now(),
      price: Number(form.price || 0),
      stock: Number(form.stock || 0),
      img: form.img || PRODUCT_IMAGES.notebook,
    }

    setProducts(prev => editId
      ? prev.map(product => product.id === editId ? nextProduct : product)
      : [nextProduct, ...prev]
    )
    setShowModal(false)
  }

  function deleteProduct(id) {
    if (window.confirm('Xóa sản phẩm này?')) {
      setProducts(prev => prev.filter(product => product.id !== id))
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý sản phẩm</div>
          <div className="topbar-sub">Danh mục, tồn kho, hình ảnh và giá bán hiển thị trên shop</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm">Import CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Thêm sản phẩm</button>
        </div>
      </div>

      <div className="content ops-page">
        <div className="ops-stat-grid">
          <div className="ops-stat"><span>Tổng sản phẩm</span><strong>{stats.total}</strong></div>
          <div className="ops-stat"><span>Đang bán</span><strong>{stats.active}</strong></div>
          <div className="ops-stat amber"><span>Sắp hết</span><strong>{stats.low}</strong></div>
          <div className="ops-stat red"><span>Hết hàng</span><strong>{stats.out}</strong></div>
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm tên sản phẩm, danh mục..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="segmented-filter">
            {['all', 'ok', 'low', 'out'].map(key => (
              <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>
                {key === 'all' ? 'Tất cả' : STATUS_LABEL[key]}
              </button>
            ))}
          </div>
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
                <div className="product-cat">{product.c} · {product.d}</div>
                <div className="ops-product-meta">
                  <span>Tồn kho <strong>{product.stock}</strong></span>
                  <span>SKU #{product.id}</span>
                </div>
                <div className="product-footer">
                  <div className="product-price">{formatMoney(product.price)}</div>
                  <div className="action-cell">
                    <button className="icon-btn" onClick={() => openEdit(product)} title="Sửa">✎</button>
                    <button className="icon-btn" onClick={() => deleteProduct(product.id)} title="Xóa">×</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal ? (
        <div className="modal-overlay open" onClick={event => event.target === event.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Tên sản phẩm</label>
                <input value={form.n} onChange={event => setForm({ ...form, n: event.target.value })} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Danh mục</label>
                  <select value={form.c} onChange={event => setForm({ ...form, c: event.target.value })}>
                    <option>Điện tử</option>
                    <option>Thực phẩm</option>
                    <option>Thời trang</option>
                    <option>Văn phòng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Giá bán</label>
                  <input type="number" min="0" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Tồn kho</label>
                  <input type="number" min="0" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} />
                </div>
                <div className="field">
                  <label>Trạng thái</label>
                  <select value={form.s} onChange={event => setForm({ ...form, s: event.target.value })}>
                    <option value="ok">Còn hàng</option>
                    <option value="low">Sắp hết</option>
                    <option value="out">Hết hàng</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>URL hình ảnh</label>
                <input value={form.img} onChange={event => setForm({ ...form, img: event.target.value })} />
              </div>
              <div className="field">
                <label>Mô tả ngắn</label>
                <textarea value={form.d} onChange={event => setForm({ ...form, d: event.target.value })} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveProduct}>Lưu sản phẩm</button>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Hủy</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
