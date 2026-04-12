import React from 'react'
import logo from '../../src/logo.png'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function CustomerLayout() {
  const navigate = useNavigate()

  return (
    <div className="main-full">
      <nav className="navbar">
        <div className="nav-brand">
          <img className="brand-icon" src={logo} alt="logo" style={{ width: '70px', height: 'auto' }} />
        </div>
        <div className="nav-links">
          <NavLink to="/customer/productcatalog" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Sản phẩm
          </NavLink>
          <NavLink to="/customer/myorders" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Đơn của tôi
          </NavLink>
          <NavLink to="/customer/profile" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Tài khoản
          </NavLink>
        </div>
        <div className="nav-right">
          <div className="tb-icon" onClick={() => navigate('/login')} style={{ cursor:'pointer' }} title="Đăng xuất">↩</div>
        </div>
      </nav>
      <Outlet />
    </div>
  )
}