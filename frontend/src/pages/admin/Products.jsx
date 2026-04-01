import React, { useState } from 'react'

const PRODS = [
  { id:1,  n:'Laptop ASUS VivoBook 15',  c:'Điện tử',   p:'15,490,000đ', s:'ok',  e:'💻', d:'Core i5, 8GB RAM, 512GB SSD' },
  { id:2,  n:'Chuột Logitech MX3',       c:'Điện tử',   p:'1,890,000đ',  s:'ok',  e:'🖱️', d:'Bluetooth, USB-C' },
  { id:3,  n:'Bàn phím Keychron K2',     c:'Điện tử',   p:'2,450,000đ',  s:'low', e:'⌨️', d:'Switch Brown, layout 75%' },
  { id:4,  n:'Tai nghe Sony WH-1000XM5', c:'Điện tử',   p:'7,990,000đ',  s:'ok',  e:'🎧', d:'ANC, 30h pin' },
  { id:5,  n:'Cà phê Arabica Đà Lạt',   c:'Thực phẩm', p:'180,000đ',    s:'ok',  e:'☕', d:'500g, rang mộc' },
  { id:6,  n:'Trà Oolong Lâm Đồng',     c:'Thực phẩm', p:'95,000đ',     s:'ok',  e:'🍵', d:'100g, thượng hạng' },
  { id:7,  n:'Áo polo nam Uniqlo',       c:'Thời trang',p:'490,000đ',    s:'low', e:'👕', d:'Cotton 100%' },
  { id:8,  n:'Giày Nike Air Max',        c:'Thời trang',p:'2,200,000đ',  s:'out', e:'👟', d:'Air Max 270' },
  { id:9,  n:'Bút bi Thiên Long',        c:'Văn phòng', p:'8,000đ',      s:'ok',  e:'🖊️', d:'Hộp 20 cây' },
  { id:10, n:'Sổ tay A5 dotted',         c:'Văn phòng', p:'65,000đ',     s:'ok',  e:'📓', d:'160 trang' },
  { id:11, n:'Màn hình LG 27"',          c:'Điện tử',   p:'6,800,000đ',  s:'low', e:'🖥️', d:'IPS, 144Hz' },
  { id:12, n:'Webcam Logitech C920',     c:'Điện tử',   p:'2,100,000đ',  s:'ok',  e:'📷', d:'Full HD 1080p' },
]

const SL = { ok:'Còn hàng', low:'Sắp hết', out:'Hết hàng' }
const SC = { ok:'badge-green', low:'badge-amber', out:'badge-red' }

export default function AdminProducts() {
  const [products, setProducts] = useState(PRODS)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [stock, setStock] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ n:'', d:'', c:'Điện tử', p:'', s:'ok', e:'📦' })

  const filtered = products.filter(p =>
    (!search || p.n.toLowerCase().includes(search.toLowerCase())) &&
    (!cat   || p.c === cat) &&
    (!stock || p.s === stock)
  )

  function openAdd() {
    setEditId(null)
    setForm({ n:'', d:'', c:'Điện tử', p:'', s:'ok', e:'📦' })
    setShowModal(true)
  }

  function openEdit(p) {
    setEditId(p.id)
    setForm({ n:p.n, d:p.d, c:p.c, p:p.p, s:p.s, e:p.e })
    setShowModal(true)
  }

  function saveProd() {
    if (!form.n) return
    if (!editId) {
      setProducts([...products, { id: Date.now(), ...form }])
    } else {
      setProducts(products.map(p => p.id === editId ? { ...p, ...form } : p))
    }
    setShowModal(false)
  }

  function delProd(id) {
    if (window.confirm('Xoá sản phẩm này?')) setProducts(products.filter(p => p.id !== id))
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý sản phẩm</div>
          <div className="topbar-sub">Admin — toàn quyền CRUD</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm">📥 Import CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Thêm sản phẩm</button>
        </div>
      </div>

      <div className="content">
        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm tên sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Tất cả danh mục</option>
            <option>Điện tử</option><option>Thực phẩm</option><option>Thời trang</option><option>Văn phòng</option>
          </select>
          <select value={stock} onChange={e => setStock(e.target.value)}>
            <option value="">Tất cả tồn kho</option>
            <option value="ok">Còn hàng</option><option value="low">Sắp hết</option><option value="out">Hết hàng</option>
          </select>
          <span className="filter-count">{filtered.length} sản phẩm</span>
        </div>

        <div className="product-grid">
          {filtered.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-img">
                {p.e}
                <span className={`stock-chip ${SC[p.s]}`}>{SL[p.s]}</span>
              </div>
              <div className="product-body">
                <div className="product-name">{p.n}</div>
                <div className="product-cat">{p.c} · {p.d}</div>
                <div className="product-footer">
                  <div className="product-price">{p.p}</div>
                  <div className="action-cell">
                    <div className="icon-btn" onClick={() => openEdit(p)} title="Sửa">✏️</div>
                    <div className="icon-btn" onClick={() => delProd(p.id)} title="Xoá">🗑️</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Tên sản phẩm</label>
                <input placeholder="VD: Laptop ASUS..." value={form.n} onChange={e => setForm({...form, n:e.target.value})} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Danh mục</label>
                  <select value={form.c} onChange={e => setForm({...form, c:e.target.value})}>
                    <option>Điện tử</option><option>Thực phẩm</option><option>Thời trang</option><option>Văn phòng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Giá (VNĐ)</label>
                  <input placeholder="0" value={form.p} onChange={e => setForm({...form, p:e.target.value})} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Tình trạng</label>
                  <select value={form.s} onChange={e => setForm({...form, s:e.target.value})}>
                    <option value="ok">Còn hàng</option><option value="low">Sắp hết</option><option value="out">Hết hàng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Emoji icon</label>
                  <input placeholder="📦" value={form.e} onChange={e => setForm({...form, e:e.target.value})} />
                </div>
              </div>
              <div className="field">
                <label>Mô tả</label>
                <textarea placeholder="Mô tả ngắn..." value={form.d} onChange={e => setForm({...form, d:e.target.value})} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" style={{flex:1}} onClick={saveProd}>💾 Lưu</button>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Huỷ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
