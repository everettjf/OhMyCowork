# OhMyCowork 规划（2026-01-30）

## 目标
- 打造本地优先的 AI coworker：聊天 + 文件工作区 + 浏览器访问/自动化
- 以可见、可控、可审计为核心体验（工具调用透明）
- 形成差异化：本地隐私 + 浏览器自动化 + 工作流编排

## 当前能力（已在代码中）
- 桌面端：Tauri + React，线程式对话
- 工作区：目录选择、文件树浏览
- 工具：时间/时区/随机数/UUID/计算器/运行 Node/网络搜索
- 子代理：文件夹整理
- 渲染：Markdown + KaTeX

## 主要缺口（对标外部产品）
- 对话层：持久化、检索、标签/收藏
- 文件层：文件预览/编辑、全文检索、拖拽上传、批量操作
- 工具层：PDF/CSV/Excel、图片生成、OCR、数据采集
- 浏览器层：内置浏览 + 自动化 + 可视化回放
- 多智能体：任务拆解、计划执行、回滚/重试

## 重点方向：浏览器访问/自动化
### 方案组合
- A. 内嵌 Webview：提供阅读与人工操作区
- B. 本地 Playwright：自动化、截图、表单填充
- C. 云端浏览器 Live View：人机协作（登录/2FA）
- D. Computer Use：UI 级自动化（成本高、稳定性要求高）

### 近期建议
- 先落地 B（本地 Playwright / agent-browser）作为可用的自动化能力
- 后续再引入 A（内嵌 Webview）做阅读区，再补 C 做“接管”

## Roadmap（建议）
### P0（1-2 周）
- 会话本地持久化（SQLite / 加密存储）
- 文件预览（文本/Markdown/代码）
- 工具调用可视化增强（结果摘要卡片）
- agent-browser 接入（见下方）

### P1（2-4 周）
- 文档/代码索引与全文检索
- 文件操作：拖拽上传、批量移动/重命名
- CSV/Excel/PDF 基础工具
- 浏览器读取结果结构化输出（摘要/引用）

### P2（1-2 月）
- 多智能体任务编排（Plan/Execute）
- 任务历史与可回放
- 多模型协作 / A/B 对比

### P3（长期）
- 云端同步（可选端到端加密）
- 浏览器 Live View（人机协作）
- 多端/通知/后台守护

## agent-browser 集成计划（本次）
### 目标
- 通过工具 `agent_browser` 在本地运行 browser automation
- 支持 session 复用、截图/抓取/表单操作

### 接入步骤
1) 新增 `agent_browser` 工具封装（sidecar）
2) 将工具注册到 agent，并在 system prompt 中说明使用方式
3) 提供安装指引（agent-browser + 浏览器依赖）

### 使用方式（示例）
- 打开网页：`["open", "https://example.com"]`
- 点击元素：`["click", "text=Login"]`
- 输入：`["fill", "input[name=email]", "test@example.com"]`
- 截图：`["screenshot", "page.png"]`

## 风险与约束
- 登录/验证码：需要人机协作或手动接管
- 跨平台浏览器依赖：需安装 Playwright/Chromium 相关依赖
- 安全：限制可执行命令，记录工具调用日志

## 验收标准
- 可稳定完成：打开网页 -> 填表 -> 截图 -> 回答
- 工具调用可追踪，失败可复现
- 浏览器 session 可复用
