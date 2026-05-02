import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function CustomerLayout() {
  const { logout } = useAuth()

  return (
    <div className="main-full">
      <nav className="navbar">
        <div className="nav-brand">
          <img className="brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
        </div>
        <div className="nav-links">
          <NavLink to="/customer/productcatalog" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            San pham
          </NavLink>
          <NavLink to="/customer/myorders" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Don cua toi
          </NavLink>
          <NavLink to="/customer/profile" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Tai khoan
          </NavLink>
        </div>
        <div className="nav-right">
          <div className="tb-icon" onClick={logout} style={{ cursor:'pointer' }} title="Dang xuat">↩</div>
        </div>
      </nav>
      <Outlet />
    </div>
  )
}
