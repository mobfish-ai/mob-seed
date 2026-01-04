---
status: archived
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/adapters/
---
# Feature: SEED 工具函数库
## 概述

提供 SEED 命令所需的核心工具函数，包括配置管理、项目扫描、状态检查和同步支持。

## ADDED Requirements

### REQ-001: 配置管理
The system SHALL load and save SEED project configuration.

**Scenario: 加载配置**
- WHEN 调用 loadConfig(projectPath)
- THEN 返回合并了默认配置的完整配置对象

**Scenario: 保存配置**
- WHEN 调用 saveConfig(projectPath, config)
- THEN 创建 .seed/ 目录并写入 config.json

**Acceptance Criteria:**
- [x] AC-001: 深度合并用户配置和默认配置
- [x] AC-002: 自动创建 .seed/ 目录
- [x] AC-003: 添加 updated 时间戳

### REQ-002: 初始化检查
The system SHALL check if SEED structure is initialized.

**Scenario: 检查初始化状态**
- WHEN 调用 isInitialized(projectPath)
- THEN 返回 .seed/config.json 是否存在

**Acceptance Criteria:**
- [x] AC-004: 返回 boolean 值

### REQ-003: 项目结构扫描
The system SHALL intelligently scan project structure.

**Scenario: 智能扫描**
- WHEN 调用 scanProjectStructure(projectPath)
- THEN 返回检测到的 specs, src, test, docs 目录

**Acceptance Criteria:**
- [x] AC-005: 按优先级检测常见目录名
- [x] AC-006: 检测项目类型 (node, typescript, go, python)
- [x] AC-007: 推断代码和测试文件模式

### REQ-004: 项目初始化
The system SHALL initialize SEED project structure.

**Scenario: 初始化项目**
- WHEN 调用 initProject(projectPath, options)
- THEN 创建 .seed/config.json 和 output 目录

**Acceptance Criteria:**
- [x] AC-008: 支持 --force 强制重新初始化
- [x] AC-009: 支持 --manual 跳过自动扫描
- [x] AC-010: 支持 customPaths 自定义路径

### REQ-005: 规格扫描
The system SHALL scan spec files in project.

**Scenario: 扫描规格文件**
- WHEN 调用 scanSpecs(projectPath)
- THEN 返回规格文件列表，包含 name, path, filename

**Acceptance Criteria:**
- [x] AC-011: 匹配 .fspec.md 和 .spec.md 文件
- [x] AC-012: 从文件名提取规格名称

### REQ-006: 规格状态检查
The system SHALL check status of individual spec.

**Scenario: 检查规格状态**
- WHEN 调用 getSpecStatus(specPath, projectPath)
- THEN 返回 manifest, code, test, docs 的存在状态

**Acceptance Criteria:**
- [x] AC-013: 检查 seed-manifest.json 存在性
- [x] AC-014: 根据 manifest 验证派生物存在性
- [x] AC-015: 计算同步状态

### REQ-007: 项目状态检查
The system SHALL check overall project status.

**Scenario: 获取项目状态**
- WHEN 调用 getProjectStatus(projectPath)
- THEN 返回初始化状态、配置、规格列表和汇总统计

**Acceptance Criteria:**
- [x] AC-016: 统计总规格数、已派生数、已同步数
- [x] AC-017: 标记需要关注的规格

### REQ-008: 差异检测
The system SHALL detect differences between spec and code.

**Scenario: 检测差异**
- WHEN 调用 diffSpec(specPath, projectPath)
- THEN 返回 FR 实现状态和 AC 测试覆盖状态

**Acceptance Criteria:**
- [x] AC-018: 提取规格中的 FR 和 AC 列表
- [x] AC-019: 检查代码中的 @see FR-XXX 引用
- [x] AC-020: 检查测试中的 AC-XXX 引用
- [x] AC-021: 计算同步率

### REQ-009: 代码骨架生成
The system SHALL generate code skeleton for FR.

**Scenario: 生成代码骨架**
- WHEN 调用 generateCodeSkeleton(frId, description)
- THEN 返回带有 @see 注释和 TODO 的函数骨架

**Acceptance Criteria:**
- [x] AC-022: 包含 JSDoc 注释
- [x] AC-023: 抛出 Not implemented 错误

### REQ-010: 测试骨架生成
The system SHALL generate test skeleton for AC.

**Scenario: 生成测试骨架**
- WHEN 调用 generateTestSkeleton(acId, title)
- THEN 返回带有 Given/When/Then 结构的测试骨架

**Acceptance Criteria:**
- [x] AC-024: 使用 describe/it 结构
- [x] AC-025: 包含 Given/When/Then 注释

## 导出接口

```javascript
export {
  loadConfig,
  saveConfig,
  isInitialized,
  scanProjectStructure,
  initProject,
  scanSpecs,
  getSpecStatus,
  getProjectStatus,
  diffSpec,
  generateCodeSkeleton,
  generateTestSkeleton,
  DEFAULT_CONFIG,
  SEED_DIR,
  CONFIG_FILE,
  Status,
  DETECT_PATTERNS
};
```
