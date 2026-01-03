# ACE Skill 核心层集成规格

> 版本: 1.0.0
> 状态: archived
> 归档日期: 2026-01-03
> 创建时间: 2026-01-03
> 最后更新: 2026-01-03
> 模板: feature
> 层级: L1 (最强强制)

---

## 概述 (Overview)

### 功能描述
将 ACE 定义为 mob-seed 的核心行为，写入 SKILL.md，确保 Claude 加载技能时自动激活 ACE。

### 目标用户
所有使用 mob-seed 的开发者和项目

### 核心价值
- Claude 加载 SKILL.md 时自动了解 ACE 行为约定
- 无需依赖 Claude 主动读取 ace.md
- ACE 成为不可违反的核心行为

### 使用场景
- 场景1: 用户在新项目中运行 `/mob-seed:init`，ACE 自动激活
- 场景2: 用户运行任何 mob-seed 命令，ACE 行为自动生效

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [x] FR-001: SKILL.md 包含 ACE 核心原则定义（SEED + A）
- [x] FR-002: SKILL.md 定义 ACE 三阶段循环（Observe → Reflect → Curate）
- [x] FR-003: SKILL.md 定义 ACE 触发条件和必须执行的行为
- [x] FR-004: SKILL.md 定义 ACE 存储结构（.seed/observations, reflections, learning）

### 非功能需求 (Non-Functional Requirements)

- [x] NFR-001: 可读性 - ACE 定义简洁明了，Claude 能快速理解
- [x] NFR-002: 强制性 - 使用"必须"、"不可违反"等强制性语言
- [x] NFR-003: 兼容性 - 不破坏现有 SEED 四原则

---

## 约束 (Constraints)

### 技术约束
- 文件: skills/mob-seed/SKILL.md
- 格式: Markdown
- 位置: 在 SEED 四原则之后添加 ACE 定义

### 业务约束
- 必须保持 SEED 口诀的简洁性
- ACE 定义不能过长，影响 SKILL.md 可读性

---

## 验收标准 (Acceptance Criteria)

### AC-001: SKILL.md 包含 ACE 原则
- **Given**: SKILL.md 已存在
- **When**: 读取 SKILL.md
- **Then**:
  - 包含 "ACE" 或 "自演化" 关键词
  - 定义 Observe → Reflect → Curate 循环
  - 包含触发条件表格

### AC-002: ACE 行为约定为强制性
- **Given**: SKILL.md 包含 ACE 定义
- **When**: 读取 ACE 行为约定部分
- **Then**:
  - 使用"必须"而非"应该"
  - 明确列出触发条件和必须执行的行为

### AC-003: SEED 口诀扩展
- **Given**: SKILL.md 包含 SEED 口诀
- **When**: 读取口诀
- **Then**:
  - 口诀扩展为包含 ACE
  - 格式: "Single 定单源，Emit 自派生，Execute 自动跑，Defend 守规范，ACE 自演化"

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 命令 | skills/mob-seed/SKILL.md | 添加 ACE 核心行为定义 |

---

## 依赖 (Dependencies)

### 前置规格
- 无（L1 是基础层）

### 外部依赖
- 无

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-01-03 | 初始版本 | Claude + User |
