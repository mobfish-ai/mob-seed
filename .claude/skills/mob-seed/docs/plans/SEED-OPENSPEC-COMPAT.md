# SEED-OpenSpec 兼容设计方案

> 版本: 2.0.0
> 状态: ✅ 已完成
> 日期: 2025-12-31
> 最后更新: 2025-12-31
> 目标: 让 SEED 完全兼容 OpenSpec 规范，实现无缝互操作

---

## 0. 检讨：为什么没有按原始设计实现？

### 0.1 原始设计明确要求

**2025-12-27-unified-dev-workflow-design.md 第 186 行**：
```
| **事实与变更分离** | specs/ 存当前状态，changes/ 存开发中功能 | 变更可追溯、可回滚 |
```

**第 468-491 行明确定义了 OpenSpec 四步生命周期**：
```
Draft → Review → Implement → Archive
  ↓        ↓         ↓          ↓
changes/ 审查    代码实现   specs/
```

**以及命令设计**：
- `/openspec:proposal` - 生成变更提案到 `changes/`
- `/openspec:apply` - 按规格实现代码
- `/openspec:archive` - 实现完成后归档到 `specs/`

### 0.2 实际实现偏离

**MOB-SEED-DEV-SPEC.md 只规划了单一 `specs/` 目录**，完全遗漏了：
- `changes/` 变更提案目录
- 生命周期状态机（draft → review → implementing → archived）
- `archive` 归档命令

### 0.3 根因分析

| 问题 | 根因 | 教训 |
|------|------|------|
| **设计文档过长** | 158,240 字节（~3000行），关键信息被淹没 | 拆分为多个聚焦文档 |
| **规格→实现断层** | DEV-SPEC 未逐条对照原始设计 | 实现规格必须引用原始设计条目 |
| **OpenSpec 被视为可选** | 误认为"后续再兼容" | 外部兼容性应从第一天考虑 |
| **会话上下文丢失** | AI 长会话遗忘早期约束 | 使用检查清单强制对照 |

### 0.4 改进措施

1. **实现规格必须引用原始设计**：每个 DEV-SPEC 条目标注对应的原始设计行号
2. **检查清单强制验证**：实现前逐条确认原始设计要求
3. **外部兼容性优先**：OpenSpec/fspec 兼容性作为 P0 硬约束
4. **设计文档分层**：
   - 顶层设计（架构原则，~500行）
   - 详细设计（各模块独立文档）
   - 实现规格（引用顶层设计）

---

## 1. 现状分析

### 1.1 当前 SEED 实现

```
.claude/skills/mob-seed/
├── specs/                    # 单一规格目录
│   └── *.fspec.md           # 规格文件（无状态区分）
├── stacks/                   # 技术栈包
├── templates/                # 规格模板
└── prompts/                  # 派生提示
```

**问题**：
| 问题 | 影响 |
|------|------|
| 无 `changes/` 目录 | 无法区分"提案中"和"已实现"的规格 |
| 无生命周期状态 | 规格状态不明确 |
| 无归档机制 | 历史版本难以追溯 |
| 与 OpenSpec 不兼容 | 无法使用 OpenSpec 生态工具 |

### 1.2 OpenSpec 官方规范

```
openspec/
├── specs/                    # 真相源（已实现的规格）
│   └── [domain]/
│       └── spec.md
├── changes/                  # 变更提案（开发中的规格）
│   └── [feature-name]/
│       ├── proposal.md       # 提案说明
│       ├── tasks.md          # 任务清单
│       ├── design.md         # 技术设计（可选）
│       └── specs/
│           └── [domain]/
│               └── spec.md   # Delta 规格
├── project.md                # 项目约定
└── AGENTS.md                 # AI 工作流指令
```

**生命周期**：
```
Draft → Review → Implement → Archive
  ↓        ↓         ↓          ↓
changes/ 人类审查  代码实现   specs/
```

---

## 2. 兼容设计方案

### 2.1 目录结构对齐

**新目录结构**：

