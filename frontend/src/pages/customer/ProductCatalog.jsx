import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const CPRODS = [
  { n:'Laptop ASUS VivoBook 15',  c:'Điện tử',   p:'15,490,000đ', e:'💻', d:'Core i5, 8GB RAM, 512GB SSD', s:'ok' },
  { n:'Chuột Logitech MX3',       c:'Điện tử',   p:'1,890,000đ',  e:'🖱️', d:'Bluetooth, USB-C',            s:'ok' },
  { n:'Bàn phím Keychron K2',     c:'Điện tử',   p:'2,450,000đ',  e:'⌨️', d:'Switch Brown, layout 75%',    s:'low' },
  { n:'Tai nghe Sony WH-1000XM5', c:'Điện tử',   p:'7,990,000đ',  e:'🎧', d:'ANC, 30h pin',                s:'ok' },
  { n:'Cà phê Arabica Đà Lạt',   c:'Thực phẩm', p:'180,000đ',    e:'☕', d:'500g, rang mộc',              s:'ok' },
  { n:'Trà Oolong Lâm Đồng',     c:'Thực phẩm', p:'95,000đ',     e:'🍵', d:'100g, thượng hạng',           s:'ok' },
  { n:'Áo polo nam Uniqlo',       c:'Thời trang',p:'490,000đ',    e:'👕', d:'Cotton 100%',                 s:'low' },
  { n:'Sổ tay A5 dotted',         c:'Văn phòng', p:'65,000đ',     e:'📓', d:'160 trang, bìa cứng',         s:'ok' },
]

export default function ProductCatalog() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')

  const filtered = CPRODS.filter(p =>
    p.s !== 'out' &&
    (!search || p.n.toLowerCase().includes(search.toLowerCase())) &&
    (!cat || p.c === cat)
  )

  return (
    <div style={{ flex: 1 }}>
      <div className="cat-hero">
        <h2>Khám phá sản phẩm</h2>
        <p>Tất cả giao dịch được bảo vệ bởi AES-256-GCM · TLS 1.3</p>
      </div>

      <div className="cat-content">
        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Tất cả danh mục</option>
            <option>Điện tử</option><option>Thực phẩm</option><option>Thời trang</option><option>Văn phòng</option>
          </select>
          <span className="filter-count">{filtered.length} sản phẩm</span>
        </div>

        <div className="cat-grid">
          {filtered.map(p => (
            <div key={p.n} className="pcard">
              <div className="pimg">{p.e}</div>
              <div className="pbody">
                <div className="pname">{p.n}</div>
                <div className="pdesc">{p.c} · {p.d}</div>
                {p.s === 'low' && <div style={{ fontSize:'11px', color:'var(--amber)', marginBottom:'4px' }}>⚠️ Sắp hết hàng</div>}
                <div className="pfoot">
                  <div className="pprice">{p.p}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}