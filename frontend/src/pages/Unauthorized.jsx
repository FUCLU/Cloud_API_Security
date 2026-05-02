import React from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Unauthorized() {
  const { logout } = useAuth()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 48,
          maxWidth: 500,
          textAlign: 'center',
          boxShadow: '0 16px 48px rgba(0,0,0,.2)',
        }}
      >
        <p style={{ fontSize: 16, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
          Bạn không có quyền truy cập vào trang này.
        </p>

        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: 12,
            background: '#667eea',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Đăng nhập lại
        </button>
      </div>
    </div>
  )
}
