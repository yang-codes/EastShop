# EastShop 技术结构

## Frontend
- 框架：React + Vite + TypeScript。
- 路由：`react-router-dom` 的 `HashRouter`。
- 多语言：`react-i18next`，支持 `zh`、`en`、`ru`。
- 图标：`lucide-react`。
- Excel 导出：`exceljs`。
- 图片压缩：`browser-image-compression`。
- 数据源：优先 Supabase；未配置 Supabase 时使用 `public/mock` JSON。
- 未配置 Supabase 时，前台下单会生成本地预览订单号，用于开发态验证流程；正式订单仍必须走 Edge Function。

## Routes
- `/`：商品列表。
- `/product/:productId`：商品详情。
- `/cart`：购物车。
- `/checkout`：提交订单。
- `/orders`：前台“我的订单”查询；Web/Instagram 使用手机号 + 订单号或手机号 + 社交账号读取订单状态和明细，Telegram Mini App 可通过验签身份自动读取本人订单。
- `/admin/login`：管理员登录。
- `/admin/products`：商品管理。
- `/admin/orders`：订单管理。
- `/admin/categories`：分类管理。
- `/admin/store-settings`：店铺配置，维护前台下单和订单查询使用的手机号前缀等公开配置。
- `/admin/notifications`：通知配置。
- `/admin/api-docs`：Scalar 接口文档。

## Services
- `catalogService`：读取商品和分类；支持 mock 与 Supabase 双模式。
- `cartService`：管理 `localStorage` 购物车。
- `locationService`：获取前台定位；Telegram Mini App 优先调用 `Telegram.WebApp.LocationManager`，失败后回退浏览器 Geolocation API，Web/Instagram 入口使用浏览器原生定位。拿到经纬度后调用 `reverse-geocode` Supabase Edge Function 反查国家、城市、街道和格式化地址；Geoapify key 只保存在服务端 secret。
- `orderService`：订单提交、前台订单查询和用户取消订单入口；提交调用 `submit-order`，查询调用 `lookup-orders`，取消调用 `cancel-order` Edge Function。Telegram Mini App 查询会携带 `initData`，由服务端验签后按 Telegram 用户 ID 查询。
- `adminNotificationService`：后台通知配置读取、保存和飞书测试发送入口。
- `authService`：Supabase Auth 登录、登出、读取管理员档案。
- `adminProductService`：后台商品读取和上下架。
- `adminOrderService`：后台订单读取与 CSV/XLSX 导出。
- `translationService`：后台商品翻译辅助；通过 `translate-text` Edge Function 代理腾讯云机器翻译 API，避免腾讯云 SecretKey 暴露到浏览器。

详细接口说明见 `API.md`。服务层公开方法保留 JSDoc 注释，说明用途、返回值、当前限制和后续接入点。

## Admin UI
- 商品管理页当前提供商品 KPI、搜索、分类筛选、商品列表、新增、编辑、删除、上下架、推荐、排序、销售规格、主图 URL 列表和详情页图片 URL 字段。
- 订单管理页当前提供状态统计、搜索、状态筛选、订单详情卡片、订单状态更新和 CSV/XLSX 导出。
- 分类管理页当前提供分类搜索、分类列表、新增、编辑、删除、排序和上下架；分类上下架状态变化时会提示确认，并同步上下架该分类下所有商品；删除分类前会提示确认，并将该分类下商品同步下架且重置为未分类。
- 通知配置页提供飞书订单通知启用状态、机器人 webhook、签名密钥和测试发送能力。
- 店铺配置页提供手机号国家/地区前缀和社媒平台来源配置，前台结算页和我的订单页读取同一份配置。
- 后台图片已拆分为主图和详情页图片：主图支持多张 URL，第一张同步为 `cover_image` 用于列表卡片和购物车缩略图，完整列表保存到 `cover_images`；商品详情页顶部单张主图静态展示，多张主图自动轮播展示。详情页图片 URL 列表用于商品详情页纵向详情图流展示，每张图独占一行。当前已支持上传、压缩、Supabase Storage 写入、URL 回填、图片预览和 Storage 删除。
- 后台图片字段展示上传尺寸建议：主图/头图建议 4:3 横图，上传后最大宽度 1200 px；详情图上传后最大宽度 1000-1200 px，高度不限；商品列表缩略图由前端使用主图自动压小显示，不单独上传。
- 商品支持可购买销售规格：`products.variants` 保存规格三语名称、价格、SKU、启用状态、默认规格和排序；前台详情页按所选规格计价，购物车按 `productId + variantId` 拆分商品行。
- 商品详情页视觉上通过主图角标和详情图片分区标题区分主图与详情图，避免运营上传相似图片后用户误认。
- Web 前台首页保留商品宫格和筛选器，用于浏览全部商品。
- Web 商品详情页采用左右联动布局：左侧显示所有商品列表，点击商品后右侧直接渲染当前商品详情，并同步切换 `/product/:productId` 深度链接。
- 详情页桌面布局参考主流商城的目录式浏览体验：左侧商品清单保持紧凑扫读，右侧详情区突出商品图、价格、规格和购买动作；移动端自动回落为单列。
- 接口文档页使用 `@scalar/api-reference-react` 渲染 `.md/openapi.yaml`。
- 后台路由由 `AdminLayout` 统一保护：加载当前 Supabase Auth 用户并检查 `admin_profiles.is_active`。
- 登录页使用 Supabase Auth 邮箱密码登录；非管理员账号会被立即退出。
- 登录页已对 Supabase 返回的对象错误做字符串化处理，避免界面显示 `[对象 对象]`。

