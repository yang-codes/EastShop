# EastShop 当前任务

## P0：把当前前台闭环跑通
- [x] 修复剩余 i18n 缺失 key。
- [x] 商品列表实现搜索、分类筛选、推荐筛选。
- [x] 商品详情增加多图展示。
- [x] Web 商品详情页改为左侧商品列表、右侧当前商品详情的联动布局；商城主页保留商品宫格。
- [x] 下单页读取购物车并展示订单摘要。
- [x] 购物车页增加“继续选购”入口，便于返回商品列表继续加购。
- [x] 下单页表单受控化，增加基础校验。
- [x] `orderService.submitOrder` 接入 Supabase Edge Function 调用。
- [x] 下单页地址反查改为调用 `reverse-geocode` Edge Function，Geoapify key 不再暴露到前端。
- [x] 下单页定位改为 Telegram Mini App 优先调用 `LocationManager`，Web/Instagram 兜底使用浏览器原生定位。
- [x] 前台新增“我的订单”入口和 `/orders` 查询页。
- [x] 支持手机号 + 订单号 / 手机号 + 社交账号查询订单。
- [x] 查询结果展示订单状态、商品、规格、数量、金额、地址和下单时间。
- [x] 新增 `lookup-orders` Edge Function，后台改订单状态后前台可重新查询看到最新状态。
- [x] “我的订单”中状态为新订单时支持用户取消订单，其他状态不可取消。
- [x] 下单成功后清空购物车并展示订单 ID。

## P1：接入真实 Supabase 数据
- [x] 编写 Supabase SQL schema。
- [x] 创建 RLS 策略。
- [x] 补充 Supabase 表访问 `GRANT`，用于解决 REST 查询 `403 Forbidden`。
- [x] 生成 `product-images` bucket 创建和 Storage policy SQL。
- [x] 在 Supabase SQL Editor 执行 `supabase/migrations/004_product_images_bucket.sql` 创建 `product-images` bucket。
- [ ] 在 Supabase SQL Editor 执行 `supabase/migrations/005_product_cover_images.sql` 创建 `cover_images` 主图列表字段。
- [x] 生成 Supabase 商品和分类测试数据 SQL。
- [ ] 在 Supabase SQL Editor 执行 `supabase/seed.sql` 导入测试商品和分类。
- [ ] 校验未配置 Supabase 时 mock 模式仍可运行。
- [ ] 校验配置 Supabase 后真实数据读取正常。
- [ ] 在 Supabase SQL Editor 执行最新 `.md/sql-docs/SUPABASE_SQL_SETUP.md` 中第 4.1 节表访问权限 SQL。
- [ ] 在 Supabase SQL Editor 执行 `supabase/migrations/006_service_role_order_permissions.sql`，补齐 `submit-order`、`lookup-orders` 和 `translate-text` 使用的 `service_role` 表权限。
- [ ] 在 Supabase SQL Editor 执行 `supabase/migrations/007_notification_settings.sql`，创建飞书通知配置表、RLS 和 `service_role` 读取权限。
- [ ] 确认 `582587966@qq.com` 已存在于 `auth.users`，并在 `admin_profiles` 中绑定同一个 `user_id` 且 `is_active = true`。

## P2：后台商品和分类管理
- [x] 完成管理员登录保护路由。
- [x] 商品列表显示 mock/Supabase 读取数据。
- [x] 商品新增/编辑保存接入 Supabase upsert。
- [x] 商品主图/多图上传、压缩、回填 URL。
- [x] 主图与详情页图片拆分：主图上传只回填主图 URL，详情页图片列表单独上传和展示。
- [x] 主图支持多张上传和 URL 列表管理，详情页单张主图静态展示，多张主图自动轮播展示。
- [x] 后台图片字段标注推荐上传尺寸。
- [x] 商品详情页图片改为一张占一行的纵向详情图流，不再作为主图缩略图切换。
- [x] 商品详情页增加主图角标和详情图片分区标题，视觉区分主图与详情图。
- [x] 商品图片预览、Storage 删除。
- [x] 商品上架/下架、推荐、排序真实保存。
- [x] 分类新增/编辑/排序/启用停用表单骨架。
- [x] 分类管理真实保存。
- [x] 分类上下架时弹出确认提示，并同步上下架该分类下所有商品。
- [x] 删除分类时弹出确认提示，并同步下架该分类下所有商品且重置为空分类。
- [x] 腾讯云机器翻译按钮接入真实服务或 Edge Function 代理。
- [x] Supabase secrets 已配置腾讯云机器翻译：`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_TRANSLATE_REGION`。
- [ ] 重新部署 `translate-text` Edge Function 并在后台商品编辑页验证“补齐 EN/RU”。
- [x] 商品删除增加确认弹框，确认后才执行删除。
- [x] 商品保存成功后弹出已保存提醒。

