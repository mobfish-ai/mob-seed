# AI Agent 工作流指令

> 本文件定义 AI 工具在本项目中的工作流程和规范。
> 文件位置: `openspec/AGENTS.md`

---

## SEED 方法论

本项目使用 **SEED (Spec → Emit → Execute → Defend)** 方法论进行开发，与 OpenSpec 规范完全兼容。

### 核心原则

| 原则 | 说明 |
|------|------|
| **Spec-First** | 先写规格，再写代码 |
| **Single-Source** | 规格是唯一真相源 |
| **Auto-Derive** | 代码/测试从规格自动派生 |
| **Guard-Sync** | 守护规格与代码的同步 |

---

## OpenSpec 生命周期

```
Draft → Review → Implement → Archive
  ↓        ↓         ↓          ↓
changes/ 人类审查  代码实现   specs/
```

### 状态说明

| 状态 | 目录 | 说明 |
|------|------|------|
| `draft` | changes/ | 规格编写中 |
| `review` | changes/ | 等待人类审查 |
| `implementing` | changes/ | 代码实现中 |
| `archived` | specs/ | 已完成并归档 |

---

## 工作流程

### 1. 创建变更提案

```bash
/mob-seed:spec --proposal "feature-name"
```

创建 `openspec/changes/feature-name/` 目录，包含：
- `proposal.md` - 提案说明
- `tasks.md` - 任务清单
- `specs/` - Delta 规格文件

### 2. 编写规格

在 `changes/[feature]/specs/[domain]/` 中编写 fspec 格式规格：

```markdown
# Feature: 功能名称

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/

## ADDED Requirements

### REQ-001: 需求标题
The system SHALL [行为描述].

**Scenario: 场景名称**
- WHEN [前置条件]
- THEN [期望结果]

**Acceptance Criteria:**
- [ ] AC-001: 验收条件
```

### 3. 提交审查

```bash
/mob-seed:spec --submit "feature-name"
```

状态变更: `draft` → `review`

### 4. 派生代码

```bash
/mob-seed:emit "feature-name"
```

根据规格自动生成：
- 代码骨架 (`skills/`)
- 测试用例 (`test/`)
- 文档 (`docs/`)

状态变更: `review` → `implementing`

### 5. 执行测试

```bash
/mob-seed:exec "feature-name"
```

运行派生的测试，验证实现。

### 6. 归档规格

```bash
/mob-seed:archive "feature-name"
```

将 Delta 规格合并到 `specs/`，变更目录移动到 `archive/`。

状态变更: `implementing` → `archived`

---

## 规格格式 (fspec)

fspec = OpenSpec Delta + SEED 元数据

### Delta 语法

| 标记 | 说明 |
|------|------|
| `## ADDED` | 新增的需求 |
| `## MODIFIED` | 修改的需求 |
| `## REMOVED` | 删除的需求 |

### SEED 元数据

| 字段 | 说明 |
|------|------|
| `状态` | draft / review / implementing / archived |
| `版本` | 语义化版本号 |
| `技术栈` | 使用的技术栈包名称 |
| `派生路径` | 代码生成目标目录 |

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `/mob-seed:seed` | 智能状态面板 + 建议行动 |
| `/mob-seed:init` | 初始化 OpenSpec 结构 |
| `/mob-seed:spec --proposal` | 创建变更提案 |
| `/mob-seed:spec --submit` | 提交审查 |
| `/mob-seed:emit` | 派生代码/测试 |
| `/mob-seed:exec` | 执行测试 |
| `/mob-seed:archive` | 归档完成的变更 |
| `/mob-seed:defend` | 守护同步 |

---

## AI 行为约束

### 必须遵守

1. **先规格后代码**: 任何功能实现前，先确认规格存在
2. **Delta 格式**: 变更规格使用 ADDED/MODIFIED/REMOVED 标记
3. **状态一致**: 状态字段必须与实际工作阶段一致
4. **归档完整**: 功能完成后必须执行 archive 归档

### 禁止行为

1. ❌ 直接修改 `specs/` 中的已归档规格
2. ❌ 跳过 review 状态直接实现
3. ❌ 代码实现后不更新规格状态
4. ❌ 删除变更目录而不归档

---

## 项目特定配置

### 技术栈

本项目使用 **JavaScript/Node.js** 技术栈。

### 派生模板

| 类型 | 模板 | 输出路径 |
|------|------|----------|
| 代码 | skeleton | skills/mob-seed/ |
| 测试 | node-test | test/ |
| 文档 | markdown | docs/ |

### 自定义规则

- Claude Code Plugin 格式规范
- Skill/Command 分离架构
- 模块化适配器设计

---

## 参考

- [OpenSpec 官方规范](https://github.com/PaulJuliusMartinez/openspec)
- [SEED 方法论文档](skills/mob-seed/SKILL.md)
- [fspec 格式规范](skills/mob-seed/templates/)
