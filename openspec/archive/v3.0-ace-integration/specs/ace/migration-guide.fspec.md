---
status: archived
archived: 2026-01-02
version: 1.0.0
tech_stack: Markdown
derived_path: docs/migration/
---
# Feature: v3.0 迁移指南
## 概述 (Overview)

为现有 mob-seed v2.x 用户提供迁移到 v3.0 的指南，确保平滑升级。

### 目标用户

- 使用 mob-seed v2.x 的项目
- mob-seed 贡献者

### 业务约束

- 不破坏现有 v2.x 工作流程
- 提供清晰的迁移步骤
- 支持渐进式采用 ACE 功能

---

## ADDED Requirements

### REQ-001: 迁移概览

The system SHALL provide a migration overview document.

**文档路径**: `docs/migration/v2-to-v3.md`

**内容结构**:

```markdown
# 从 v2.x 迁移到 v3.0

## 概览

v3.0 引入 ACE (Agentic Context Engineering) 能力，实现规格自演化闭环。

## 兼容性

| 功能 | v2.x | v3.0 | 兼容性 |
|------|------|------|--------|
| SEED 核心流程 | ✅ | ✅ | 完全兼容 |
| 命令语法 | `/mob-seed-*` | `/mob-seed:*` | 需迁移 |
| 目录结构 | .seed/ | .seed/ + observations/ | 新增目录 |
| 配置格式 | config.json | config.json + ace 字段 | 新增字段 |

## 快速迁移步骤

1. 更新 mob-seed 版本
2. 运行 `/mob-seed:init --upgrade`
3. 更新命令调用语法
4. （可选）启用 ACE 功能
```

**Acceptance Criteria:**
- [ ] AC-001: 创建迁移概览文档
- [ ] AC-002: 列出兼容性矩阵
- [ ] AC-003: 提供快速迁移步骤
- [ ] AC-004: 说明新增内容

---

### REQ-002: 命令迁移说明

The system SHALL document command syntax changes.

**命令变更表**:

| v2.x 命令 | v3.0 命令 | 说明 |
|-----------|-----------|------|
| `/mob-seed-spec` | `/mob-seed:spec` | 冒号分隔 |
| `/mob-seed-emit` | `/mob-seed:emit` | 冒号分隔 |
| `/mob-seed-exec` | `/mob-seed:exec` | 冒号分隔 |
| `/mob-seed-defend` | `/mob-seed:defend` | 冒号分隔 |
| `/mob-seed-archive` | `/mob-seed:archive` | 冒号分隔 |
| `/mob-seed-status` | `/mob-seed` | 合并到主命令 |
| `/mob-seed-diff` | `/mob-seed:defend --diff` | 合并为选项 |

**迁移脚本**（可选）:

```bash
# 批量替换项目中的命令引用
find . -name "*.md" -exec sed -i '' 's/\/mob-seed-/\/mob-seed:/g' {} \;
```

**Acceptance Criteria:**
- [ ] AC-005: 列出所有命令变更
- [ ] AC-006: 说明变更原因
- [ ] AC-007: 提供迁移脚本（可选）
- [ ] AC-008: 标注已移除的命令

---

### REQ-003: 配置迁移说明

The system SHALL document configuration changes.

**配置变更**:

```json
// v2.x .seed/config.json
{
  "name": "my-project",
  "paths": { ... }
}

// v3.0 .seed/config.json (新增 ace 字段)
{
  "name": "my-project",
  "paths": { ... },
  "ace": {
    "enabled": true,
    "sources": {
      "core": ["test_failure", "spec_drift", "coverage_gap", "user_feedback"]
    },
    "reflect": {
      "auto_trigger": true,
      "thresholds": {
        "same_type": 3,
        "same_spec": 2
      }
    }
  }
}
```

**迁移策略**:
- 升级时自动添加 `ace` 字段（使用默认值）
- 现有配置字段保持不变
- `ace.enabled: false` 可禁用 ACE 功能

**Acceptance Criteria:**
- [ ] AC-009: 说明配置字段变更
- [ ] AC-010: 提供前后对比示例
- [ ] AC-011: 说明自动升级行为
- [ ] AC-012: 说明如何禁用 ACE

---

### REQ-004: 目录结构迁移

The system SHALL document directory structure changes.

**新增目录**:

```
.seed/
├── config.json
├── mission.md
├── observations/      # v3.0 新增
│   ├── index.json
│   └── obs-*.md
├── reflections/       # v3.0 新增
│   ├── index.json
│   └── ref-*.md
└── output/
```

