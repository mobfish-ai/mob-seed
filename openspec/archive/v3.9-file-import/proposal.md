# v3.9 File Import - 洞见文件导入

> 状态: archived
> 创建: 2026-01-22
> 归档: 2026-01-22
> 优先级: P2

## 概述

扩展外部洞见导入功能，新增 `--file` 参数支持从本地文件（.md, .txt, .json）导入洞见。

## 背景

### 问题陈述

v3.6 实现了从 URL 和粘贴文本导入洞见的功能，但缺少从本地文件导入的支持：

1. **本地笔记无法直接导入**：用户经常在本地 Markdown 文件中记录技术笔记
2. **导出的洞见无法重新导入**：JSON 格式导出的洞见无法重新导入
3. **导入渠道不完整**：缺少文件导入这一常见场景

### 解决方案

在 `insight-importer.js` 中新增 `importFromFile` 函数，支持：
- 从 `.md` 文件导入（自动提取标题，移除 frontmatter）
- 从 `.txt` 文件导入（使用第一行作为标题）
- 从 `.json` 文件导入（解析结构化数据）

## 目标

- [x] 实现 `importFromFile` 函数
- [x] 添加 `ImportMode.FILE` 常量
- [x] 支持三种文件格式解析
- [x] 文件验证（存在、可读、大小、类型）
- [x] 与现有去重机制集成
- [x] 完整测试覆盖（56 个测试用例全部通过）

## 非目标

- 不修改现有的 `importFromUrl` 和 `importFromText` 函数
- 不添加新的文件类型支持（仅 .md, .txt, .json）

## 设计概要

### 文件解析策略

| 文件类型 | 解析方法 | 标题提取 |
|---------|----------|----------|
| `.md` | 提取正文，移除 YAML frontmatter | 首行 `# 标题` 或文件名 |
| `.txt` | 读取全部内容 | 第一行或文件名 |
| `.json` | 解析 `content` 或 `text` 字段 | `data.title` 或文件名 |

### 验证规则

| 检查项 | 限制 |
|--------|------|
| 文件大小 | ≤ 1MB |
| 支持格式 | .md, .txt, .json |
| JSON 必需字段 | content 或 text |

### 命令格式

```bash
# 从 Markdown 文件导入
/mob-seed:insight --file /path/to/insight.md

# 从 Text 文件导入
/mob-seed:insight --file /path/to/article.txt

# 从 JSON 文件导入
/mob-seed:insight --file /path/to/export.json

# 预览模式
/mob-seed:insight --file /path/to/file.md --dry-run

# 指定额外标签
/mob-seed:insight --file /path/to/file.md --tags "ai,coding"

# 强制覆盖重复检查
/mob-seed:insight --file /path/to/file.md --force
```

## 派生产物

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/insight-importer.js | 添加 importFromFile 函数及辅助函数 |
| 测试 | skills/mob-seed/test/ace/insight-importer.test.js | 添加 30+ 文件导入测试用例 |
| 文档 | skills/mob-seed/prompts/insight-import.md | 已添加文件导入流程文档 |

## 验收标准

- [x] AC-001: insight-importer.js 导出 `importFromFile` 函数
- [x] AC-002: 支持 .md 文件导入（含 frontmatter 处理）
- [x] AC-003: 支持 .txt 文件导入
- [x] AC-004: 支持 .json 文件导入（含 metadata 字段）
- [x] AC-005: 文件不存在时返回明确错误
- [x] AC-006: 文件不可读时返回明确错误
- [x] AC-007: .md 文件正确提取正文内容
- [x] AC-008: .md 文件首行作为标题（仅 # 开头）
- [x] AC-009: .txt 文件完整读取内容
- [x] AC-010: .json 文件正确解析 content 字段
- [x] AC-011: JSON 格式错误时给出明确提示
- [x] AC-012: 优先从文件首行提取标题
- [x] AC-013: 首行无标题时使用文件名
- [x] AC-014: 使用文件修改时间作为日期
- [x] AC-015: 从文件名提取关键词作为标签
- [x] AC-016: 文件不存在时返回明确错误
- [x] AC-017: 文件不可读时返回明确错误
- [x] AC-018: 文件超过 1MB 时返回错误
- [x] AC-019: 不支持的文件类型时返回错误
- [x] AC-020: 导入前执行去重检查
- [x] AC-021: 相似洞见提示包含相似度百分比
- [x] AC-022: 支持 --force 跳过去重检查
- [x] AC-023~AC-032: 全部测试场景通过

## 相关规格

- 扩展: openspec/archive/v3.6-external-insights/specs/external-insights.fspec.md
- 当前: openspec/changes/v3.9-file-import/specs/file-import.fspec.md

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 文件过大导致内存问题 | 限制文件大小 1MB，读取前验证 |
| JSON 解析失败 | 明确错误提示，指导正确格式 |
| 路径解析问题 | 支持绝对和相对路径，给出明确错误 |

## 时间线

- 2026-01-22: 规格创建、代码实现、测试通过
- 2026-01-22: 归档到 openspec/archive/v3.9-file-import/
