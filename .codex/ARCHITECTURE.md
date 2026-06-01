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
- `/admin/login`：管理员登录。
- `/admin/products`：商品管理。
- `/admin/orders`：订单管理。
- `/admin/categories`：分类管理。
- `/admin/api-docs`：Scalar 接口文档。

## Services
- `catalogService`：读取商品和分类；支持 mock 与 Supabase 双模式。
- `cartService`：管理 `localStorage` 购物车。
- `locationService`：获取浏览器定位；后续接入 Geoapify Reverse Geocoding。
- `orderService`：订单提交入口；配置 Supabase 后调用 `submit-order` Edge Function，未配置时返回本地预览订单号。
- `authService`：Supabase Auth 登录、登出、读取管理员档案。
- `adminProductService`：后台商品读取和上下架。
- `adminOrderService`：后台订单读取与 CSV/XLSX 导出。
- `translationService`：DeepL 翻译辅助；当前仍是占位实现。

详细接口说明见 `API.md`。服务层公开方法保留 JSDoc 注释，说明用途、返回值、当前限制和后续接入点。

## Admin UI
- 商品管理页当前提供商品 KPI、搜索、分类筛选、商品列表、新增、编辑、删除、上下架、推荐、排序和图片 URL 字段。
- 订单管理页当前提供状态统计、搜索、状态筛选、订单详情卡片、订单状态更新和 CSV/XLSX 导出。
- 分类管理页当前提供分类搜索、分类列表、新增、编辑、删除、排序和启用/停用。
- 当前后台图片字段先支持 URL 管理；真实文件上传、压缩、预览和 Supabase Storage 写入仍需实现。
- 接口文档页使用 `@scalar/api-reference-react` 渲染 `.codex/openapi.yaml`。
- 后台路由由 `AdminLayout` 统一保护：加载当前 Supabase Auth 用户并检查 `admin_profiles.is_active`。
- 登录页使用 Supabase Auth 邮箱密码登录；非管理员账号会被立即退出。
- 登录页已对 Supabase 返回的对象错误做字符串化处理，避免界面显示 `[对象 对象]`。

## Supabase Tables
- `products`：商品主表，保存三语内容、分类、价格、图片、规格、标签、排序、推荐和上架状态。
- `categories`：商品分类表，保存三语分类名称、排序和启用状态；主键为 `uuid`。
- `orders`：订单主表，保存客户联系方式、地址、来源、定位、总价和处理状态。
- `order_items`：订单明细表，保存下单时商品快照。
- `admin_profiles`：后台管理员授权表，关联 Supabase Auth 用户。

SQL 操作文档见 `.codex/sql-docs/SUPABASE_SQL_SETUP.md`。
可版本化迁移文件见 `supabase/migrations/001_initial_schema.sql`、`supabase/migrations/002_rls_policies.sql` 和 `supabase/migrations/003_beijing_time_columns.sql`。

## Supabase Access Model
- `anon` 可以读取启用的分类和已上架商品，用于商城前台公开访问。
- `authenticated` 需要基础 `GRANT` 表权限，才可以通过 Supabase REST 访问对应表。
- RLS policy 负责进一步限制行级访问；`GRANT` 不会绕过 RLS。
- `admin_profiles` 查询需要 `grant select on public.admin_profiles to authenticated`，否则后台登录后可能返回 `403 Forbidden`。
- 管理后台写入商品、分类和更新订单状态时，必须同时满足 `authenticated` 表权限和 `public.is_admin()` RLS 判断。

## Edge Function
- `submit-order` 是唯一订单提交入口。
- Telegram 来源必须验证 `initData`。
- Instagram/Web 来源不做平台身份强验证。
- 服务端重新读取商品价格和上架状态，重新计算总价。
- 写入 `orders` 和 `order_items`，返回订单 ID 和最终总价。
- 前端已经按目标请求体调用该函数；函数本体仍待实现。

## Security
- 普通访问者只能读取已上架商品和启用分类。
- 前端不能直接写 `orders` 和 `order_items`。
- 只有管理员能管理商品、分类、订单和订单状态。
- 后台访问要求 Supabase Auth 会话和启用的 `admin_profiles` 记录。
- 后台登录 403 优先检查 `GRANT` 表权限、`admin_profiles.user_id = auth.users.id` 和 RLS policy。
- Telegram Bot Token 和 Supabase `service_role` key 只能放在服务端 secrets。
