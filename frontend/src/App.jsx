import React from 'react'
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import Login from './pages/auth/Login'

import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminOrders from './pages/admin/Orders'
import AdminProducts from './pages/admin/Products'
import SystemSettings from './pages/admin/SystemSettings'
import UserManagement from './pages/admin/UserManagement'

import CustomerLayout from './layouts/CustomerLayout'
import MyOrders from './pages/customer/MyOrders'
import ProductCatalog from './pages/customer/ProductCatalog'
import Profile from './pages/customer/Profile'

import StaffLayout from './layouts/StaffLayout'
import StaffDashboard from './pages/staff/Dashboard'
import StaffOrders from './pages/staff/Orders'
import StaffProducts from './pages/staff/Products'


export default function App(){
    return (
        <CartProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Navigate to="/login"/>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin" element={<AdminLayout />}>
                        <Route path="dashboard" element={<AdminDashboard />}/>
                        <Route path="orders" element={<AdminOrders />}/>
                        <Route path="products" element={<AdminProducts />}/>
                        <Route path="settings" element={<SystemSettings />}/>
                        <Route path="users" element={<UserManagement />}/>
                    </Route>
                    <Route path="/staff" element={<StaffLayout />}>
                        <Route path="dashboard" element={<StaffDashboard />}/>
                        <Route path="orders" element={<StaffOrders />}/>
                        <Route path="products" element={<StaffProducts />}/>
                    </Route>
                    <Route path="/customer" element={<CustomerLayout />}>
                        <Route path="myorders" element={<MyOrders />}/>
                        <Route path="profile" element={<Profile />}/>
                        <Route path="productcatalog" element={<ProductCatalog />}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </CartProvider>
    )
}



