import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './auth/AuthProvider'
import PrivateRoute from './auth/PrivateRoute'
import CallbackPage from './pages/CallbackPage'
import { useAuth } from './hooks/useAuth'

import Login from './pages/auth/Login'
import Unauthorized from './pages/Unauthorized'

// Layouts 
import AdminLayout from './layouts/AdminLayout'
import StaffLayout from './layouts/StaffLayout'
import CustomerLayout from './layouts/CustomerLayout' 

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/UserManagement'
import AdminProducts from './pages/admin/Products'
import AdminOrders from './pages/admin/Orders'
import SystemSettings from './pages/admin/SystemSettings'
import AttackSimulation from './pages/admin/AttackSimulation'

// Staff pages
import StaffDashboard from './pages/staff/Dashboard'
import StaffProducts from './pages/staff/Products'
import StaffOrders from './pages/staff/Orders'

// Customer pages
import ProductCatalog from './pages/customer/ProductCatalog'
import Cart from './pages/customer/Cart'
import MyOrders from './pages/customer/MyOrders'
import Profile from './pages/customer/Profile'

function HomeRedirect() {
  const { authReady, isAuthenticated, user } = useAuth()

  if (!authReady) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.roles?.includes('admin')) return <Navigate to="/admin/dashboard" replace />
  if (user?.roles?.includes('staff')) return <Navigate to="/staff/dashboard" replace />
  return <Navigate to="/customer/productcatalog" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* PUBLIC */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ADMIN + LAYOUT */}
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={['admin']}>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="attacks" element={<AttackSimulation />} />
          </Route>

          {/* STAFF + LAYOUT */}
          <Route
            path="/staff"
            element={
              <PrivateRoute roles={['staff']}>
                <StaffLayout />
              </PrivateRoute>
            }
          >
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="products" element={<StaffProducts />} />
            <Route path="orders" element={<StaffOrders />} />
          </Route>

          {/* CUSTOMER + LAYOUT */}
          <Route
            path="/customer"
            element={
              <PrivateRoute roles={['customer']}>
                <CustomerLayout />
              </PrivateRoute>
            }
          >
            <Route path="productcatalog" element={<ProductCatalog />} />
            <Route path="cart" element={<Cart />} />
            <Route path="myorders" element={<MyOrders />} />
            <Route path="profile" element={<Profile />} />
          </Route>

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