## Supabase Tables
- `products`：商品主表，保存三语内容、分类、图片、展示规格、销售规格、标签、排序、推荐和上架状态；商品价格只来自销售规格。
- `categories`：商品分类表，保存三语分类名称、排序和启用状态；主键为 `uuid`。
- `orders`：订单主表，保存客户联系方式、社媒平台来源、地址、来源、定位、总价、处理状态、购物车指纹 `cart_fingerprint`，以及 Telegram Mini App 验签后的用户快照和 `telegram_user_id`。
- `order_items`：订单明细表，保存下单时商品和销售规格快照。
- `admin_profiles`：后台管理员授权表，关联 Supabase Auth 用户。
- `notification_settings`：后台通知配置表，保存飞书通知启用状态、机器人 webhook 和签名密钥，仅管理员可读写。
- `store_settings`：店铺公开配置表，保存手机号前缀和社媒平台来源下拉选项；前台可读，管理员可写。

SQL 操作文档见 `.md/sql-docs/SUPABASE_SQL_SETUP.md`。
可版本化迁移文件见 `supabase/migrations/001_initial_schema.sql`、`supabase/migrations/002_rls_policies.sql` 和 `supabase/migrations/003_beijing_time_columns.sql`。

## Supabase Access Model
- `anon` 可以读取启用的分类和已上架商品，用于商城前台公开访问。
- `authenticated` 需要基础 `GRANT` 表权限，才可以通过 Supabase REST 访问对应表。
- RLS policy 负责进一步限制行级访问；`GRANT` 不会绕过 RLS。
- `admin_profiles` 查询需要 `grant select on public.admin_profiles to authenticated`，否则后台登录后可能返回 `403 Forbidden`。
- 管理后台写入商品、分类和更新订单状态时，必须同时满足 `authenticated` 表权限和 `public.is_admin()` RLS 判断。

## Edge Function
- `submit-order` 是唯一订单提交入口。
- `submit-order` 是公开 Edge Function，`supabase/config.toml` 中 `verify_jwt = false`；公开访问只用于接收订单，函数内部必须重新校验商品、价格和来源。
- `submit-order` 使用隐藏 honeypot 字段过滤自动提交，按 IP 做默认 30 次/分钟限流，按手机号做默认 3 次/10 分钟限流。
- `submit-order` 会按手机号、来源、金额和商品/规格/数量指纹做 5 分钟重复订单检测；订单写入时同步保存 `orders.cart_fingerprint`，数据库触发器 `prevent_recent_duplicate_order` 会在插入层阻止重复订单，避免 Edge Function 多实例、并发提交或前置查询漏判。
- `lookup-orders` 是前台“我的订单”查询入口，`verify_jwt = false`；Web/Instagram 查询要求手机号，并且必须同时提供订单号或社交账号，避免只凭单一字段枚举订单。Telegram Mini App 查询可只提交 `initData`，函数验签后按 `orders.telegram_user_id` 返回本人订单。
- `cancel-order` 是前台“我的订单”取消入口，`verify_jwt = false`；函数内部要求手机号和订单号，且只允许把 `new` 状态订单改为 `cancelled`。
- `reverse-geocode` 是前台定位地址反查入口，`verify_jwt = false`；函数内部读取 `GEOAPIFY_API_KEY` 调用 Geoapify，失败时返回经纬度兜底。它只负责经纬度到地址的反查，不负责获取经纬度。
- `translate-text` 是后台翻译入口，`supabase/config.toml` 中 `verify_jwt = true`；函数内部会校验当前登录用户是否是启用管理员。
- Telegram 来源必须验证 `initData`：`submit-order` 使用 `TELEGRAM_BOT_TOKEN` 计算 Telegram WebApp `hash`，校验 `auth_date`，并把验签后的 Telegram 用户快照写入 `orders.telegram_user`，同时写入 `orders.telegram_user_id` 用于后续“我的订单”自动查询。
- Instagram/Web 来源不做平台身份强验证。
- 服务端重新读取商品销售规格价格和上架状态，重新计算总价。
- 写入 `orders` 和 `order_items`，返回订单 ID 和最终总价。
- 重复订单被拒绝时返回 `409 DUPLICATE_ORDER`；该保护依赖 `supabase/migrations/013_order_duplicate_guard.sql` 已执行，且新版 `submit-order` 已部署。
- 订单写入成功后读取 `notification_settings`；启用飞书通知时发送订单提醒，发送失败只记录日志且不影响订单成功响应。
- 订单取消成功后读取 `notification_settings`；启用飞书通知时发送取消提醒，发送失败只记录日志且不影响取消成功响应。
- 订单提交、查询和取消会保留 `social_platform` 与 `social_handle`，飞书通知中会展示客户选择的平台来源和账号。
- `service_role` 需要具备 `products select`、`orders select/insert/update/delete`、`order_items select/insert` 权限；通知配置启用时还需要 `notification_settings select`。
- 函数代码位于 `supabase/functions/submit-order/index.ts`；仍需部署到 Supabase 后前端真实下单才可用。

## Security
- 普通访问者只能读取已上架商品和启用分类。
- 前端不能直接写 `orders` 和 `order_items`。
- 只有管理员能管理商品、分类、订单和订单状态。
- 后台访问要求 Supabase Auth 会话和启用的 `admin_profiles` 记录。
- 后台登录 403 优先检查 `GRANT` 表权限、`admin_profiles.user_id = auth.users.id` 和 RLS policy。
- `notification_settings` 中的飞书 webhook 和签名密钥只能由管理员读取和修改，普通前台不可访问。
- Telegram Bot Token、Telegram `initData` 最大有效期配置和 Supabase `service_role` key 只能放在服务端 secrets。
