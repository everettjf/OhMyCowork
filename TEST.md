# OhMyCowork 功能测试清单（逐项手测版）

这份文档按“能力 → 测试指令 → 预期结果”组织，你可以直接按顺序逐个在聊天框里测试。

> 说明：sidecar 已迁移为 TypeScript；自动化单测为 `111` 个，手测用于验证端到端体验。

## 0. 先做自动化检查

```bash
cd sidecar
npm install --legacy-peer-deps
npm run build
npm test
```

通过标准：
- `npm run build` 成功
- `npm test` 显示 `111 passed`

---

## 1. 手测前准备

1. 启动应用：`bun run tauri dev`
2. 选择一个干净工作区目录（建议新建）
3. 准备测试文件：
   - `/notes.txt`
   - `/data.csv`
   - `/test.jpg`
   - `/test.pdf`
   - `/test.mp4`（可选，视频能力用）
4. 如需浏览器自动化：先安装浏览器依赖（项目说明里的 browser install 命令）

---

## 2. 核心能力（Core Utilities）

### 2.1 get_time
- [ ] 指令：`现在时间是多少？请返回 ISO、本地时间、epoch 毫秒。`
- [ ] 预期：返回 `iso` / `locale` / `epochMs`

### 2.2 get_timezone
- [ ] 指令：`获取我的系统时区信息。`
- [ ] 预期：返回时区名称与偏移信息

### 2.3 random_number
- [ ] 指令：`生成 1 到 100 的随机整数。`
- [ ] 预期：返回区间内整数

### 2.4 generate_uuid
- [ ] 指令：`生成一个 UUID v4。`
- [ ] 预期：返回合法 UUID

### 2.5 calculate_expression
- [ ] 指令：`计算 (123 + 456) * 2 / 3。`
- [ ] 预期：结果 `386`

### 2.6 run_node
- [ ] 指令：`用 Node.js 生成斐波那契前 10 项并返回数组。`
- [ ] 预期：返回 `[0,1,1,2,3,5,8,13,21,34]`

### 2.7 agent_browser
- [ ] 指令：`用浏览器打开 https://example.com 并截图为 /example.png。`
- [ ] 预期：成功执行打开+截图，文件写入工作区

---

## 3. 文件管理（File Management）

### 3.1 file_search
- [ ] 指令：`搜索工作区所有 .txt 文件。`
- [ ] 预期：返回匹配文件和元数据

### 3.2 file_rename
- [ ] 指令：`把所有 .txt 文件加前缀 backup_，先 dry run 预览。`
- [ ] 预期：仅预览，不改文件；返回 wouldRenameTo

### 3.3 find_duplicates
- [ ] 指令：`查找工作区重复文件，只报告不删除。`
- [ ] 预期：按 hash 分组返回重复项

### 3.4 create_folders
- [ ] 指令：`创建文件夹结构：project/src, project/tests, project/docs。`
- [ ] 预期：目录创建成功

### 3.5 file_copy_move
- [ ] 指令：`复制 /notes.txt 到 /backup/notes.txt。`
- [ ] 预期：目标文件存在且内容一致

### 3.6 file_delete
- [ ] 指令：`删除 /backup，先 dry run。`
- [ ] 预期：返回将删除内容，不实际删除

### 3.7 organize_folder
- [ ] 指令：`整理工作区根目录，按类型归类文件。`
- [ ] 预期：文件移动到 Documents/Images/Code 等目录

---

## 4. Office 文档能力

### 4.1 excel_operations
- [ ] 指令：`创建 /sales.xlsx，列为 产品/数量/单价，写入 3 行数据。`
- [ ] 预期：文件创建成功
- [ ] 指令：`读取 /sales.xlsx 内容并总结。`
- [ ] 预期：返回表名、行列信息与预览

### 4.2 word_operations
- [ ] 指令：`创建 /report.docx，标题“月度报告”，含段落和项目符号列表。`
- [ ] 预期：docx 正常生成
- [ ] 指令：`把 /report.docx 转成 HTML。`
- [ ] 预期：产出 html 文件或返回 html 内容

### 4.3 powerpoint_operations
- [ ] 指令：`创建 /presentation.pptx，主题“AI 入门”，包含标题页和内容页。`
- [ ] 预期：pptx 生成成功
- [ ] 指令：`再追加一页柱状图（销售数据）。`
- [ ] 预期：新幻灯片写入成功

---

## 5. PDF 能力（pdf_operations）

