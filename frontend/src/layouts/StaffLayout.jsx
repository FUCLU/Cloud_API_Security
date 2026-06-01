import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getDisplayName, getInitials, getPrimaryRole } from '../auth/userDisplay'

export default function StaffLayout() {
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
          <NavLink to="/staff/dashboard" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◈</span>Dashboard
          </NavLink>
          <div className="sb-section">Kinh doanh</div>
          <NavLink to="/staff/products" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">▣</span>Sản phẩm
          </NavLink>
          <NavLink to="/staff/orders" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◎</span>Đơn hàng<span className="sb-badge">3</span>
          </NavLink>
        </div>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: '#2a6049' }}>{getInitials(user)}</div>
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
