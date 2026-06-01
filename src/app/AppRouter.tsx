import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { StoreLayout } from './layouts/StoreLayout'
import { CartPage } from '../pages/store/CartPage'
import { CheckoutPage } from '../pages/store/CheckoutPage'
import { ProductDetailPage } from '../pages/store/ProductDetailPage'
import { StoreHomePage } from '../pages/store/StoreHomePage'
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage'
import { AdminApiDocsPage } from '../pages/admin/AdminApiDocsPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage'
import { AdminProductsPage } from '../pages/admin/AdminProductsPage'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<StoreHomePage />} />
          <Route path="product/:productId" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
        </Route>
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="api-docs" element={<AdminApiDocsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
