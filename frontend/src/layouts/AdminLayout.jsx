import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AdminLayout() {
  const { logout } = useAuth()

  return (
    <>
      <nav className="sidebar">
        <div className="sb-logo">
          <img className="brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
          <div>
            <div className="sb-logo-name">E-MARKET</div>
            <div className="sb-logo-sub">Admin</div>
          </div>
        </div>
        <div className="sb-nav">
          <div className="sb-section">Tong quan</div>
          <NavLink to="/admin/dashboard" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◈</span>Dashboard
          </NavLink>

          <div className="sb-section">Kinh doanh</div>
          <NavLink to="/admin/products" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">▣</span>San pham
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◎</span>Don hang
          </NavLink>

          <div className="sb-section">He thong</div>
          <NavLink to="/admin/users" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">◉</span>Nguoi dung
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">⊙</span>Cai dat he thong
          </NavLink>

          <div className="sb-section">Bao mat</div>
          <NavLink to="/admin/attacks" className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}>
            <span className="sb-icon">⚡</span>Attack Simulation
            <span className="sb-badge" style={{ background:'#c84b2f' }}>Lab</span>
          </NavLink>
        </div>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar" style={{ background: '#c84b2f' }}>AD</div>
            <div>
              <div className="sb-uname">Administrator</div>
              <div className="sb-urole">Admin</div>
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
