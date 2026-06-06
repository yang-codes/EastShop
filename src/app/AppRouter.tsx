import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { StoreLayout } from './layouts/StoreLayout'
import { CartPage } from '../pages/store/CartPage'
import { CheckoutPage } from '../pages/store/CheckoutPage'
import { MyOrdersPage } from '../pages/store/MyOrdersPage'
import { ProductDetailPage } from '../pages/store/ProductDetailPage'
import { StoreHomePage } from '../pages/store/StoreHomePage'
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AdminNotificationsPage } from '../pages/admin/AdminNotificationsPage'
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage'
import { AdminProductsPage } from '../pages/admin/AdminProductsPage'
import { AdminStoreSettingsPage } from '../pages/admin/AdminStoreSettingsPage'

const AdminApiDocsPage = lazy(() =>
  import('../pages/admin/AdminApiDocsPage').then((module) => ({ default: module.AdminApiDocsPage })),
)

function DocumentTitle() {
  const location = useLocation()

  useEffect(() => {
    document.title = location.pathname.startsWith('/admin') ? '管理后台 - EastShop' : 'EastShop'
  }, [location.pathname])

  return null
}

export function AppRouter() {
  return (
    <HashRouter>
      <DocumentTitle />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<StoreHomePage />} />
          <Route path="product/:productId" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<MyOrdersPage />} />
        </Route>
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="store-settings" element={<AdminStoreSettingsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route
            path="api-docs"
            element={
              <Suspense fallback={<div className="form-card"><p>Loading...</p></div>}>
                <AdminApiDocsPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
