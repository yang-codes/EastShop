# EastShop 项目计划

## Summary
EastShop 是一个面向中亚市场的轻量多语言商品商城。用户可从 Telegram Bot 进入商城，也可通过 Instagram/Web 链接访问；浏览商品、加入购物车、填写联系方式、定位获取坐标后提交订单。管理员通过手机或电脑浏览器登录后台，管理商品、分类、订单和导出数据。

项目技术栈为 React + Vite + TypeScript。前端使用 `HashRouter` 兼容 GitHub Pages；Supabase 负责商品、分类、订单、管理员权限、图片存储；Telegram Mini App 身份验证和订单写入由 Supabase Edge Function 负责。

## Project Docs
- `.md/TODO.md`：当前任务和测试清单。
- `.md/ARCHITECTURE.md`：技术结构和数据表设计。
- `.md/API.md`：前端服务接口、Edge Function 目标接口和数据类型。
- `.md/CHANGELOG.md`：已完成变更记录。
- `.md/sql-docs/SUPABASE_SQL_SETUP.md`：Supabase 建表、RLS、表权限、管理员授权和常见错误处理 SQL。

## Product Scope
- Telegram、Instagram、Web 共用同一个商城前台。
- 来源识别支持 URL `source=telegram|instagram|web`、Telegram WebApp 自动识别、Instagram 内置浏览器/referrer 自动识别，并把识别结果保存在当前浏览会话中，站内跳转无需重复带来源参数。
- Telegram 入口需要提交 `Telegram.WebApp.initData`，由服务端验证用户身份。
- 商品列表支持搜索、分类筛选、推荐商品、加载/错误/空状态。
- 商品详情展示主图、多图、价格、简介、详情、规格、标签。
- 购物车使用 `localStorage` 保留，支持数量调整、删除和合计。
- 下单页填写客户信息、详细地址、社交账号、备注，并支持浏览器定位；地址反查通过 Supabase Edge Function 代理 Geoapify。
- 订单提交必须由服务端重新读取商品价格和上架状态，不能信任前端总价。

## Admin Scope
- 使用 Supabase Auth 邮箱密码登录，后台不开放公开注册。
- 登录后读取 `admin_profiles`，只有启用管理员可进入后台；`admin_profiles` 需要同时配置 `GRANT` 表访问权限和 RLS policy。
- 商品管理支持三语内容、分类、价格、图片、推荐、排序、上下架。
- 分类管理支持三语名称、排序、启用/停用。
- 订单管理支持来源、客户、地址、定位、商品明细、总价、状态和导出。
- 通知配置支持管理员维护飞书订单通知的启用状态、机器人 webhook 和签名密钥。
- 腾讯云机器翻译用于后台商品翻译辅助，翻译结果必须允许人工修改。

## Deployment Plan
- GitHub Actions 构建 Vite 项目并发布 `dist` 到 GitHub Pages。
- 使用 `HashRouter` 避免刷新 404。
- 绑定自定义域名后 Vite `base` 保持 `/`。
- Telegram Bot 菜单按钮指向正式商城域名。
- Supabase 创建表、索引、Storage bucket、RLS 策略、表访问权限、`service_role` Edge Function 权限、通知配置表，以及 `submit-order`、`lookup-orders`、`cancel-order`、`reverse-geocode` 等 Edge Function。
- `submit-order` Edge Function 写入订单后读取后台通知配置，并在启用飞书通知时发送订单提醒；飞书发送失败不影响订单提交成功。
- 公开仓库不能提交 `.env.local`、Supabase service role key、Telegram Bot Token、腾讯云 SecretKey 或数据库连接密码。

## Assumptions
- 第一版不接支付接口。
- 第一版不做库存管理，只通过上下架控制商品是否可售。
- 商品正式数据必须由后台或 Supabase 管理，mock JSON 只作为开发兜底。
- 后台必须支持手机和电脑浏览器。
- Instagram 只作为普通网页入口兼容，不提供可信平台用户验证；优先通过 Instagram 内置浏览器/referrer 自动标记来源，特殊外部浏览器场景仍可用 `source=instagram` 显式标记。
- 飞书通知默认使用群自定义机器人 webhook；个人用户可创建仅自己使用的飞书群接收通知，不做飞书个人单聊应用机器人。
