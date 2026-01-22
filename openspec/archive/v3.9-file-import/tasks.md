# v3.9 File Import - 任务清单

> 状态: implementing
> 创建: 2026-01-22

## 进度概览

```
████████████████████████████████████████████████████ 100%
```

**已完成**: 4/4 任务

---

## 任务列表

### ✅ 任务 1: 创建规格文件

- [x] 创建 `openspec/changes/v3.9-file-import/specs/file-import.fspec.md`
- [x] 定义功能需求 FR-001 ~ FR-006
- [x] 定义验收标准 AC-001 ~ AC-032

**完成时间**: 2026-01-22

---

### ✅ 任务 2: 实现代码

- [x] 添加 `ImportMode.FILE` 常量
- [x] 实现 `importFromFile` 主函数
- [x] 实现 `validateFile` 文件验证函数
- [x] 实现 `parseFile` 文件解析函数
- [x] 实现 `extractMetadataFromFile` 元数据提取函数
- [x] 导出 `importFromFile` 函数
- [x] 智能标题提取优化（支持中文内容、移除通用前缀）
- [x] 代码去重（移除重复的 `extractSmartTitle` 和 `truncateTitle` 函数）

**文件修改**:
- `skills/mob-seed/lib/ace/insight-importer.js`
- `skills/mob-seed/lib/ace/insight-extractor.js`

**完成时间**: 2026-01-22

---

### ✅ 任务 3: 添加测试

- [x] Markdown 文件导入测试（4 个用例）
- [x] Text 文件导入测试（2 个用例）
- [x] JSON 文件导入测试（4 个用例）
- [x] 文件验证测试（4 个用例）
- [x] 元数据提取测试（2 个用例）
- [x] 选项和标志测试（3 个用例）
- [x] 去重检测测试（2 个用例）
- [x] 中文内容支持测试（2 个用例）
- [x] 洞见文件创建测试（1 个用例）

**测试文件**: `skills/mob-seed/test/ace/insight-importer.test.js`

**测试结果**: 1839 pass / 0 fail (全部测试套件)

**完成时间**: 2026-01-22

---

### ✅ 任务 4: 文档更新

- [x] 更新 `prompts/insight-import.md` 添加文件导入流程
- [x] 创建 `proposal.md`
- [x] 创建 `tasks.md`

**完成时间**: 2026-01-22

---

## 验收标准状态

### FR-001: 文件导入模式

- [x] AC-001: 导出 `importFromFile` 函数
- [x] AC-002: 支持 .md 文件导入
- [x] AC-003: 支持 .txt 文件导入
- [x] AC-004: 支持 .json 文件导入
- [x] AC-005: 文件不存在错误处理
- [x] AC-006: 文件不可读错误处理

### FR-002: 文件内容解析

- [x] AC-007: .md 文件正确提取正文内容
- [x] AC-008: .md 文件首行作为标题
- [x] AC-009: .txt 文件完整读取内容
- [x] AC-010: .json 文件正确解析 content 字段
- [x] AC-011: JSON 格式错误提示

### FR-003: 元数据自动提取

- [x] AC-012: 优先从文件首行提取标题
- [x] AC-013: 首行无标题时使用文件名
- [x] AC-014: 使用文件修改时间作为日期
- [x] AC-015: 从文件名提取关键词作为标签

### FR-004: 文件验证

- [x] AC-016: 文件不存在错误处理
- [x] AC-017: 文件不可读错误处理
- [x] AC-018: 文件超过 1MB 错误处理
- [x] AC-019: 不支持的文件类型错误处理

### FR-005: 与去重机制集成

- [x] AC-020: 导入前去重检查
- [x] AC-021: 相似洞见提示
- [x] AC-022: --force 跳过去重检查

### FR-006: 测试覆盖

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

## 下一步

- [x] 运行全部测试套件确认无回归（1839 pass / 0 fail）
- [ ] 更新版本号到 v3.9
- [ ] 归档提案到 `openspec/archive/v3.9-file-import/`

## 技术改进

### 智能标题提取优化

为解决文件名和首行不可靠的问题，实现了智能标题提取：

1. **三策略提取**:
   - Strategy 1: 查找显式标题标记（`标题:`, `Title:`, Markdown 标题等）
   - Strategy 2: 查找有意义的句子（跳过"笔记"、"思考"等通用前缀）
   - Strategy 3: 回退到首行（移除 Markdown 标记）

2. **前缀移除**: 自动移除 "关于"、"学习"、"记录" 等通用前缀

3. **智能截断**: 60 字符限制，在单词边界截断

### 代码去重

- 移除 `insight-importer.js` 中重复的 `extractSmartTitle` 和 `truncateTitle` 函数
- 统一使用 `insight-extractor.js` 导出的函数
- 修改长度阈值从 >= 10 改为 >= 5，支持更短的标题