**迁移行为**:
- 升级时自动创建 `observations/` 和 `reflections/` 目录
- 创建空的 `index.json` 文件
- 不影响现有目录和文件

**Git 配置建议**:

```gitignore
# .gitignore 可选配置
# 不跟踪观察和反思数据（减少仓库体积）
# .seed/observations/
# .seed/reflections/
```

**Acceptance Criteria:**
- [ ] AC-013: 说明新增目录结构
- [ ] AC-014: 说明自动创建行为
- [ ] AC-015: 提供 .gitignore 建议
- [ ] AC-016: 确保不影响现有文件

---

### REQ-005: 升级命令

The system SHALL provide an upgrade command.

**命令格式**:

```bash
/mob-seed:init --upgrade
```

**升级流程**:

```
┌─────────────────────────────────────────┐
│  /mob-seed:init --upgrade               │
├─────────────────────────────────────────┤
│                                         │
│  1. 检查当前版本                         │
│  2. 备份 .seed/config.json              │
│  3. 添加 ace 配置字段                    │
│  4. 创建 observations/ 目录             │
│  5. 创建 reflections/ 目录              │
│  6. 显示升级摘要                        │
│                                         │
└─────────────────────────────────────────┘
```

**升级摘要输出**:

```
✅ mob-seed 升级完成 (v2.x → v3.0)

新增:
- .seed/observations/ 目录
- .seed/reflections/ 目录
- config.json 增加 ace 配置

命令变更:
- /mob-seed-* → /mob-seed:*
- 详见: docs/migration/v2-to-v3.md

下一步:
- 运行 /mob-seed 查看状态面板
- 运行 /mob-seed:spec observe 添加首个观察
```

**Acceptance Criteria:**
- [ ] AC-017: 实现 `--upgrade` 选项
- [ ] AC-018: 备份现有配置
- [ ] AC-019: 自动添加新目录和配置
- [ ] AC-020: 显示升级摘要和下一步提示

---

### REQ-006: 渐进式采用指南

The system SHALL provide guidance for gradual ACE adoption.

**采用级别**:

| 级别 | 功能 | 配置 |
|------|------|------|
| L0 禁用 | ACE 完全关闭 | `ace.enabled: false` |
| L1 被动 | 只自动收集观察 | 默认配置 |
| L2 主动 | 手动触发反思 | `ace.reflect.auto_trigger: false` |
| L3 完整 | 全自动闭环 | `ace.reflect.auto_trigger: true` |

**渐进采用路径**:

```
Week 1: L1 被动收集
  - Execute/Defend 自动记录
  - 观察数据积累

Week 2-3: L2 主动分析
  - 手动 /mob-seed:spec triage
  - 手动 /mob-seed:spec reflect

Week 4+: L3 完整闭环
  - 自动触发反思
  - 观察 → 反思 → 提案完整流程
```

**Acceptance Criteria:**
- [ ] AC-021: 定义采用级别
- [ ] AC-022: 说明每个级别的功能
- [ ] AC-023: 提供渐进采用路径建议
- [ ] AC-024: 说明如何在级别间切换

---

### REQ-007: 常见问题

The system SHALL document frequently asked questions.

**FAQ 内容**:

```markdown
## 常见问题

### Q: 升级会影响现有规格吗？
A: 不会。ACE 是增量功能，不修改现有 openspec/ 规格文件。

### Q: 可以禁用 ACE 吗？
A: 可以。设置 `ace.enabled: false`，mob-seed 行为与 v2.x 完全一致。

### Q: 观察数据会增加仓库体积吗？
A: 会。建议将 `.seed/observations/` 加入 .gitignore，或定期归档。

### Q: v2.x 命令还能用吗？
A: v3.0 中已移除旧命令语法，请使用 `/mob-seed:*` 格式。

### Q: 如何回滚到 v2.x？
A: 删除 `.seed/observations/`、`.seed/reflections/` 目录，
   移除 config.json 中的 `ace` 字段，安装 v2.x 版本。
```

**Acceptance Criteria:**
- [ ] AC-025: 收集并回答常见问题
- [ ] AC-026: 涵盖兼容性问题
- [ ] AC-027: 涵盖回滚方法
- [ ] AC-028: 随用户反馈持续更新

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 文档 | docs/migration/v2-to-v3.md | 迁移指南主文档 |
| 代码 | skills/mob-seed/lib/init/upgrade.js | 升级逻辑 |
| 测试 | skills/mob-seed/test/init/upgrade.test.js | 升级测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: 所有 Phase 1-3 规格实现完成
- 被依赖: 无