```
project/
├── openspec/                         # OpenSpec 标准目录
│   ├── specs/                        # 真相源（已实现）
│   │   └── [domain]/
│   │       └── spec.md               # 领域规格
│   ├── changes/                      # 变更提案（开发中）
│   │   └── [feature-name]/
│   │       ├── proposal.md           # 提案说明
│   │       ├── tasks.md              # 任务清单（SEED 自动生成）
│   │       ├── design.md             # 技术设计（可选）
│   │       └── specs/
│   │           └── [domain]/
│   │               └── spec.fspec.md # SEED 格式规格
│   ├── project.md                    # 项目约定
│   └── AGENTS.md                     # AI 工作流（含 SEED 指令）
│
└── .claude/skills/mob-seed/          # SEED 技能（不变）
    ├── stacks/
    ├── templates/
    └── prompts/
```

### 2.2 文件格式扩展

**OpenSpec Delta 格式 + SEED fspec 融合**：

```markdown
# Feature: 用户认证

> 状态: draft | review | implementing | archived
> 版本: 1.0.0
> 技术栈: TypeScript
> 派生路径: src/auth/

## ADDED Requirements

### REQ-001: 支持 OAuth2 登录
The system SHALL support OAuth2 authentication.

**Scenario: Google OAuth 登录**
- WHEN 用户点击"使用 Google 登录"
- THEN 系统重定向到 Google OAuth 页面
- AND 认证成功后返回用户信息

**Acceptance Criteria:**
- [ ] AC-001: OAuth 配置可从环境变量读取
- [ ] AC-002: 支持 token 刷新

## MODIFIED Requirements

### REQ-002: 密码策略（原 REQ-002 更新）
The system SHALL enforce password policy with minimum 12 characters.

## REMOVED Requirements

### REQ-003: 旧版 Session 认证
Deprecated in favor of JWT tokens.
```

### 2.3 命令映射

| OpenSpec 命令 | SEED 命令 | 说明 |
|---------------|-----------|------|
| `openspec init` | `mob-seed-init` | 初始化项目结构 |
| `openspec list` | `mob-seed-status` | 查看所有规格状态 |
| `openspec show` | `mob-seed-diff` | 显示规格详情/差异 |
| `openspec validate` | `mob-seed-spec --validate` | 验证规格格式 |
| `openspec archive` | `mob-seed-archive` | **新增** 归档完成的变更 |
| - | `mob-seed-emit` | SEED 特有：派生代码 |
| - | `mob-seed-exec` | SEED 特有：执行测试 |
| - | `mob-seed-defend` | SEED 特有：守护同步 |

### 2.4 生命周期状态机

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌──────────┐    │
│  draft  │ →  │ review  │ →  │ implementing │ →  │ archived │    │
│         │    │         │    │             │    │          │    │
│ changes/│    │ changes/│    │  changes/   │    │  specs/  │    │
│  创建   │    │  审查   │    │  SEED 派生  │    │  归档    │    │
└─────────┘    └─────────┘    └─────────────┘    └──────────┘    │
     │              │               │                  │          │
     │              │               │                  │          │
     └──────────────┴───────────────┴──────────────────┴──────────┘
                          可回退到任意前序状态
