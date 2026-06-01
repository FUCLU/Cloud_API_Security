import React, { useState } from 'react'

const SPRODS = [
  { id:1, n:'Laptop ASUS VivoBook 15', c:'Điện tử',   p:'15,490,000đ', s:'ok',  e:'💻', stock:24 },
  { id:2, n:'Chuột Logitech MX3',      c:'Điện tử',   p:'1,890,000đ',  s:'ok',  e:'🖱️', stock:18 },
  { id:3, n:'Bàn phím Keychron K2',    c:'Điện tử',   p:'2,450,000đ',  s:'low', e:'⌨️', stock:4  },
  { id:4, n:'Tai nghe Sony XM5',       c:'Điện tử',   p:'7,990,000đ',  s:'ok',  e:'🎧', stock:11 },
  { id:5, n:'Cà phê Arabica Đà Lạt',  c:'Thực phẩm', p:'180,000đ',    s:'ok',  e:'☕', stock:80 },
  { id:6, n:'Áo polo nam Uniqlo',      c:'Thời trang',p:'490,000đ',    s:'low', e:'👕', stock:6  },
  { id:7, n:'Giày Nike Air Max',       c:'Thời trang',p:'2,200,000đ',  s:'out', e:'👟', stock:0  },
  { id:8, n:'Màn hình LG 27"',         c:'Điện tử',   p:'6,800,000đ',  s:'low', e:'🖥️', stock:3  },
]

const SL = { ok:'Còn hàng', low:'Sắp hết', out:'Hết hàng' }
const SC = { ok:'badge-green', low:'badge-amber', out:'badge-red' }

export default function StaffProducts() {
  const [search, setSearch] = useState('')
  const [editProd, setEditProd] = useState(null)
  const [newStock, setNewStock] = useState('')

  const filtered = SPRODS.filter(p =>
    (!search || p.n.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Sản phẩm</div>
        </div>
      </div>

      <div className="content">
        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
                <div className="product-cat">{p.c} · Tồn: <strong>{p.stock}</strong></div>
                <div className="product-footer">
                  <div className="product-price">{p.p}</div>
                </div>
                <button
                  className="btn btn-outline btn-xs"
                  style={{ marginTop:'10px', width:'100%' }}
                  onClick={() => { setEditProd(p); setNewStock(String(p.stock)) }}
                >
                  📦 Cập nhật tồn kho
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editProd && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setEditProd(null)}>
          <div className="modal" style={{ maxWidth:'380px' }}>
            <div className="modal-header">
              <div className="modal-title">Cập nhật tồn kho</div>
              <button className="modal-close" onClick={() => setEditProd(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontWeight:600, marginBottom:'14px', fontSize:'14px' }}>{editProd.n}</p>
              <div style={{ display:'flex', gap:'14px', marginBottom:'16px', alignItems:'center' }}>
                <div style={{ flex:1, background:'var(--cream)', borderRadius:'8px', padding:'12px', textAlign:'center' }}>
                  <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'4px' }}>Hiện tại</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'28px' }}>{editProd.stock}</div>
                </div>
                <div style={{ fontSize:'20px', color:'var(--muted)' }}>→</div>
                <div style={{ flex:1 }}>
                  <div className="field" style={{ margin:0 }}>
                    <label>Số lượng mới</label>
                    <input
                      type="number" min="0"
                      value={newStock}
                      onChange={e => setNewStock(e.target.value)}
                      style={{ fontSize:'20px', textAlign:'center' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop:'14px' }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => setEditProd(null)}>💾 Lưu tồn kho</button>
                <button className="btn btn-outline" onClick={() => setEditProd(null)}>Huỷ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
