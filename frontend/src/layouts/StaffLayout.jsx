import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function StaffLayout() {
  const { logout } = useAuth()

  return (
    <>
      <nav className="sidebar">
        <div className="sb-logo">
          <img className="brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
          <div>
            <div className="sb-logo-name">E-MARKET</div>
            <div className="sb-logo-sub">Staff</div>
          </div>
        </div>
        <div className="sb-nav">
          <div className="sb-section">Tong quan</div>
          <NavLink to="/staff/dashboard" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◈</span>Dashboard
          </NavLink>
          <div className="sb-section">Kinh doanh</div>
          <NavLink to="/staff/products" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">▣</span>San pham
          </NavLink>
          <NavLink to="/staff/orders" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◎</span>Don hang<span className="sb-badge">3</span>
          </NavLink>
        </div>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: '#2a6049' }}>SF</div>
            <div>
              <div className="sb-uname">Nhan vien</div>
              <div className="sb-urole">Staff</div>
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
