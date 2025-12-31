# Feature: SEED 命令系统

> 状态: archived
> 版本: 1.0.0
> 技术栈: Markdown
> 派生路径: commands/

## 概述

SEED 方法论的 Claude Code 命令集，提供完整的规格驱动开发工作流。

## ADDED Requirements

### REQ-001: 主入口命令
The system SHALL provide unified entry point for SEED workflow.

**Command: /mob-seed**

**Scenario: 智能路由**
- WHEN 用户调用 `/mob-seed "功能描述"`
- THEN 自动执行完整 S-E-E-D 流程

**Scenario: 阶段选择**
- WHEN 用户调用 `/mob-seed --spec`
- THEN 只执行规格定义阶段

**Acceptance Criteria:**
- [ ] AC-001: 支持 --spec, --emit, --exec, --defend 参数
- [ ] AC-002: 支持 --quick, --full 复杂度选项
- [ ] AC-003: 自动检测项目初始化状态

### REQ-002: 项目初始化命令
The system SHALL provide project initialization command.

**Command: /mob-seed-init**

**Scenario: OpenSpec 初始化**
- WHEN 用户调用 `/mob-seed-init`
- THEN 创建 openspec/ 目录结构和 .seed/config.json

**Scenario: 强制重新初始化**
- WHEN 用户调用 `/mob-seed-init --force`
- THEN 备份现有配置并重新初始化

**Acceptance Criteria:**
- [ ] AC-004: 创建 OpenSpec 标准目录结构 (openspec/specs/, openspec/changes/)
- [ ] AC-005: 生成 .seed/config.json 配置文件
- [ ] AC-006: 支持 --force 强制重新初始化

### REQ-003: 规格定义命令
The system SHALL provide spec creation and management command.

**Command: /mob-seed-spec**

**Scenario: 创建变更提案**
- WHEN 用户调用 `/mob-seed-spec --proposal "feature-name"`
- THEN 创建 openspec/changes/feature-name/ 目录结构

**Scenario: 提交审查**
- WHEN 用户调用 `/mob-seed-spec --submit "feature-name"`
- THEN 将提案状态更新为 review

**Acceptance Criteria:**
- [ ] AC-007: 使用 templates/ 中的模板
- [ ] AC-008: 支持 --proposal 创建变更提案
- [ ] AC-009: 支持 --submit 提交审查

### REQ-004: 派生命令
The system SHALL provide code/test/docs derivation command.

**Command: /mob-seed-emit**

**Scenario: 派生代码**
- WHEN 用户调用 `/mob-seed-emit "feature-name"`
- THEN 从规格生成代码骨架、测试骨架和文档

**Acceptance Criteria:**
- [ ] AC-010: 生成代码到 src/ 目录
- [ ] AC-011: 生成测试到 test/ 目录
- [ ] AC-012: 生成文档到 docs/ 目录
- [ ] AC-013: 创建 seed-manifest.json 映射文件

### REQ-005: 执行命令
The system SHALL provide test execution command.

**Command: /mob-seed-exec**

**Scenario: 运行测试**
- WHEN 用户调用 `/mob-seed-exec "feature-name"`
- THEN 执行派生的测试用例

**Acceptance Criteria:**
- [ ] AC-014: 检测测试框架类型
- [ ] AC-015: 运行对应的测试命令
- [ ] AC-016: 输出测试结果摘要

### REQ-006: 守护命令
The system SHALL provide compliance checking command.

**Command: /mob-seed-defend**

**Scenario: 合规检查**
- WHEN 用户调用 `/mob-seed-defend "feature-name"`
- THEN 检查派生物是否被手动修改

**Acceptance Criteria:**
- [ ] AC-017: 检查代码 hash 与 manifest 记录
- [ ] AC-018: 报告漂移的文件
- [ ] AC-019: 提供修复建议

### REQ-007: 状态查看命令
The system SHALL provide status overview command.

**Command: /mob-seed-status**

**Scenario: 查看状态**
- WHEN 用户调用 `/mob-seed-status`
- THEN 显示所有规格的派生状态和同步状态

**Acceptance Criteria:**
- [ ] AC-020: 显示 OpenSpec 生命周期状态
- [ ] AC-021: 支持 --verbose 详细模式
- [ ] AC-022: 支持 --json 输出格式

### REQ-008: 差异对比命令
The system SHALL provide diff command for spec vs code.

**Command: /mob-seed-diff**

**Scenario: 查看差异**
- WHEN 用户调用 `/mob-seed-diff "feature-name"`
- THEN 显示规格与代码的差异

**Acceptance Criteria:**
- [ ] AC-023: 列出未实现的 FR
- [ ] AC-024: 列出未测试的 AC
- [ ] AC-025: 计算同步率

### REQ-009: 同步命令
The system SHALL provide sync command for spec-code alignment.

**Command: /mob-seed-sync**

**Scenario: 正向同步**
- WHEN 用户调用 `/mob-seed-sync --direction=spec`
- THEN 根据规格生成缺失的代码/测试骨架

**Scenario: 逆向同步**
- WHEN 检测到有代码但无规格
- THEN 从代码生成初始规格文件

**Acceptance Criteria:**
- [ ] AC-026: 支持 spec→code 和 code→spec 方向
- [ ] AC-027: 支持 --dry-run 预览模式
- [ ] AC-028: 支持逆向同步（代码生成规格）

### REQ-010: 归档命令
The system SHALL provide archive command for completed proposals.

**Command: /mob-seed-archive**

**Scenario: 归档提案**
- WHEN 用户调用 `/mob-seed-archive "feature-name"`
- THEN 将 Delta 规格合并到 specs/，提案移动到 archive/

**Acceptance Criteria:**
- [ ] AC-029: 检查前置条件（测试通过、代码完成）
- [ ] AC-030: 合并 Delta 规格到真相源
- [ ] AC-031: 移动提案目录到 archive/

### REQ-011: 编辑触发命令
The system SHALL provide edit trigger command.

**Command: /mob-seed-edit**

**Scenario: 编辑并同步**
- WHEN 用户调用 `/mob-seed-edit "feature-name"`
- THEN 打开规格文件并在保存后触发同步

**Acceptance Criteria:**
- [ ] AC-032: 触发规格编辑
- [ ] AC-033: 编辑后自动派生

## 命令架构

```
/mob-seed                 # 主入口（智能路由）
├── /mob-seed-init        # 项目初始化
├── /mob-seed-spec        # S: 规格定义
├── /mob-seed-emit        # E: 自动派生
├── /mob-seed-exec        # E: 自动执行
├── /mob-seed-defend      # D: 守护规范
├── /mob-seed-status      # 状态查看
├── /mob-seed-diff        # 差异对比
├── /mob-seed-sync        # 强制同步
├── /mob-seed-archive     # 归档提案
└── /mob-seed-edit        # 编辑触发
```
