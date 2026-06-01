# EastShop 当前任务

## P0：把当前前台闭环跑通
- [x] 修复剩余 i18n 缺失 key。
- [x] 商品列表实现搜索、分类筛选、推荐筛选。
- [x] 商品详情增加多图展示。
- [x] 下单页读取购物车并展示订单摘要。
- [x] 下单页表单受控化，增加基础校验。
- [x] `orderService.submitOrder` 接入 Supabase Edge Function 调用。
- [x] 下单成功后清空购物车并展示订单 ID。

## P1：接入真实 Supabase 数据
- [x] 编写 Supabase SQL schema。
- [x] 创建 RLS 策略。
- [x] 补充 Supabase 表访问 `GRANT`，用于解决 REST 查询 `403 Forbidden`。
- [ ] 创建 `product-images` bucket。
- [x] 生成 Supabase 商品和分类测试数据 SQL。
- [ ] 在 Supabase SQL Editor 执行 `supabase/seed.sql` 导入测试商品和分类。
- [ ] 校验未配置 Supabase 时 mock 模式仍可运行。
- [ ] 校验配置 Supabase 后真实数据读取正常。
- [ ] 在 Supabase SQL Editor 执行最新 `.codex/sql-docs/SUPABASE_SQL_SETUP.md` 中第 4.1 节表访问权限 SQL。
- [ ] 确认 `582587966@qq.com` 已存在于 `auth.users`，并在 `admin_profiles` 中绑定同一个 `user_id` 且 `is_active = true`。

## P2：后台商品和分类管理
- [x] 完成管理员登录保护路由。
- [x] 商品列表显示 mock/Supabase 读取数据。
- [x] 商品新增/编辑保存接入 Supabase upsert。
- [ ] 商品主图/多图上传、压缩、预览、删除。
- [x] 商品上架/下架、推荐、排序真实保存。
- [x] 分类新增/编辑/排序/启用停用表单骨架。
- [x] 分类管理真实保存。
- [ ] DeepL 翻译按钮接入真实服务或 Edge Function 代理。

## P3：订单和 Telegram 验证
- [ ] 实现 `submit-order` Edge Function。
- [ ] Telegram `initData` 服务端校验。
- [x] Web/Instagram 下单来源标记。
- [x] 订单管理列表和详情卡片骨架。
- [x] CSV/XLSX 导出开发态订单。
- [x] 订单状态真实更新。
- [x] CSV/XLSX 导出真实订单。
- [ ] 权限回归测试。

## Documentation
- [x] 增加 `API.md` 接口文档。
- [x] 增加 `.codex/openapi.yaml` OpenAPI 规范。
- [x] 接入 Scalar 后台接口文档页面 `/admin/api-docs`。
- [x] 给当前服务层方法补充 JSDoc 注释。
- [x] Supabase schema 落地后补充 SQL、RLS 和表权限示例。
- [x] 生成 Supabase SQL 操作文档 `.codex/sql-docs/SUPABASE_SQL_SETUP.md`。
- [x] 补充 `admin_profiles` 登录 403 排查 SQL。

## Test Checklist
- [x] `npm run lint`
- [x] `npm run build`
- [ ] 执行最新 Supabase 表权限和管理员授权 SQL 后，Supabase Auth 登录成功跳转 `/admin/products`。
- [ ] 未登录访问 `/admin/*` 会跳转 `/admin/login`。
- [ ] 非 `admin_profiles.is_active = true` 用户登录后会退出并显示未授权。
- [x] 商品浏览、购物车、下单在 mock 模式下可用。
- [ ] 后台管理在 mock 模式下可用。
- [ ] 配置 Supabase 后真实数据读取正常。
- [ ] Telegram Mini App 下单验证正常。
- [ ] GitHub Pages 深度链接 `/#/product/:productId` 可直接打开。
