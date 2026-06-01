import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getDisplayName, getInitials, getPrimaryRole } from '../auth/userDisplay'

export default function AdminLayout() {
  const { logout, user } = useAuth()

  return (
    <>
      <nav className="sidebar">
        <div className="sb-logo">
          <img className="brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
          <div>
            <div className="sb-logo-name">E-MARKET</div>
          </div>
        </div>
        <div className="sb-nav">
          <div className="sb-section">Tổng quan</div>
          <NavLink to="/admin/dashboard" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◈</span>Dashboard
          </NavLink>

          <div className="sb-section">Kinh doanh</div>
          <NavLink to="/admin/products" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">▣</span>Sản phẩm
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◎</span>Đơn hàng
          </NavLink>

          <div className="sb-section">Hệ thống</div>
          <NavLink to="/admin/users" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◉</span>Người dùng
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">⊙</span>Cài đặt hệ thống
          </NavLink>

          <div className="sb-section">Bảo mật</div>
          <NavLink to="/admin/attacks" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">⚡</span>Attack Simulation
            <span className="sb-badge" style={{ background:'#c84b2f' }}>Test</span>
          </NavLink>
        </div>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: '#c84b2f' }}>{getInitials(user)}</div>
            <div className="sb-user-meta">
              <div className="sb-uname">{getDisplayName(user)}</div>
              <div className="sb-urole">{getPrimaryRole(user)}</div>
            </div>
            <button className="sb-logout" onClick={logout}>↩</button>
          </div>
        </div>
      </nav>

      <div className="main">
        <Outlet />
      </div>
    </>
  )
}
