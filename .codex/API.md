# EastShop 接口文档

## Overview
当前项目采用前端服务层封装接口调用。未配置 Supabase 时，商品和分类读取 `public/mock` 数据；配置 Supabase 后，前端读取公开商品/分类表。订单写入、Telegram 身份验证和最终价格计算必须通过 Supabase Edge Function 完成。

机器可读接口规范位于 `.codex/openapi.yaml`。后台 `/admin/api-docs` 使用 Scalar 渲染该 OpenAPI 文件。

## Environment Variables
- `VITE_SUPABASE_URL`：Supabase 项目 URL。
- `VITE_SUPABASE_ANON_KEY`：Supabase anon key，用于公开读取和登录。
- `VITE_GEOAPIFY_API_KEY`：Geoapify Reverse Geocoding key，用于地址反查。
- `VITE_DEEPL_API_KEY`：DeepL API Free key，用于后台商品翻译辅助。

服务端 secrets：
- `TELEGRAM_BOT_TOKEN`：Telegram Bot Token，只能放在 Edge Function secrets。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase service role key，只能放在 Edge Function secrets。

## Frontend Service APIs

### `catalogService.listActiveProducts()`
文件：`src/services/catalogService.ts`

用途：读取前台可展示商品列表。

返回：`Promise<Product[]>`

行为：
- 未配置 Supabase 时读取 `public/mock/products.json`。
- 配置 Supabase 后读取 `products` 表。
- 只返回 `is_active = true` 的商品。
- 按 `sort_order` 排序。

### `catalogService.getProductById(productId)`
用途：读取单个已上架商品详情。

参数：
- `productId: string`：商品 ID。

返回：`Promise<Product | null>`

行为：
- 未配置 Supabase 时从 mock 商品中查找。
- 配置 Supabase 后读取 `products` 表。
- 只返回 `is_active = true` 的商品。

### `catalogService.listActiveCategories()`
用途：读取前台可展示分类列表。

返回：`Promise<Category[]>`

行为：
- 未配置 Supabase 时读取 `public/mock/categories.json`。
- 配置 Supabase 后读取 `categories` 表。
- 只返回 `is_active = true` 的分类。
- 按 `sort_order` 排序。

### `cartService`
文件：`src/services/cartService.ts`

本地购物车 API：
- `getCart(): CartLine[]`：读取本地购物车。
- `addItem(productId, quantity = 1)`：加入购物车。
- `updateQuantity(productId, quantity)`：更新数量；数量小于等于 0 时删除。
- `removeItem(productId)`：删除商品。
- `clearCart()`：清空购物车。
- `saveCart(cart)`：保存标准化后的购物车。

存储 key：`eastshop.cart`

### `locationService.getBrowserPosition()`
用途：请求浏览器定位。

返回：`Promise<GeolocationPosition>`

错误：
- 浏览器不支持定位时抛出 `GEOLOCATION_UNSUPPORTED`。
- 用户拒绝或超时由浏览器 Geolocation API 返回错误。

### `locationService.reverseGeocode(position, language)`
用途：把经纬度转换成地址快照。

参数：
- `position: GeolocationPosition`
- `language: 'zh' | 'en' | 'ru'`

返回：`Promise<LocationSnapshot>`

当前状态：
- 目前只返回经纬度和精度。
- 后续应调用 Geoapify Reverse Geocoding，补充 `country`、`city`、`district`、`street`、`formattedAddress`。

### `orderService.submitOrder(input)`
用途：提交前台订单。

参数：
- `cart`：购物车商品 ID 和数量。
- `contact`：客户姓名、电话、地址、备注、社交账号。
- `language`：当前下单语言。
- `location`：定位与地址反查快照。
- `source`：`telegram`、`instagram`、`web`。
- `telegramInitData`：Telegram Mini App 初始化数据。

当前状态：
- 未配置 Supabase 时返回本地预览订单号，用于开发态跑通前台闭环。
- 配置 Supabase 后调用 `submit-order` Edge Function。

目标行为：
- 服务端验证 Telegram `initData`。
- 服务端重新读取商品价格和上架状态。
- 服务端写入 `orders` 和 `order_items`。

### `authService`
文件：`src/services/authService.ts`

后台登录 API：
- `signIn(email, password)`：Supabase 邮箱密码登录。
- `signOut()`：退出登录。
- `getCurrentAdmin()`：读取当前 Auth 用户对应的启用管理员档案。

