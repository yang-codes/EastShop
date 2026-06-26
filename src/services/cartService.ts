const cartStorageKey = 'eastshop.cart'

export type CartLine = {
  productId: string
  quantity: number
  variantId?: string
}

function normalizeCart(cart: CartLine[]) {
  return cart.filter((line) => line.productId && Number.isFinite(line.quantity) && line.quantity > 0)
}

function getLineKey(line: Pick<CartLine, 'productId' | 'variantId'>) {
  return `${line.productId}::${line.variantId ?? ''}`
}

function getStoredCart() {
  try {
    return window.localStorage.getItem(cartStorageKey)
  } catch {
    return null
  }
}

function setStoredCart(cart: CartLine[]) {
  try {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(normalizeCart(cart)))
  } catch {
    // Cart persistence can be unavailable in some embedded browsers; keep the UI usable for the current action.
  }
}

function removeStoredCart() {
  try {
    window.localStorage.removeItem(cartStorageKey)
  } catch {
    // Ignore storage failures in embedded browsers.
  }
}

export const cartService = {
  addItem(productId: string, quantity = 1, variantId?: string) {
    const cart = this.getCart()
    const lineKey = getLineKey({ productId, variantId })
    const existingLine = cart.find((line) => getLineKey(line) === lineKey)

    if (existingLine) {
      existingLine.quantity += quantity
    } else {
      cart.push({ productId, quantity, variantId })
    }

    this.saveCart(cart)
    return cart
  },

  clearCart() {
    removeStoredCart()
  },

  getCart(): CartLine[] {
    const rawCart = getStoredCart()

    if (!rawCart) {
      return []
    }

    try {
      return normalizeCart(JSON.parse(rawCart) as CartLine[])
    } catch {
      return []
    }
  },

  removeItem(productId: string, variantId?: string) {
    const lineKey = getLineKey({ productId, variantId })
    const cart = this.getCart().filter((line) => getLineKey(line) !== lineKey)
    this.saveCart(cart)
    return cart
  },

  saveCart(cart: CartLine[]) {
    setStoredCart(cart)
    window.dispatchEvent(new Event('cart-updated'))
  },

  updateQuantity(productId: string, quantity: number, variantId?: string) {
    if (quantity <= 0) {
      return this.removeItem(productId, variantId)
    }

    const cart = this.getCart()
    const lineKey = getLineKey({ productId, variantId })
    const existingLine = cart.find((line) => getLineKey(line) === lineKey)

    if (existingLine) {
      existingLine.quantity = quantity
    } else {
      cart.push({ productId, quantity, variantId })
    }

    this.saveCart(cart)
    return cart
  },
}
