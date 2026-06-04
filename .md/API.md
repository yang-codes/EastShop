# EastShop 接口文档

## Overview
当前项目采用前端服务层封装接口调用。未配置 Supabase 时，商品和分类读取 `public/mock` 数据；配置 Supabase 后，前端读取公开商品/分类表。订单写入、Telegram 身份验证和最终价格计算必须通过 Supabase Edge Function 完成。

机器可读接口规范位于 `.md/openapi.yaml`。后台 `/admin/api-docs` 使用 Scalar 渲染该 OpenAPI 文件。

## Environment Variables
- `VITE_SUPABASE_URL`：Supabase 项目 URL。
- `VITE_SUPABASE_ANON_KEY`：Supabase anon key，用于公开读取和登录。
- `VITE_GEOAPIFY_API_KEY`：Geoapify Reverse Geocoding key，用于地址反查。

服务端 secrets：
- `TELEGRAM_BOT_TOKEN`：Telegram Bot Token，只能放在 Edge Function secrets。
- `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS`：可选，Telegram Mini App `initData` 最大有效秒数；默认 `86400`，设置为 `0` 可关闭过期时间检查。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase service role key，只能放在 Edge Function secrets。
- `TENCENTCLOUD_SECRET_ID`：腾讯云 SecretId，只能放在 Edge Function secrets。
- `TENCENTCLOUD_SECRET_KEY`：腾讯云 SecretKey，只能放在 Edge Function secrets。
- `TENCENT_TRANSLATE_REGION`：可选，腾讯云机器翻译地域；默认 `ap-guangzhou`。

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
- `addItem(productId, quantity = 1, variantId?)`：加入购物车；传入规格 ID 时按商品 + 规格拆分购物车行。
- `updateQuantity(productId, quantity, variantId?)`：更新数量；数量小于等于 0 时删除。
- `removeItem(productId, variantId?)`：删除商品或指定规格行。
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
- 已接入 Geoapify Reverse Geocoding；配置 `VITE_GEOAPIFY_API_KEY` 后补充 `country`、`city`、`district`、`street`、`formattedAddress`。
- 未配置 Geoapify key 或接口失败时降级返回经纬度和精度。

### `orderService.submitOrder(input)`
用途：提交前台订单。

参数：
- `cart`：购物车商品 ID 和数量。
- `contact`：客户姓名、完整国际手机号、地址、备注、社交账号。
- `language`：当前下单语言。
- `location`：定位与地址反查快照。
- `source`：`telegram`、`instagram`、`web`。
- `telegramInitData`：Telegram Mini App 初始化数据。

当前状态：
- 未配置 Supabase 时返回本地预览订单号，用于开发态跑通前台闭环。
- 配置 Supabase 后调用 `submit-order` Edge Function。
- 服务端验证 Telegram `initData`。
- 服务端重新读取商品价格和上架状态。
- 服务端写入 `orders` 和 `order_items`。

### `orderService.lookupOrders(input)`
用途：前台“我的订单”查询。

参数：
- `phone`：必填，完整国际手机号。
- `orderId`：可选，订单号；与手机号组合查询。
- `socialHandle`：可选，社交账号；与手机号组合查询。

规则：
- 手机号必须填写。
- `orderId` 和 `socialHandle` 至少填写一个。
- 后台修改 `orders.status` 后，前台再次查询会读取最新状态。

返回：
- 订单状态：新订单、已联系、已完成、已取消。
- 商品、规格、数量、金额、地址和下单时间。

### `orderService.cancelOrder(input)`
用途：前台“我的订单”中取消用户自己的新订单。

参数：
- `orderId`：必填，订单号。
- `phone`：必填，完整国际手机号。

规则：
- 只有订单状态为 `new` 时前台展示取消按钮。
- 服务端再次校验手机号、订单号和订单状态；非新订单不能取消。
- 取消成功后状态更新为 `cancelled`，并触发飞书取消通知；飞书发送失败不影响取消成功。

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
- 页面显示通用登录失败：查看浏览器 Console 和 Supabase SQL Editor，优先执行 `.md/sql-docs/SUPABASE_SQL_SETUP.md` 的第 4.1 节和第 13 节。

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
- 商品价格只来自 `variants` 销售规格，保存三语规格名、价格、SKU、默认规格、启用状态和排序；未配置启用规格时前台显示询价且不能直接下单。
- 商品图片支持手动维护 URL、上传压缩、Storage 写入、预览和 Storage 文件删除；主图/头图最大宽度 1200 px，详情图最大宽度 1000-1200 px。

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
- 调用 `translate-text` Edge Function，由服务端代理腾讯云机器翻译 API。
- 返回 `{ zh, en, ru }`。
- 管理员必须能人工修改翻译结果。