## P3：订单和 Telegram 验证
- [x] 实现 `submit-order` Edge Function。
- [x] 部署 `submit-order` Edge Function 到 Supabase。
- [x] 部署 `lookup-orders` Edge Function 到 Supabase，并验证前台“我的订单”查询。
- [x] Telegram `initData` 服务端校验。
- [x] Telegram Mini App “我的订单”支持通过验签 `initData` 自动查询本人订单，无需输入手机号、订单号或社交账号。
- [x] Web/Instagram 下单来源标记；Instagram 支持内置浏览器/referrer 自动识别，并在当前会话中记住来源。
- [x] 订单管理列表和详情卡片骨架。
- [x] CSV/XLSX 导出开发态订单。
- [x] 订单状态真实更新。
- [x] CSV/XLSX 导出真实订单。
- [x] 新增 `/admin/notifications` 通知配置页。
- [x] 后台侧边栏新增“通知配置”菜单。
- [x] 新增 `/admin/store-settings` 店铺配置页，用于维护提交订单和我的订单查询页的手机号前缀下拉选项。
- [x] 在 Supabase SQL Editor 执行 `supabase/migrations/009_store_settings.sql`，创建 `store_settings` 表和 RLS。
- [x] 店铺配置支持维护社媒平台来源下拉选项，默认 Telegram、Instagram、Facebook 和其他。
- [x] 新增 `supabase/migrations/011_social_platform_settings.sql`，为 `store_settings` 增加 `social_platforms`，为 `orders` 增加 `social_platform`。
- [x] 下单页社交账号改为“平台来源下拉 + 账号输入”，订单后台、订单查询和飞书通知可展示平台来源。
- [x] 新增 `notification_settings` Supabase 表、表权限和仅管理员可读写的 RLS 策略。
- [x] 通知配置页支持保存飞书通知启用状态、机器人 webhook 和签名密钥。
- [x] 通知配置页增加测试发送按钮，用于验证飞书机器人是否可用。
- [x] `submit-order` 成功写入订单后读取通知配置并发送飞书订单通知。
- [x] 新增 `cancel-order` Edge Function，用户取消新订单后同步发送飞书取消通知。
- [x] 新增 `reverse-geocode` Edge Function，服务端代理 Geoapify 地址反查。
- [ ] 部署 `reverse-geocode` Edge Function，并配置 Supabase secret `GEOAPIFY_API_KEY`。
- [x] 飞书通知发送失败时记录错误，但不影响订单提交成功响应。
- [x] `submit-order` 增加 honeypot、IP 级限流（默认 10 次/分钟）、手机号级限流（默认 3 次/10 分钟）和 5 分钟重复订单检测（按手机号、来源、金额、商品/规格/数量指纹判断）。
- [x] 新增 `supabase/migrations/013_order_duplicate_guard.sql`，写入 `orders.cart_fingerprint` 并用数据库触发器阻止同手机号、来源、金额、商品/规格/数量指纹在 5 分钟内重复插入。
reverse-geocode
-[]配制ALLOWED_ORIGINS（supabase secrets set ALLOWED_ORIGINS="https://你的域名.com,https://你的用户名.github.io"
）
-[x]增加 Origin allowlist：读取 Supabase secret/env ALLOWED_ORIGINS，127.0.0.1 默认允许，方便本地开发。增加 IP 级限流：默认 30 次/分钟。

- [ ] 在 Supabase SQL Editor 执行 `supabase/migrations/013_order_duplicate_guard.sql` 或运行 `supabase db push`。
- [ ] 重新部署 `submit-order` Edge Function，确保重复订单检测、honeypot 和限流在线上生效。
- [ ] 权限回归测试。

## Documentation
- [x] 增加 `API.md` 接口文档。
- [x] 增加 `.md/openapi.yaml` OpenAPI 规范。
- [x] 接入 Scalar 后台接口文档页面 `/admin/api-docs`。
- [x] 给当前服务层方法补充 JSDoc 注释。
- [x] Supabase schema 落地后补充 SQL、RLS 和表权限示例。
- [x] 生成 Supabase SQL 操作文档 `.md/sql-docs/SUPABASE_SQL_SETUP.md`。
- [x] 补充 `admin_profiles` 登录 403 排查 SQL。

## Test Checklist
- [x] `npm run lint`
- [x] `npm run build`
- [ ] 执行最新 Supabase 表权限和管理员授权 SQL 后，Supabase Auth 登录成功跳转 `/admin/products`。
- [ ] 未登录访问 `/admin/*` 会跳转 `/admin/login`。
- [ ] 非 `admin_profiles.is_active = true` 用户登录后会退出并显示未授权。
- [x] 商品浏览、购物车、下单在 mock 模式下可用。
- [x] 后台管理在 mock 模式下可用。
- [ ] 配置 Supabase 后真实数据读取正常。
- [ ] Telegram Mini App 下单验证正常。
- [ ] Telegram Mini App 进入“我的订单”会自动按 Telegram 身份查询本人订单。
- [ ] 管理员可以进入 `/admin/notifications` 并保存通知配置。
- [ ] 非管理员无法读取或修改 `notification_settings`。
- [ ] 管理员可以在 `/admin/store-settings` 配置社媒平台来源，并在下单页看到启用项。
- [ ] 订单提交、订单查询和取消订单通知均能保留并展示社媒平台来源。
- [x] 飞书测试发送成功时目标飞书群收到测试消息。
- [ ] 订单提交成功时飞书群收到订单通知，通知失败时订单仍提交成功。
- [ ] 前台“我的订单”中取消新订单后状态变为已取消，且飞书群收到取消通知。
- [ ] 同手机号、同来源、同金额、同商品/规格/数量的订单在 5 分钟内第二次提交返回 `409 DUPLICATE_ORDER`，后台不会新增第二单。
- [ ] GitHub Pages 深度链接 `/#/product/:productId` 可直接打开。
