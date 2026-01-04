---
status: archived
version: 2.0.0
tech_stack: Markdown
derived_path: commands/
---
# Feature: SEED 命令系统
## 概述

SEED 方法论的 Claude Code 命令集，提供完整的规格驱动开发工作流。

## MODIFIED Requirements

### REQ-001: 智能入口命令
The system SHALL provide unified entry point for SEED workflow with status panel.

**Command: /mob-seed:seed**

**Scenario: 智能状态面板**
- WHEN 用户调用 `/mob-seed:seed`
- THEN 显示项目状态面板 + 建议行动

**Scenario: 快速检查**
- WHEN 用户调用 `/mob-seed:seed --quick`
- THEN 只执行快速同步检查

**Acceptance Criteria:**
- [x] AC-001: 显示规格库状态（真相源 + 变更提案）
- [x] AC-002: 显示同步状态（代码覆盖、测试覆盖、文档同步）
- [x] AC-003: 显示漂移检测结果
- [x] AC-004: 提供智能建议行动

### REQ-002: 项目初始化命令
The system SHALL provide project initialization command.

**Command: /mob-seed:init**

**Scenario: OpenSpec 初始化**
- WHEN 用户调用 `/mob-seed:init`
- THEN 创建 openspec/ 目录结构和 .seed/config.json

**Scenario: 强制重新初始化**
- WHEN 用户调用 `/mob-seed:init --force`
- THEN 备份现有配置并重新初始化

**Acceptance Criteria:**
- [x] AC-005: 创建 OpenSpec 标准目录结构 (openspec/specs/, openspec/changes/)
- [x] AC-006: 生成 .seed/config.json 配置文件
- [x] AC-007: 创建 mission.md 模板
- [x] AC-008: 支持 --force 强制重新初始化

### REQ-003: 规格定义命令
The system SHALL provide spec creation and management command.

**Command: /mob-seed:spec**

**Scenario: 创建变更提案**
- WHEN 用户调用 `/mob-seed:spec --proposal "feature-name"`
- THEN 创建 openspec/changes/feature-name/ 目录结构

**Scenario: 提交审查**
- WHEN 用户调用 `/mob-seed:spec --submit "feature-name"`
- THEN 将提案状态更新为 review

**Scenario: 编辑规格**
- WHEN 用户调用 `/mob-seed:spec --edit "feature-name"`
- THEN 打开规格文件进行编辑

**Acceptance Criteria:**
- [x] AC-009: 使用 templates/ 中的模板
- [x] AC-010: 支持 --proposal 创建变更提案
- [x] AC-011: 支持 --submit 提交审查
- [x] AC-012: 支持 --edit 编辑规格

### REQ-004: 派生命令
The system SHALL provide code/test/docs derivation command.

**Command: /mob-seed:emit**

**Scenario: 派生代码**
- WHEN 用户调用 `/mob-seed:emit "feature-name"`
- THEN 从规格生成代码骨架、测试骨架和文档

**Acceptance Criteria:**
- [x] AC-013: 生成代码到 src/ 目录
- [x] AC-014: 生成测试到 test/ 目录
- [x] AC-015: 生成文档到 docs/ 目录
- [x] AC-016: 创建 seed-manifest.json 映射文件

### REQ-005: 执行命令
The system SHALL provide test execution command.

**Command: /mob-seed:exec**

**Scenario: 运行测试**
- WHEN 用户调用 `/mob-seed:exec "feature-name"`
- THEN 执行派生的测试用例

**Acceptance Criteria:**
- [x] AC-017: 检测测试框架类型
- [x] AC-018: 运行对应的测试命令
- [x] AC-019: 输出测试结果摘要

### REQ-006: 守护命令
The system SHALL provide compliance checking and sync verification command.

**Command: /mob-seed:defend**

**Scenario: 合规检查**
- WHEN 用户调用 `/mob-seed:defend "feature-name"`
- THEN 检查派生物是否被手动修改

**Scenario: 差异检测**
- WHEN 用户调用 `/mob-seed:defend --diff "feature-name"`
- THEN 显示规格与代码的差异

**Scenario: 同步检查**
- WHEN 用户调用 `/mob-seed:defend --sync`
- THEN 检查规格与代码的同步状态

**Acceptance Criteria:**
- [x] AC-020: 检查代码 hash 与 manifest 记录
- [x] AC-021: 报告漂移的文件
- [x] AC-022: 提供修复建议
- [x] AC-023: 支持 --diff 差异检测
- [x] AC-024: 支持 --sync 同步检查
- [x] AC-025: 支持原则验证（Mission 对齐分数）

### REQ-007: 归档命令
The system SHALL provide archive command for completed proposals.

**Command: /mob-seed:archive**

**Scenario: 归档提案**
- WHEN 用户调用 `/mob-seed:archive "feature-name"`
- THEN 将 Delta 规格合并到 specs/，提案移动到 archive/

**Acceptance Criteria:**
- [x] AC-026: 检查前置条件（测试通过、代码完成）
- [x] AC-027: 合并 Delta 规格到真相源
- [x] AC-028: 移动提案目录到 archive/
- [x] AC-029: 基于测试结果更新 AC 完成状态

## REMOVED Requirements

### REQ-008: 状态查看命令 (DEPRECATED)
> 功能已融入 `/mob-seed:seed` 智能入口

### REQ-009: 差异对比命令 (DEPRECATED)
> 功能已融入 `/mob-seed:defend --diff`

### REQ-010: 同步命令 (DEPRECATED)
> 功能已融入 `/mob-seed:defend --sync`

### REQ-011: 编辑触发命令 (DEPRECATED)
> 功能已融入 `/mob-seed:spec --edit`

## 命令架构

```
/mob-seed:seed            # 智能入口（状态面板 + 建议行动）
├── /mob-seed:init        # 项目初始化
├── /mob-seed:spec        # S: 规格定义（含 --edit）
├── /mob-seed:emit        # E: 自动派生
├── /mob-seed:exec        # E: 自动执行
├── /mob-seed:defend      # D: 守护规范（含 --diff, --sync）
└── /mob-seed:archive     # 归档提案
```

## 变更说明

### v2.0.0 (2025-01-01)

**命名规范变更**:
- 命令格式从 `/mob-seed-*` 改为 `/mob-seed:*`（符合 Claude Code Plugin 最佳实践）

**命令精简**:
- 移除独立的 status/diff/sync/edit 命令
- 功能融入相关核心命令

**新增功能**:
- 智能状态面板（/mob-seed:seed）
- Mission 原则验证