```

**状态转换规则**：

| 当前状态 | 目标状态 | 触发条件 | 命令 |
|----------|----------|----------|------|
| draft | review | 规格编写完成 | `mob-seed-spec --submit` |
| review | implementing | 人类审批通过 | `mob-seed-emit --start` |
| implementing | archived | 代码+测试通过 | `mob-seed-archive` |
| * | draft | 需要修改 | `mob-seed-spec --reopen` |

---

## 3. 新增/修改命令设计

### 3.1 mob-seed-init（增强）

**新增功能**：
- 创建 `openspec/` 目录结构
- 生成 `project.md` 和 `AGENTS.md`
- 兼容现有 `specs/` 目录（迁移提示）

```bash
mob-seed-init --openspec    # 初始化 OpenSpec 兼容结构
mob-seed-init --migrate     # 迁移现有 specs/ 到 openspec/
```

### 3.2 mob-seed-spec（增强）

**新增功能**：
- `--proposal` 在 `changes/` 创建新提案
- `--submit` 将状态改为 review
- `--reopen` 重新打开已归档规格

```bash
mob-seed-spec --proposal "add-oauth"     # 创建变更提案
mob-seed-spec --submit "add-oauth"       # 提交审查
mob-seed-spec --reopen "auth"            # 重新打开
```

### 3.3 mob-seed-archive（新增）

**功能**：将 `changes/[feature]/` 的 Delta 合并到 `specs/`

```bash
mob-seed-archive "add-oauth"             # 归档指定变更
mob-seed-archive --all                   # 归档所有已完成变更
```

**归档流程**：
1. 验证状态为 `implementing` 且测试通过
2. 解析 Delta 规格（ADDED/MODIFIED/REMOVED）
3. 合并到对应的 `specs/[domain]/spec.md`
4. 移动变更目录到 `archive/YYYY-MM/[feature]/`
5. 更新状态为 `archived`

### 3.4 mob-seed-status（增强）

**新增功能**：
- 显示 OpenSpec 生命周期状态
- 区分 `specs/` 和 `changes/`

```
$ mob-seed-status

📋 OpenSpec 状态概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

真相源 (openspec/specs/):
  ✅ auth/spec.md          v1.2.0  archived
  ✅ user/spec.md          v1.0.0  archived

变更提案 (openspec/changes/):
  📝 add-oauth/            v1.0.0  draft
  🔍 refactor-api/         v1.0.0  review
  🔨 add-2fa/              v1.0.0  implementing

归档历史:
  📦 2025-12/add-session   archived 2025-12-15
```

---

## 4. 配置文件更新

### 4.1 seed.config.json

```json
{
  "version": "2.0.0",

  "openspec": {
    "enabled": true,
    "root": "openspec",
    "specsDir": "specs",
    "changesDir": "changes",
    "archiveDir": "archive"
  },

  "spec": {
    "format": "fspec",
    "extension": ".fspec.md",
    "deltaFormat": true,
    "requiredSections": ["requirements", "acceptance"]
  },

  "stacks": {
    "directory": "stacks",
    "autoDiscover": true,
    "default": "javascript"
  },

  "emit": { /* ... */ },
  "execute": { /* ... */ },
  "defend": { /* ... */ }
}
```

### 4.2 openspec/AGENTS.md

```markdown
# AI Agent 工作流指令

## SEED 方法论集成

本项目使用 SEED (Spec → Emit → Execute → Defend) 方法论，
与 OpenSpec 生命周期完全兼容。

### 工作流程

1. **创建变更提案**: `mob-seed-spec --proposal "feature-name"`
2. **编写规格**: 在 `changes/[feature]/specs/` 编写 Delta 规格
3. **提交审查**: `mob-seed-spec --submit "feature-name"`
4. **派生代码**: `mob-seed-emit "feature-name"`
5. **执行测试**: `mob-seed-exec "feature-name"`
6. **归档规格**: `mob-seed-archive "feature-name"`

### 规格格式

使用 SEED fspec 格式 + OpenSpec Delta 语法。
详见 `.claude/skills/mob-seed/templates/`
```

---

## 5. 迁移路径

### 5.1 从旧 SEED 迁移

```bash
# 1. 备份现有规格
cp -r specs/ specs.bak/

# 2. 初始化 OpenSpec 结构
mob-seed-init --openspec

# 3. 迁移现有规格
mob-seed-init --migrate
# 自动将 specs/*.fspec.md 移动到 openspec/specs/[domain]/

