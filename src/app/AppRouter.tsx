import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { StoreLayout } from './layouts/StoreLayout'
import { CartPage } from '../pages/store/CartPage'
import { CheckoutPage } from '../pages/store/CheckoutPage'
import { MyOrdersPage } from '../pages/store/MyOrdersPage'
import { ProductDetailPage } from '../pages/store/ProductDetailPage'
import { StoreHomePage } from '../pages/store/StoreHomePage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'

const AdminCategoriesPage = lazy(() =>
  import('../pages/admin/AdminCategoriesPage').then((module) => ({ default: module.AdminCategoriesPage })),
)

const AdminNotificationsPage = lazy(() =>
  import('../pages/admin/AdminNotificationsPage').then((module) => ({ default: module.AdminNotificationsPage })),
)

const AdminOrdersPage = lazy(() =>
  import('../pages/admin/AdminOrdersPage').then((module) => ({ default: module.AdminOrdersPage })),
)

const AdminProductsPage = lazy(() =>
  import('../pages/admin/AdminProductsPage').then((module) => ({ default: module.AdminProductsPage })),
)

const AdminStoreSettingsPage = lazy(() =>
  import('../pages/admin/AdminStoreSettingsPage').then((module) => ({ default: module.AdminStoreSettingsPage })),
)

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

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="form-card"><p>Loading...</p></div>}>{children}</Suspense>
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
          <Route path="products" element={<LazyPage><AdminProductsPage /></LazyPage>} />
          <Route path="orders" element={<LazyPage><AdminOrdersPage /></LazyPage>} />
          <Route path="categories" element={<LazyPage><AdminCategoriesPage /></LazyPage>} />
          <Route path="store-settings" element={<LazyPage><AdminStoreSettingsPage /></LazyPage>} />
          <Route path="notifications" element={<LazyPage><AdminNotificationsPage /></LazyPage>} />
          <Route
            path="api-docs"
            element={
              <LazyPage>
                <AdminApiDocsPage />
              </LazyPage>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