- [ ] 指令：`创建 /hello.pdf，标题 Hello World，附一段正文。`
- [ ] 预期：PDF 成功生成
- [ ] 指令：`读取 /test.pdf 的元信息与页数。`
- [ ] 预期：返回 metadata
- [ ] 指令：`提取 /test.pdf 文本。`
- [ ] 预期：返回文本内容
- [ ] 指令：`合并 /hello.pdf 和 /test.pdf 到 /combined.pdf。`
- [ ] 预期：合并成功
- [ ] 指令：`给 /test.pdf 加水印“机密文件”。`
- [ ] 预期：输出带水印 PDF

---

## 6. 媒体能力

### 6.1 image_operations
- [ ] 指令：`获取 /test.jpg 信息。`
- [ ] 预期：返回尺寸、格式、大小
- [ ] 指令：`把 /test.jpg 缩放到宽 800 并导出。`
- [ ] 预期：输出图存在，尺寸变化正确

### 6.2 video_operations（需 ffmpeg）
- [ ] 指令：`获取 /test.mp4 的时长、分辨率、编码信息。`
- [ ] 预期：返回视频元数据
- [ ] 指令：`截取 /test.mp4 前 10 秒导出 /clip.mp4。`
- [ ] 预期：成功输出短视频

---

## 7. 数据分析（data_analysis）

- [ ] 指令：`读取 /data.csv 并返回前几行。`
- [ ] 预期：返回列名、行数和预览
- [ ] 指令：`统计 salary 列的均值/中位数/标准差。`
- [ ] 预期：返回统计结果
- [ ] 指令：`按 city 分组，计算 salary 平均值。`
- [ ] 预期：返回 group by 结果

---

## 8. 压缩归档（archive_operations）

- [ ] 指令：`把 /project 文件夹压缩为 /project.zip。`
- [ ] 预期：zip 生成成功
- [ ] 指令：`解压 /project.zip 到 /extracted。`
- [ ] 预期：文件正确解压
- [ ] 指令：`列出 /project.zip 内容。`
- [ ] 预期：返回归档内文件列表

---

## 9. 网络能力（web_operations）

- [ ] 指令：`请求 https://httpbin.org/get 并返回状态码和响应摘要。`
- [ ] 预期：HTTP 请求成功
- [ ] 指令：`抓取 https://example.com 的标题与所有链接。`
- [ ] 预期：返回标题+链接列表
- [ ] 指令：`解析 RSS：https://feeds.bbci.co.uk/news/rss.xml。`
- [ ] 预期：返回 RSS 条目

---

## 10. 格式转换（format_conversion）

- [ ] 指令：`把 JSON [{"a":1,"b":2},{"a":3,"b":4}] 转成 CSV。`
- [ ] 预期：返回 CSV
- [ ] 指令：`把 CSV 转成 JSON。`
- [ ] 预期：返回 JSON 数组
- [ ] 指令：`把 Markdown “# Hello\n\nWorld” 转 HTML。`
- [ ] 预期：返回 HTML
- [ ] 指令：`把 “Hello World” 编码成 Base64，再解码回来。`
- [ ] 预期：编码与解码都正确

---

## 11. 子代理（Subagent）

### folder-organizer
- [ ] 指令：`请调用 folder-organizer 子代理，整理 /Downloads。`
- [ ] 预期：触发子代理并输出整理摘要（移动数量/错误）

---

## 12. 测试记录模板（你逐项勾选时可直接填）

| 模块 | 用例数 | 通过 | 失败 | 备注 |
|---|---:|---:|---:|---|
| 核心能力 | 7 |  |  |  |
| 文件管理 | 7 |  |  |  |
| Office | 6 |  |  |  |
| PDF | 5 |  |  |  |
| 媒体 | 4 |  |  |  |
| 数据分析 | 3 |  |  |  |
| 压缩归档 | 3 |  |  |  |
| 网络能力 | 3 |  |  |  |
| 格式转换 | 4 |  |  |  |
| 子代理 | 1 |  |  |  |
| **总计** | **43** |  |  |  |

---

## 13. 常见问题

- `build` 失败：先执行 `npm install --legacy-peer-deps` 后再 `npm run build`
- 图片能力失败：执行 `npm rebuild sharp`
- 视频能力失败：本机安装 ffmpeg（macOS: `brew install ffmpeg`）
- 路径报错：所有路径使用工作区相对路径（如 `/data.csv`）
