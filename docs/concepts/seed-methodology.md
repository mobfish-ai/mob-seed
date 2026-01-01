# SEED 方法论

> 规格驱动的自动化开发方法

## 核心理念

SEED 是一种规格驱动的开发方法论，通过自动化派生确保规格、代码、文档的一致性。

```
S - Spec     规格是单一真相源
E - Emit     自动派生所有产物
E - Execute  测试验证正确性
D - Defend   守护同步状态
```

## 为什么需要 SEED

### 传统开发的问题

1. **文档过时**: 代码改了，文档忘了更新
2. **规格与实现不一致**: 设计说一套，代码做一套
3. **重复劳动**: 写代码、写测试、写文档，三遍
4. **难以维护**: 改一处需要改多处

### SEED 的解决方案

1. **单一真相源**: 规格文件是唯一权威
2. **自动派生**: 代码、测试、文档自动生成
3. **持续守护**: 自动检测不同步
4. **强制一致**: 不同步就不能提交

## 四个阶段

### S - Spec (规格)

规格文件 (`.fspec.md`) 定义：
- 功能需求 (Requirements)
- 行为场景 (Scenarios)
- 验收标准 (Acceptance Criteria)

```markdown
# Feature: 用户登录

### REQ-001: 密码验证

**Scenario: 登录成功**
- WHEN 用户输入正确密码
- THEN 返回认证令牌

**Acceptance Criteria:**
- [ ] AC-001: 验证密码正确性
```

### E - Emit (派生)

从规格自动生成：

| 产物 | 来源 | 说明 |
|------|------|------|
| 源代码 | Spec → Code | 函数骨架、接口定义 |
| 测试代码 | Spec → Test | 基于 Scenario 生成 |
| API 文档 | Code → Docs | 从代码提取 |
| 用户指南 | Spec + Code | 综合生成 |
| CHANGELOG | Git + Spec | 发布时生成 |

### E - Execute (执行)

运行测试验证：
- 单元测试
- 集成测试
- 验收测试

测试结果反馈到规格：
- `[ ]` → `[x]` 标记 AC 通过

### D - Defend (守护)

持续检查同步状态：
- 规格变更 → 代码需要更新
- 代码变更 → 可能违反规格
- 文档过时 → 需要重新生成

## 派生链

```
Spec (规格)
    ↓
Code (代码) ← 真相源
    ↓
Docs (文档)
```

**关键原则**：
- API 文档从代码派生（反映实际实现）
- 概念文档从规格派生（反映设计意图）
- CHANGELOG 从 Git 历史派生（反映变更记录）

## OpenSpec 生命周期

```
draft → review → implementing → archived
```

| 状态 | 目录 | 说明 |
|------|------|------|
| draft | `changes/` | 草稿，可自由修改 |
| review | `changes/` | 评审中 |
| implementing | `changes/` | 实现中 |
| archived | `archive/` | 已完成，进入历史 |

稳定规格存放在 `specs/` 目录。

## Delta 语法

规格变更使用 Delta 语法：

```markdown
## ADDED Requirements
### REQ-003: 新功能

## MODIFIED Requirements
### REQ-001: 修改的功能

## REMOVED Requirements
### REQ-002: 删除的功能
```

归档时，Delta 合并到稳定规格。

## 最佳实践

1. **先规格后代码**: 永远先写规格
2. **小步迭代**: 一个提案一个功能
3. **持续守护**: 每次提交都检查
4. **及时归档**: 完成后立即归档

## 相关文档

- [快速开始](../guide/getting-started.md)
- [规格编写指南](../guide/writing-specs.md)
