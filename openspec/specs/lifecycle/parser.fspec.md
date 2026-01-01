# Feature: OpenSpec 规格解析器

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/lifecycle/

## 概述

OpenSpec 规格文件解析器，支持元数据提取、Delta 语法解析和规格状态管理。

## ADDED Requirements

### REQ-001: 元数据解析
The system SHALL parse spec file metadata from blockquote format.

**Scenario: 解析规格元数据**
- WHEN 读取包含 `> 状态: draft` 格式的规格文件
- THEN 返回包含 state, version, stack, emitPath 的元数据对象

**Acceptance Criteria:**
- [x] AC-001: 支持中英文字段名 (状态/state, 版本/version)
- [x] AC-002: 提取技术栈声明 (技术栈/stack)
- [x] AC-003: 提取派生路径 (派生路径/emitPath/output)

### REQ-002: 标题解析
The system SHALL extract spec title from markdown heading.

**Scenario: 解析规格标题**
- WHEN 读取包含 `# Feature: 功能名称` 的规格文件
- THEN 返回去除 `Feature:` 前缀的标题字符串

**Acceptance Criteria:**
- [x] AC-004: 支持带 `Feature:` 前缀的标题
- [x] AC-005: 支持无前缀的普通标题

### REQ-003: Delta 需求解析
The system SHALL parse Delta requirements from ADDED/MODIFIED/REMOVED sections.

**Scenario: 解析 ADDED 需求**
- WHEN 读取包含 `## ADDED Requirements` 的规格文件
- THEN 返回 requirements 数组，每项包含 id, title, description, scenarios, acceptance

**Acceptance Criteria:**
- [x] AC-006: 解析 REQ-XXX 格式的需求 ID
- [x] AC-007: 解析 Scenario 块的 WHEN/THEN 条件
- [x] AC-008: 解析 Acceptance Criteria 列表

### REQ-004: 规格状态更新
The system SHALL update spec file state metadata in-place.

**Scenario: 更新规格状态**
- WHEN 调用 updateSpecState(filePath, 'implementing')
- THEN 规格文件中的状态行更新为新状态

**Acceptance Criteria:**
- [x] AC-009: 替换已存在的状态行
- [x] AC-010: 如无状态行则在标题后添加

### REQ-005: 规格文件扫描
The system SHALL recursively scan directories for spec files.

**Scenario: 扫描规格目录**
- WHEN 调用 scanSpecFiles(dir)
- THEN 返回所有 .fspec.md 和 .spec.md 文件的相对路径

**Acceptance Criteria:**
- [x] AC-011: 递归扫描子目录
- [x] AC-012: 返回相对于基础目录的路径

### REQ-006: 变更提案扫描
The system SHALL scan change proposals directory structure.

**Scenario: 扫描变更提案**
- WHEN 调用 scanChangeProposals(changesDir)
- THEN 返回提案列表，包含 name, path, state, specs, hasProposalMd, hasTasksMd

**Acceptance Criteria:**
- [x] AC-013: 检测 proposal.md 存在性
- [x] AC-014: 检测 tasks.md 存在性
- [x] AC-015: 扫描 specs/ 子目录中的规格文件

### REQ-007: 状态概览生成
The system SHALL generate overview of all specs and proposals.

**Scenario: 获取状态概览**
- WHEN 调用 getStatusOverview(openspecRoot)
- THEN 返回 archived, draft, review, implementing 分组的规格列表

**Acceptance Criteria:**
- [x] AC-016: 统计已归档规格数量
- [x] AC-017: 按状态分组变更提案

## 导出接口

```javascript
module.exports = {
  parseMetadata,
  parseTitle,
  parseDeltaRequirements,
  parseSpecFile,
  updateSpecState,
  scanChangeProposals,
  scanSpecFiles,
  getStatusOverview
};
```
