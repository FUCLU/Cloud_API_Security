import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getCustomerStorageKey } from '../../utils/customerStorage'

const CART_KEY_PREFIX = 'customer_cart'

const CPRODS = [
  { id: 'P-1001', n: 'Laptop ASUS VivoBook 15', c: 'Điện tử', p: 15490000, e: '💻', d: 'Core i5, 8GB RAM, 512GB SSD', s: 'ok' },
  { id: 'P-1002', n: 'Chuột Logitech MX3', c: 'Điện tử', p: 1890000, e: '🖱️', d: 'Bluetooth, USB-C', s: 'ok' },
  { id: 'P-1003', n: 'Bàn phím Keychron K2', c: 'Điện tử', p: 2450000, e: '⌨️', d: 'Switch Brown, layout 75%', s: 'low' },
  { id: 'P-1004', n: 'Tai nghe Sony WH-1000XM5', c: 'Điện tử', p: 7990000, e: '🎧', d: 'ANC, 30h pin', s: 'ok' },
  { id: 'P-1005', n: 'Cà phê Arabica Đà Lạt', c: 'Thực phẩm', p: 180000, e: '☕', d: '500g, rang mộc', s: 'ok' },
  { id: 'P-1006', n: 'Trà Oolong Lâm Đồng', c: 'Thực phẩm', p: 95000, e: '🍵', d: '100g, thượng hạng', s: 'ok' },
  { id: 'P-1007', n: 'Áo polo nam Uniqlo', c: 'Thời trang', p: 490000, e: '👕', d: 'Cotton 100%', s: 'low' },
  { id: 'P-1008', n: 'Sổ tay A5 dotted', c: 'Văn phòng', p: 65000, e: '📓', d: '160 trang, bìa cứng', s: 'ok' },
]

function formatMoney(value) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export default function ProductCatalog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const cartKey = useMemo(() => getCustomerStorageKey(CART_KEY_PREFIX, user), [user])
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [cart, setCart] = useState([])

  useEffect(() => {
    if (!cartKey) return
    setCart(loadJson(cartKey, []))
  }, [cartKey])

  const filtered = CPRODS.filter(product =>
    product.s !== 'out' &&
    (!search || `${product.n} ${product.c} ${product.d}`.toLowerCase().includes(search.toLowerCase()))
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.p * item.qty, 0),
    [cart]
  )

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  )

  function persistCart(nextCart) {
    if (!cartKey) return
    setCart(nextCart)
    localStorage.setItem(cartKey, JSON.stringify(nextCart))
  }

  function addToCart(product) {
    const nextCart = cart.some(item => item.id === product.id)
      ? cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      : [...cart, { ...product, qty: 1 }]

    persistCart(nextCart)
    setNotice(`Đã thêm ${product.n} vào giỏ hàng`)
    setTimeout(() => setNotice(''), 1800)
  }

  return (
    <div style={{ flex: 1 }}>
      <div className="cat-hero">
        <h2>Khám phá sản phẩm</h2>
        <p>Chọn sản phẩm, thêm vào giỏ và hoàn tất thanh toán trong trang Giỏ hàng.</p>
      </div>

      <div className="cat-content">
        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm sản phẩm..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="filter-count">{filtered.length} sản phẩm</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/customer/cart')}>
              Giỏ hàng ({cartCount})
            </button>
          </div>
        </div>

        {notice ? <div className="cart-toast">{notice}</div> : null}

        <div className="cat-grid">
          {filtered.map(product => (
            <div key={product.id} className="pcard">
              <div className="pimg">{product.e}</div>
              <div className="pbody">
                <div className="pname">{product.n}</div>
                <div className="pdesc">{product.c} · {product.d}</div>
                {product.s === 'low' ? <div className="stock-text">Sắp hết hàng</div> : null}
                <div className="pfoot">
                  <div className="pprice">{formatMoney(product.p)}</div>
                </div>
                <button className="btn btn-primary add-cart-btn" onClick={() => addToCart(product)}>
                  Thêm vào giỏ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {cartCount > 0 ? (
        <button className="cart-count" onClick={() => navigate('/customer/cart')}>
          Giỏ hàng · {cartCount} · {formatMoney(cartTotal)}
        </button>
      ) : null}
    </div>
  )
}