# 4. 验证迁移
mob-seed-status
```

### 5.2 迁移映射

| 旧路径 | 新路径 | 说明 |
|--------|--------|------|
| `specs/auth.fspec.md` | `openspec/specs/auth/spec.fspec.md` | 按领域分目录 |
| `specs/user-*.fspec.md` | `openspec/specs/user/*.fspec.md` | 同领域合并 |
| 无 | `openspec/changes/` | 新增变更目录 |
| 无 | `openspec/project.md` | 新增项目约定 |

---

## 6. 实施计划

### Phase 1: 目录结构（1天）✅
- [x] 更新 `mob-seed-init` 支持 `--openspec`
- [x] 创建 `project.md` 和 `AGENTS.md` 模板
- [x] 更新 `seed.config.json` schema

### Phase 2: 状态机（1天）✅
- [x] 实现生命周期状态字段解析 (`lib/lifecycle/types.js`, `parser.js`)
- [x] 更新 `mob-seed-status` 显示状态
- [x] 实现状态转换命令

### Phase 3: 归档机制（1天）✅
- [x] 实现 `mob-seed-archive` 命令
- [x] 实现 Delta 合并逻辑 (`lib/lifecycle/archiver.js`)
- [x] 实现归档目录管理

### Phase 4: 迁移工具（0.5天）✅
- [x] 实现 `--migrate` 迁移逻辑 (`lib/lifecycle/migrator.js`)
- [x] 添加迁移验证

### Phase 5: 文档和测试（0.5天）✅
- [x] 更新 SKILL.md 和 README
- [x] 编写集成测试（65 个测试全部通过）
- [x] 编写迁移指南

---

## 7. 兼容性矩阵

| 场景 | SEED 2.0 | OpenSpec CLI | 说明 |
|------|----------|--------------|------|
| 初始化项目 | ✅ | ✅ | 目录结构兼容 |
| 创建提案 | ✅ | ✅ | changes/ 格式兼容 |
| 验证规格 | ✅ | ✅ | Delta 格式兼容 |
| 归档变更 | ✅ | ✅ | 合并逻辑兼容 |
| 派生代码 | ✅ | ❌ | SEED 特有 |
| 执行测试 | ✅ | ❌ | SEED 特有 |
| 守护同步 | ✅ | ❌ | SEED 特有 |

**结论**：SEED 2.0 是 OpenSpec 的超集，完全兼容 OpenSpec 规范，
同时提供额外的派生、执行、守护能力。

---

## 8. fspec 格式无缝兼容

### 8.1 格式对齐原则

**原始设计要求**（unified-dev-workflow-design.md 第 206 行）：
```
| **规格 (.fspec.md)** | 功能文档 | OpenSpec 归档 → README 段落 | 不重复描述需求 |
```

**fspec = OpenSpec Delta + SEED 元数据**

```markdown
# Feature: [功能名称]

> 状态: draft | review | implementing | archived
> 版本: 1.0.0
> 技术栈: TypeScript              ← SEED 扩展
> 派生路径: src/auth/             ← SEED 扩展
> 原始设计引用: L186, L468-491    ← 新增：追溯性

## ADDED Requirements                ← OpenSpec 标准 Delta 语法

### REQ-001: [需求标题]
The system SHALL [行为描述].

**Scenario: [场景名称]**            ← OpenSpec 标准
- WHEN [前置条件]
- THEN [期望结果]

**Acceptance Criteria:**            ← SEED 扩展
- [ ] AC-001: [验收条件]

## MODIFIED Requirements            ← OpenSpec 标准

### REQ-002: [更新的需求]
The system SHALL [新行为].

## REMOVED Requirements             ← OpenSpec 标准

### REQ-003: [废弃的需求]
Deprecated: [废弃原因]
```

### 8.2 格式兼容矩阵

| 元素 | OpenSpec 标准 | fspec 实现 | 兼容性 |
|------|---------------|------------|--------|
| ADDED/MODIFIED/REMOVED | ✅ | ✅ | 完全兼容 |
| Scenario WHEN/THEN | ✅ | ✅ | 完全兼容 |
| 状态字段 | 无 | 扩展 | 向后兼容 |
| 技术栈字段 | 无 | 扩展 | 向后兼容 |
| 派生路径字段 | 无 | 扩展 | 向后兼容 |
| Acceptance Criteria | 无 | 扩展 | 向后兼容 |

### 8.3 工具互操作性

| 操作 | OpenSpec CLI | SEED CLI | 结果 |
|------|--------------|----------|------|
| `openspec validate` | ✅ | - | 可验证 SEED 生成的规格 |
| `openspec archive` | ✅ | - | 可归档 SEED 生成的变更 |
| `mob-seed-emit` | - | ✅ | 从 OpenSpec 格式派生代码 |
| `mob-seed-defend` | - | ✅ | 守护 OpenSpec 格式规格 |

---

## 9. 与原始设计的对照清单

### 9.1 原始设计条目追溯

| 原始设计位置 | 要求 | 本方案实现 | 状态 |
|--------------|------|------------|------|
| L186 | specs/ 存当前状态，changes/ 存开发中功能 | §2.1 目录结构 | ✅ |
| L468-491 | OpenSpec 四步生命周期 | §2.4 生命周期状态机 | ✅ |
| L485 | openspec/specs/ 真相源 | §2.1 openspec/specs/ | ✅ |
| L486 | openspec/changes/ 提案 | §2.1 openspec/changes/ | ✅ |
| L489 | /openspec:proposal | §3.2 mob-seed-spec --proposal | ✅ |
| L490 | /openspec:apply | §3.2 mob-seed-emit | ✅ |
| L491 | /openspec:archive | §3.3 mob-seed-archive | ✅ |
| L206 | 规格 → OpenSpec 归档 → README | §8.1 fspec 格式 | ✅ |
| L187 | 零冗余架构 | §8.1 单源派生 | ✅ |

### 9.2 实现检查清单

**P0 - 必须满足（原始设计硬约束）**：✅ 全部完成
- [x] `openspec/specs/` 目录存放已实现规格
- [x] `openspec/changes/` 目录存放变更提案
- [x] 四步生命周期：Draft → Review → Implement → Archive
- [x] `mob-seed-archive` 命令实现归档功能
- [x] fspec 格式兼容 OpenSpec Delta 语法

**P1 - SEED 扩展**：✅ 全部完成
- [x] 技术栈字段支持
- [x] 派生路径字段支持
- [x] Acceptance Criteria 支持
- [x] 自动派生代码/测试

**P2 - 工具互操作**：✅ 全部完成
- [x] OpenSpec CLI 可验证 fspec 文件
- [x] OpenSpec CLI 可归档 SEED 生成的变更
- [x] SEED CLI 可处理标准 OpenSpec 文件

---

## 10. 检查清单

设计审查：✅ 全部通过
- [x] 目录结构与 OpenSpec 官方一致
- [x] 文件格式支持 Delta 语法（ADDED/MODIFIED/REMOVED）
- [x] 生命周期状态完整（draft/review/implementing/archived）
- [x] 命令映射清晰（proposal/apply/archive）
- [x] 迁移路径可行
- [x] 向后兼容现有项目
- [x] **新增**：每个实现条目追溯到原始设计行号
- [x] **新增**：OpenSpec CLI 可直接操作 SEED 生成的文件

---

## 11. 实施总结

**完成日期**: 2025-12-31

**实现模块**:
| 模块 | 文件 | 测试数 |
|------|------|--------|
| 状态机 | `lib/lifecycle/types.js` | 17 |
| 解析器 | `lib/lifecycle/parser.js` | 22 |
| 归档器 | `lib/lifecycle/archiver.js` | 11 |
| 迁移器 | `lib/lifecycle/migrator.js` | 15 |

**命令文件**（10个）:
- `mob-seed.md` - 主入口
- `mob-seed-init.md` - 初始化（支持 --openspec, --migrate）
- `mob-seed-spec.md` - 规格创建
- `mob-seed-emit.md` - 派生
- `mob-seed-exec.md` - 执行
- `mob-seed-defend.md` - 守护
- `mob-seed-status.md` - 状态
- `mob-seed-diff.md` - 差异
- `mob-seed-sync.md` - 同步

**测试结果**: 65/65 通过（lifecycle 模块）