授权规则：
- 后台不开放公开注册。
- 登录后必须在 `admin_profiles` 中存在且 `is_active = true`。
- `admin_profiles.user_id` 必须等于 Supabase Auth 用户 UUID。
- `authenticated` 角色必须拥有 `admin_profiles` 的 `select` 表权限；RLS policy 再限制只能读取自己的管理员档案或由管理员读取。
- `admin_profiles` 数据库字段为 snake_case，前端映射为 `AdminProfile` camelCase。
- 未配置 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY` 时，登录页会禁用提交并提示配置缺失。
- 未登录访问 `/admin/*` 时，`AdminLayout` 会跳转到 `/admin/login` 并保留来源路径。
- 退出登录调用 `authService.signOut()`，成功后跳转 `/admin/login`。

登录流程：
1. 管理员在 `/admin/login` 输入邮箱和密码。
2. 前端调用 `authService.signIn(email, password)`。
3. 登录成功后调用 `authService.getCurrentAdmin()`。
4. 如果没有启用管理员档案，立即调用 `signOut()` 并提示未授权。
5. 如果授权成功，跳转来源后台路径或 `/admin/products`。

常见错误：
- `GET /rest/v1/admin_profiles?... 403 (Forbidden)`：通常说明 `admin_profiles` 缺少 `grant select ... to authenticated`，或 RLS/管理员授权行未配置完整。
- 页面显示通用登录失败：查看浏览器 Console 和 Supabase SQL Editor，优先执行 `.codex/sql-docs/SUPABASE_SQL_SETUP.md` 的第 4.1 节和第 13 节。

### `adminProductService`
文件：`src/services/adminProductService.ts`

后台商品 API：
- `listProducts()`：读取全部商品。
- `saveProduct(product)`：新增或更新商品，使用 `products` 表 upsert。
- `deleteProduct(productId)`：删除商品。
- `setProductActive(productId, isActive)`：更新商品上下架状态。
- `listCategories()`：读取全部分类。
- `saveCategory(category)`：新增或更新分类，使用 `categories` 表 upsert。
- `deleteCategory(categoryId)`：删除分类。

当前限制：
- 需要 Supabase 已配置。
- `categories.id` 和 `products.category_id` 使用 UUID；后台新增分类时由浏览器 `crypto.randomUUID()` 生成分类 ID。
- 商品图片目前支持手动维护 URL；文件上传、压缩和 Storage 写入仍未实现。

### `adminOrderService`
文件：`src/services/adminOrderService.ts`

后台订单 API：
- `listOrders()`：读取订单列表。未配置 Supabase 时返回开发态 mock 订单。
- `updateOrderStatus(orderId, status)`：更新订单状态。
- `exportOrders(orders, format)`：导出 CSV 或 XLSX。

导出格式：
- `csv` 返回 UTF-8 BOM CSV 字符串。
- `xlsx` 返回 `ArrayBuffer`。

### `translationService.translateFromChinese(text)`
用途：把中文商品文案翻译为三语结构。

当前状态：
- 占位实现，只返回中文原文，英文和俄文为空。

目标行为：
- 调用 DeepL API Free 或 Edge Function 代理。
- 返回 `{ zh, en, ru }`。
- 管理员必须能人工修改翻译结果。

## Edge Function API

### `POST /functions/v1/submit-order`
用途：唯一订单提交入口。

请求体：
```json
{
  "cart": [
    { "productId": "esd-floor-tile-600", "quantity": 48 }
  ],
  "contact": {
    "name": "Aruzhan",
    "phone": "+7 701 000 1020",
    "address": "Almaty, Dostyk Ave 85",
    "socialHandle": "@aruzhan_shop",
    "note": "Need delivery quote before confirmation."
  },
  "location": {
    "latitude": 43.238949,
    "longitude": 76.889709,
    "accuracy": 38,
    "country": "Kazakhstan",
    "city": "Almaty",
    "street": "Dostyk Ave",
    "formattedAddress": "Dostyk Ave 85, Almaty"
  },
  "source": "telegram",
  "language": "en",
  "telegramInitData": "query_id=..."
}
```

成功响应：
```json
{
  "orderId": "ORD-20260529-001",
  "total": 614.4,
  "status": "new"
}
```

错误响应：
```json
{
  "error": "INVALID_TELEGRAM_INIT_DATA",
  "message": "Telegram initData verification failed."
}
```

服务端规则：
- `source = telegram` 时必须验证 `telegramInitData`。
- `source = instagram` 或 `web` 不做平台身份强验证。
- 必须重新读取 `products` 表，确认商品仍上架。
- 必须重新计算价格和总价。
- 必须写入 `orders` 和 `order_items`。
- 前端传入的价格和总价一律不可信。

## Data Types

### `Product`
- `id`
- `name`
- `description`
- `detail`
- `categoryId`
- `price`
- `coverImage`
- `images`
- `specs`
- `tags`
- `sortOrder`
- `isFeatured`
- `isActive`

### `Category`
- `id`
- `name`
- `sortOrder`
- `isActive`

### `Order`
- `id`
- `source`
- `status`
- `contact`
- `location`
- `items`
- `total`
- `createdAt`

### `OrderStatus`
- `new`
- `contacted`
- `fulfilled`
- `cancelled`
