import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDisplayEmail, getDisplayName } from '../../auth/userDisplay'
import { useAuth } from '../../hooks/useAuth'
import { getCustomerIdentity, getCustomerStorageKey } from '../../utils/customerStorage'

const CART_KEY_PREFIX = 'customer_cart'
const ORDERS_KEY_PREFIX = 'customer_orders'
const PROFILE_KEY_PREFIX = 'customer_profile'

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

function CartItemImage({ item }) {
  return item.img ? (
    <>
      <img
        className="cart-line-photo"
        src={item.img}
        alt={item.n}
        loading="lazy"
        onError={event => {
          event.currentTarget.style.display = 'none'
          event.currentTarget.nextElementSibling?.classList.add('show')
        }}
      />
      <span className="product-image-fallback">{item.e}</span>
    </>
  ) : (
    <span className="product-image-fallback show">{item.e}</span>
  )
}

export default function Cart() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const customerId = useMemo(() => getCustomerIdentity(user), [user])
  const cartKey = useMemo(() => getCustomerStorageKey(CART_KEY_PREFIX, user), [user])
  const ordersKey = useMemo(() => getCustomerStorageKey(ORDERS_KEY_PREFIX, user), [user])
  const profileKey = useMemo(() => getCustomerStorageKey(PROFILE_KEY_PREFIX, user), [user])
  const [cart, setCart] = useState([])
  const [checkoutInfo, setCheckoutInfo] = useState({
    address: '',
    pay: 'Thanh toán khi nhận hàng',
  })

  useEffect(() => {
    if (!cartKey) return
    setCart(loadJson(cartKey, []))
  }, [cartKey])

  useEffect(() => {
    if (!profileKey) return
    const profile = loadJson(profileKey, {})
    setCheckoutInfo(info => ({
      ...info,
      address: info.address || profile.address || '',
    }))
  }, [profileKey])

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

  function updateQty(productId, delta) {
    const nextCart = cart
      .map(item => item.id === productId ? { ...item, qty: item.qty + delta } : item)
      .filter(item => item.qty > 0)
    persistCart(nextCart)
  }

  function removeItem(productId) {
    persistCart(cart.filter(item => item.id !== productId))
  }

  function checkout() {
    if (cart.length === 0) return

    if (!ordersKey || !customerId) return

    const existingOrders = loadJson(ordersKey, [])
    const order = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      items: cart,
      amount: cartTotal,
      status: 'new',
      pay: checkoutInfo.pay,
      address: checkoutInfo.address.trim() || 'Chưa cập nhật',
      customer: {
        id: customerId,
        name: getDisplayName(user),
        email: getDisplayEmail(user),
        role: 'customer',
      },
      tracking: [
        { label: 'Đã đặt hàng', time: 'Vừa xong', done: true },
        { label: 'Đang xác nhận', time: 'Chờ nhân viên xử lý', done: false },
        { label: 'Đóng gói', time: 'Chưa bắt đầu', done: false },
        { label: 'Giao hàng', time: 'Chưa bắt đầu', done: false },
      ],
    }

    localStorage.setItem(ordersKey, JSON.stringify([order, ...existingOrders]))
    persistCart([])
    navigate('/customer/myorders')
  }

  return (
    <div className="page-content">
      <div className="orders-head">
        <div>
          <div className="customer-page-title">Giỏ hàng</div>
          <div className="customer-page-sub">{cartCount} sản phẩm đang chờ thanh toán</div>
        </div>
      </div>

      <div className="cart-checkout-card cart-page-card">
        {cart.length === 0 ? (
          <div className="checkout-empty">Giỏ hàng đang trống. Hãy quay lại trang Sản phẩm để thêm món bạn muốn mua.</div>
        ) : (
          <div className="cart-checkout-layout">
            <div className="cart-lines-large">
              {cart.map(item => (
                <div className="cart-line cart-line-large" key={item.id}>
                  <div className="cart-line-icon">
                    <CartItemImage item={item} />
                  </div>
                  <div className="cart-line-main">
                    <div className="cart-line-name">{item.n}</div>
                    <div className="cart-line-meta">{formatMoney(item.p)}</div>
                    <div className="cart-qty">
                      <button onClick={() => updateQty(item.id, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)}>+</button>
                      <button className="cart-remove" onClick={() => removeItem(item.id)}>Xóa</button>
                    </div>
                  </div>
                  <strong>{formatMoney(item.p * item.qty)}</strong>
                </div>
              ))}
            </div>

            <aside className="cart-checkout-summary">
              <div className="checkout-title">Thanh toán</div>
              <div className="checkout-sub">Kiểm tra thông tin trước khi tạo đơn</div>

              <div className="field checkout-field">
                <label>Địa chỉ giao hàng</label>
                <input
                  placeholder="Nhập địa chỉ nhận hàng"
                  value={checkoutInfo.address}
                  onChange={event => setCheckoutInfo(info => ({ ...info, address: event.target.value }))}
                />
              </div>

              <div className="field checkout-field">
                <label>Thanh toán</label>
                <select
                  value={checkoutInfo.pay}
                  onChange={event => setCheckoutInfo(info => ({ ...info, pay: event.target.value }))}
                >
                  <option>Thanh toán khi nhận hàng</option>
                  <option>VietQR</option>
                  <option>Chuyển khoản</option>
                  <option>Ví điện tử</option>
                </select>
              </div>

              <div className="checkout-total">
                <span>Tổng cộng</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
              <button className="btn btn-primary checkout-button" onClick={checkout}>
                Thanh toán
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
