# EastShop 变更记录

## 2026-05-30

### 已完成或已有骨架
- 项目已初始化为 React + Vite + TypeScript。
- 已建立前台路由：`/`、`/product/:productId`、`/cart`、`/checkout`。
- 已建立后台路由：`/admin/login`、`/admin/products`、`/admin/orders`、`/admin/categories`。
- 商品列表页可从 Supabase 或 mock JSON 加载已上架商品。
- 商品详情页可展示三语商品名称、简介、详情、规格、标签和主图。
- 购物车已使用 `localStorage` 持久化，支持加减数量、删除、合计金额。
- 下单页已有客户字段、浏览器定位按钮和 Google Maps 链接。
- 多语言框架已接入 `react-i18next`，当前界面文案支持中文、英文、俄文三语。
- 商品列表页新增搜索、分类筛选和只看推荐筛选。
- 商品详情页新增多图缩略图切换。
- 下单页改为受控表单，增加姓名、电话、地址基础校验。
- 下单页读取购物车并展示订单摘要、明细和合计。
- 下单成功后清空购物车，并展示订单号。
- 未配置 Supabase 时，下单返回本地预览订单号，便于 mock 模式跑通前台闭环。
- 配置 Supabase 后，`orderService.submitOrder` 调用 `submit-order` Edge Function。
- 来源识别支持普通 query 和 HashRouter hash query 中的 `source=telegram|instagram|web`。

### 后台管理
- 商品管理页增加 KPI、搜索、分类筛选、商品列表和商品编辑表单骨架。
- 订单管理页增加状态统计、搜索、状态筛选、订单卡片和 CSV/XLSX 导出入口。
- 分类管理页增加搜索、分类列表和分类编辑表单骨架。
- `adminOrderService.listOrders` 增加开发态 mock 订单，便于后台订单页在未接 Supabase 前展示。
- 商品管理接入新增、编辑、删除、上下架、推荐和排序保存。
- 分类管理接入新增、编辑、删除、排序和启用状态保存。
- 订单管理接入状态更新。
- `adminProductService` 增加商品和分类的 Supabase 映射、upsert 和 delete 方法。
- `adminOrderService` 增加 Supabase 订单读取和订单状态更新。
- 后台登录页接入 Supabase Auth 邮箱密码登录。
- 后台路由接入 `admin_profiles` 授权检查，未登录或未授权用户跳转登录页。
- 退出按钮接入 Supabase Auth 登出。
- 修正 `admin_profiles` snake_case 到前端 `AdminProfile` camelCase 的映射。
- 修复登录页对象错误直接显示为 `[对象 对象]` 的问题，改为提取 `message` 或显示通用登录失败提示。
- 定位后台登录后查询 `admin_profiles` 返回 403 的原因：表基础访问权限缺失或管理员授权行/RLS 未配置完整。

### 文档
- 新增 `PLAN.md`、`TODO.md`、`ARCHITECTURE.md`、`CHANGELOG.md`。
- 新增 `API.md` 接口文档。
- 新增 `.codex/openapi.yaml` OpenAPI 规范。
- 后台新增 `/admin/api-docs` Scalar 接口文档页面。
- 服务层方法增加 JSDoc 注释。
- 补充服务方法、参数、OpenAPI 接口参数和核心字段的业务用途说明。
- 新增 Supabase SQL 操作文档 `.codex/sql-docs/SUPABASE_SQL_SETUP.md`。
- 新增 Supabase migration：`001_initial_schema.sql`、`002_rls_policies.sql`。
- 将 Supabase 建表 SQL 中的业务时间字段改为北京时间本地时间。
- 新增 Supabase migration：`003_beijing_time_columns.sql`，用于把已存在旧表的时间字段迁移为北京时间。
- `categories.id` 已按当前数据库方案改为 `uuid`，`products.category_id` 同步为 `uuid` 外键。
- `002_rls_policies.sql` 补充 `GRANT` 表访问权限，避免 Supabase REST 在 RLS 判断前返回 403。
- `.codex/sql-docs/SUPABASE_SQL_SETUP.md` 新增第 4.1 节表访问权限 SQL 和 `admin_profiles` 登录 403 排查说明。
- `.codex/TODO.md` 已按当前自动完成项更新 P0 前台闭环和 P3 来源标记进度。
- 新增 `supabase/seed.sql`，提供 3 个分类和 12 条 Supabase 商品测试数据，可重复执行。

### 已知未完成
- 后台商品、分类、订单状态已接 Supabase CRUD；商品图片文件上传、压缩、Storage 删除仍未完成。
- 当前 Supabase Auth 登录还需要在 Supabase 控制台执行最新表权限 SQL，并确认管理员邮箱已写入 `admin_profiles`。
- 订单提交和 Telegram `initData` 服务端验证尚未实现。
- Geoapify 和 DeepL 仍未接真实 API。
