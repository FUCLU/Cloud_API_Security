import React, { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])

  function addItem(product) {
    setCart(prev => {
      const existing = prev.find(i => i.n === product.n)
      if (existing) {
        return prev.map(i => i.n === product.n ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  function removeItem(name) {
    setCart(prev => prev.filter(i => i.n !== name))
  }

  function clearCart() {
    setCart([])
  }

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0)

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, clearCart, totalQty }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