要求：
- 需要部署 `translate-text` Edge Function。
- Supabase secrets 需要配置 `TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY`，可选配置 `TENCENT_TRANSLATE_REGION`。

### `adminNotificationService`
文件：`src/services/adminNotificationService.ts`

后台通知配置 API：

- `getSettings()`：读取默认通知配置。
- `saveSettings(settings)`：保存飞书启用状态、机器人 webhook 和签名密钥。
- `sendTest(settings)`：向当前 webhook 发送测试通知，用于管理员验证机器人配置。

限制：

- webhook 和签名密钥仅允许管理员通过 `notification_settings` 读取和保存。

后台店铺配置 API：

- `storeSettingsService.getSettings()`：读取公开店铺配置，当前用于手机号国家/地区前缀下拉框；未配置 Supabase 或读取失败时回退默认中亚/中国/俄罗斯/其他列表。
- `storeSettingsService.saveSettings(settings)`：管理员保存店铺配置，写入 `store_settings` 单例行。
- `phonePrefixes`：手机号前缀配置数组，字段包含 `id`、三语 `label`、`prefix`、`isActive`、`isCustom`、`sortOrder`。
- 浏览器直接测试发送可能受飞书 webhook CORS 策略影响；订单通知由 `submit-order` Edge Function 服务端发送。

## Edge Function API

### `POST /functions/v1/submit-order`
用途：唯一订单提交入口。

访问控制：
- 该函数用于公开下单，部署时关闭 Edge Function JWT 校验。
- 前端只发送 Supabase `apikey` 请求头；函数内部使用服务端权限重新校验商品、价格和来源。
- Supabase 数据库必须授予 `service_role` 必要表权限：`products select`、`orders select/insert/delete`、`order_items insert`；飞书通知配置启用时还需要 `notification_settings select`。

### `POST /functions/v1/lookup-orders`
用途：前台订单自助查询。

访问控制：
- 该函数用于公开订单查询，部署时关闭 Edge Function JWT 校验。
- 函数内部要求手机号，并且必须同时提供订单号或社交账号，降低订单被枚举的风险。
- Supabase 数据库必须授予 `service_role` 必要表权限：`orders select`、`order_items select`。

请求体：
```json
{
  "phone": "+8613800000000",
  "orderId": "ORD-20260602-ABC12345"
}
```

### `POST /functions/v1/cancel-order`
用途：前台用户取消自己的新订单。

访问控制：
- 该函数用于公开订单取消，部署时关闭 Edge Function JWT 校验。
- 函数内部要求手机号和订单号，并且只允许取消 `new` 状态订单。
- Supabase 数据库必须授予 `service_role` 必要表权限：`orders select/update`、`order_items select`；飞书通知配置启用时还需要 `notification_settings select`。

请求体：
```json
{
  "orderId": "ORD-20260604-5410EF23",
  "phone": "+8613148488415"
}
```

响应体：
```json
{
  "orderId": "ORD-20260604-5410EF23",
  "status": "cancelled"
}
```

或：
```json
{
  "phone": "+8613800000000",
  "socialHandle": "eastshop_user"
}
```

返回：
```json
{
  "orders": [
    {
      "id": "ORD-20260602-ABC12345",
      "status": "new",
      "source": "web",
      "total": 58,
      "createdAt": "2026-06-02T08:29:49.000Z",
      "contact": {
        "phone": "+8613800000000",
        "address": "18号，横坑北"
      },
      "items": [
        {
          "productName": "PVC 防静电地板 600x600mm",
          "variantName": "600 x 600 mm",
          "quantity": 1,
          "unitPrice": 58,
          "subtotal": 58
        }
      ]
    }
  ]
}
```

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
- `source = telegram` 时必须验证 `telegramInitData`：服务端使用 `TELEGRAM_BOT_TOKEN` 按 Telegram WebApp `initData` 规则校验 `hash`，并默认检查 `auth_date` 未超过 24 小时。
- `source = instagram` 或 `web` 不做平台身份强验证。
- 必须重新读取 `products` 表，确认商品仍上架。
- 如果购物车行带 `variantId`，必须确认规格存在且启用，并使用该规格价格。
- 必须重新计算价格和总价。
- 必须写入 `orders` 和 `order_items`，订单明细需要保存规格 ID 和规格名称快照。
- 前端传入的价格和总价一律不可信。

## Data Types

### `Product`
- `id`
- `name`
- `description`
- `detail`
- `categoryId`
- `variants`
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
