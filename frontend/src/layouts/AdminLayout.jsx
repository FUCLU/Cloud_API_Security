import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <>
      <nav className="sidebar">
        <div className="sb-logo">
          <img className = "brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
          <div>
            <div className="sb-logo-name">E-MARKET</div>
            <div className="sb-logo-sub">Admin</div>
          </div>
        </div>
        <div className="sb-nav">
          <div className="sb-section">Tổng quan</div>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
          >
            <span className="sb-icon">◈</span>Dashboard
          </NavLink>

          <div className="sb-section">Kinh doanh</div>
          <NavLink
            to="/admin/products"
            className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
          >
            <span className="sb-icon">▣</span>Sản phẩm
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
          >
            <span className="sb-icon">◎</span>Đơn hàng
            <span className="sb-badge">3</span>
          </NavLink>

          <div className="sb-section">Hệ thống</div>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
          >
            <span className="sb-icon">◉</span>Người dùng
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
          >
            <span className="sb-icon">⊙</span>Cài đặt hệ thống
          </NavLink>
        </div>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: '#c84b2f' }}>LP</div>
            <div>
              <div className="sb-uname">Lưu Hồng Phúc</div>
              <div className="sb-urole">Administrator</div>
            </div>
            <button className="sb-logout" onClick={() => navigate('/login')}>↩</button>
          </div>
        </div>
      </nav>

      <div className="main">
        <Outlet />
      </div>
    </>
  )
}
