const cartStorageKey = 'eastshop.cart'

export type CartLine = {
  productId: string
  quantity: number
}

function normalizeCart(cart: CartLine[]) {
  return cart.filter((line) => line.productId && Number.isFinite(line.quantity) && line.quantity > 0)
}

export const cartService = {
  addItem(productId: string, quantity = 1) {
    const cart = this.getCart()
    const existingLine = cart.find((line) => line.productId === productId)

    if (existingLine) {
      existingLine.quantity += quantity
    } else {
      cart.push({ productId, quantity })
    }

    this.saveCart(cart)
    return cart
  },

  clearCart() {
    localStorage.removeItem(cartStorageKey)
  },

  getCart(): CartLine[] {
    const rawCart = localStorage.getItem(cartStorageKey)

    if (!rawCart) {
      return []
    }

    try {
      return normalizeCart(JSON.parse(rawCart) as CartLine[])
    } catch {
      return []
    }
  },

  removeItem(productId: string) {
    const cart = this.getCart().filter((line) => line.productId !== productId)
    this.saveCart(cart)
    return cart
  },

  saveCart(cart: CartLine[]) {
    localStorage.setItem(cartStorageKey, JSON.stringify(normalizeCart(cart)))
  },

  updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(productId)
    }

    const cart = this.getCart()
    const existingLine = cart.find((line) => line.productId === productId)

    if (existingLine) {
      existingLine.quantity = quantity
    } else {
      cart.push({ productId, quantity })
    }

    this.saveCart(cart)
    return cart
  },
}
