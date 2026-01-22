---
id: file-import
version: 1.0.0
status: archived
created: 2026-01-22
archived: 2026-01-22
release: v3.9
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/ace/
priority: P2
---

# Feature: Insight File Import - 文件导入功能 (v3.9)

## 概述 (Overview)

扩展洞见导入机制，支持从本地文件（.md, .txt, .json）导入洞见，完善导入渠道的完整性。

### 目标用户

- 使用 mob-seed 的开发者
- 需要从本地笔记导入洞见的用户

### 业务约束

- 作为现有 insight 导入功能的扩展，不改变现有 API
- 支持三种文件格式：Markdown (.md), Text (.txt), JSON (.json)
- 文件大小限制：1MB
- 与现有去重机制兼容

---

## Functional Requirements

### FR-001: 文件导入模式

系统应支持 `--file` 参数从本地文件导入洞见。

**ImportMode 扩展**:

```javascript
const ImportMode = {
  URL: 'url',
  TEXT: 'text',
  FILE: 'file'  // 新增
};
```

**命令格式**:

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

**验收标准**:

- [x] AC-001: insight-importer.js 导出 `importFromFile` 函数
- [x] AC-002: 支持 .md 文件导入
- [x] AC-003: 支持 .txt 文件导入
- [x] AC-004: 支持 .json 文件导入
- [x] AC-005: 文件不存在时返回明确错误
- [x] AC-006: 文件不可读时返回明确错误

### FR-002: 文件内容解析

系统应能够解析不同格式的文件内容。

**解析策略**:

| 文件类型 | 解析方法 | 备注 |
|---------|----------|------|
| `.md` | 提取正文内容，移除 YAML frontmatter | 首行作为标题 |
| `.txt` | 读取全部内容 | 按原文处理 |
| `.json` | 解析 JSON，提取 `content` 或 `text` 字段 | 支持结构化数据 |

**JSON 格式规范**:

```json
{
  "title": "洞见标题（可选）",
  "content": "洞见正文内容（必填）",
  "author": "作者（可选）",
  "affiliation": "机构（可选）",
  "tags": ["tag1", "tag2"],
  "credibility": "high"
}
```

**验收标准**:

- [x] AC-007: .md 文件正确提取正文内容
- [x] AC-008: .md 文件首行作为标题
- [x] AC-009: .txt 文件完整读取内容
- [x] AC-010: .json 文件正确解析 content 字段
- [x] AC-011: JSON 格式错误时给出明确提示

### FR-003: 元数据自动提取

系统应从文件中自动提取元数据。

**提取策略**:

| 字段 | 提取方法 | 备用方案 |
|------|----------|----------|
| title | 文件首行 (# 标题) | 文件名 |
| type | 文件名/内容推断 | documentation |
| date | 文件修改时间 | 今天 |
| tags | 文件名关键词 | 需手动指定 |
| author | 文件内容提取 | 空值 |

**验收标准**:

- [x] AC-012: 优先从文件首行提取标题
- [x] AC-013: 首行无标题时使用文件名
- [x] AC-014: 使用文件修改时间作为日期
- [x] AC-015: 从文件名提取关键词作为标签

### FR-004: 文件验证

系统应在导入前验证文件。

**验证检查**:

| 检查项 | 失败行为 |
|--------|----------|
| 文件存在 | 返回错误："文件不存在: {path}" |
| 文件可读 | 返回错误："文件不可读: {path}" |
| 文件大小 ≤ 1MB | 返回错误："文件过大: {size} MB (限制: 1MB)" |
| 文件类型支持 | 返回错误："不支持的文件类型: {extension}" |

**验收标准**:

- [x] AC-016: 文件不存在时返回明确错误
- [x] AC-017: 文件不可读时返回明确错误
- [x] AC-018: 文件超过 1MB 时返回错误
- [x] AC-019: 不支持的文件类型时返回错误

### FR-005: 与去重机制集成

系统应在文件导入时执行去重检查。

**去重流程**:

1. 从文件内容和标题提取关键词
2. 搜索现有洞见库
3. 发现相似洞见时提示用户

**验收标准**:

- [x] AC-020: 导入前执行去重检查
- [x] AC-021: 相似洞见提示包含相似度百分比
- [x] AC-022: 支持 --force 跳过去重检查

### FR-006: 测试覆盖

系统应提供完整的测试覆盖。

**测试场景**:

- [x] AC-023: 测试成功导入 .md 文件
- [x] AC-024: 测试成功导入 .txt 文件
- [x] AC-025: 测试成功导入 .json 文件
- [x] AC-026: 测试文件不存在错误
- [x] AC-027: 测试文件过大错误
- [x] AC-028: 测试不支持的文件类型错误
- [x] AC-029: 测试 JSON 格式错误
- [x] AC-030: 测试 dry-run 模式
- [x] AC-031: 测试 --force 跳过去重
- [x] AC-032: 测试中文内容

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/insight-importer.js | 添加 importFromFile 函数 |
| 测试 | skills/mob-seed/test/ace/insight-importer.test.js | 添加文件导入测试 |
| 提示 | skills/mob-seed/prompts/insight-import.md | 已添加文件导入流程 |

---

## 相关规格

- 扩展: openspec/archive/v3.6-external-insights/specs/external-insights.fspec.md
- 依赖: insight-importer.js (现有)
- 依赖: insight-dedup.js (现有)
- 依赖: insight-manager.js (现有)

---

## 实现注意事项

1. **保持向后兼容**: 不修改现有的 `importFromUrl` 和 `importFromText` 函数
2. **复用现有逻辑**: 文件导入后使用相同的元数据处理和去重检查流程
3. **错误处理**: 所有错误情况都应返回结构化结果对象
4. **文件大小限制**: 在读取前先检查文件大小，避免加载大文件
