import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import PrivateRoute from './auth/PrivateRoute'
import CallbackPage from './pages/CallbackPage'

import Login from './pages/auth/Login'

// Admin
import AdminDashboard  from './pages/admin/Dashboard'
import AdminUsers      from './pages/admin/UserManagement'
import AdminProducts   from './pages/admin/Products'
import AdminOrders     from './pages/admin/Orders'
import SystemSettings  from './pages/admin/SystemSettings'

// Staff
import StaffDashboard from './pages/staff/Dashboard'
import StaffProducts  from './pages/staff/Products'
import StaffOrders    from './pages/staff/Orders'

// Customer
import ProductCatalog from './pages/customer/ProductCatalog'
import MyOrders       from './pages/customer/MyOrders'
import Profile        from './pages/customer/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/"            element={<Navigate to="/login" replace />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/callback"    element={<CallbackPage />} />  {/* ← Keycloak redirect về đây */}
          <Route path="/unauthorized" element={<div style={{padding:32}}>403 — Không có quyền truy cập</div>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/users"     element={<PrivateRoute roles={['admin']}><AdminUsers /></PrivateRoute>} />
          <Route path="/admin/products"  element={<PrivateRoute roles={['admin']}><AdminProducts /></PrivateRoute>} />
          <Route path="/admin/orders"    element={<PrivateRoute roles={['admin']}><AdminOrders /></PrivateRoute>} />
          <Route path="/admin/settings"  element={<PrivateRoute roles={['admin']}><SystemSettings /></PrivateRoute>} />

          {/* Staff */}
          <Route path="/staff/dashboard" element={<PrivateRoute roles={['staff','admin']}><StaffDashboard /></PrivateRoute>} />
          <Route path="/staff/products"  element={<PrivateRoute roles={['staff','admin']}><StaffProducts /></PrivateRoute>} />
          <Route path="/staff/orders"    element={<PrivateRoute roles={['staff','admin']}><StaffOrders /></PrivateRoute>} />

          {/* Customer */}
          <Route path="/customer/productcatalog" element={<PrivateRoute><ProductCatalog /></PrivateRoute>} />
          <Route path="/customer/orders"         element={<PrivateRoute><MyOrders /></PrivateRoute>} />
          <Route path="/customer/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}