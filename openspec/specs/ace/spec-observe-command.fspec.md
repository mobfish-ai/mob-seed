# Feature: observe 子操作 - 手动添加观察

> 状态: draft
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/

## 概述 (Overview)

实现 `/mob-seed:spec observe` 子操作，允许用户手动添加观察。支持用户反馈、模式洞察等无法自动收集的信号。

### 目标用户

- 使用 mob-seed 的开发者
- 团队成员（提供反馈）

### 业务约束

- 作为 `/mob-seed:spec` 的子操作，不新增顶层命令
- 观察创建后状态为 `raw`
- 支持交互式和非交互式模式

---

## ADDED Requirements

### REQ-001: 添加观察命令

The system SHALL provide a command to manually add observations.

**Scenario: 交互式添加观察**
- GIVEN 用户运行 `/mob-seed:spec observe`
- WHEN 未提供参数
- THEN 进入交互式模式，逐步收集信息

**Scenario: 快速添加观察**
- GIVEN 用户运行 `/mob-seed:spec observe --type user_feedback --spec parser.fspec.md "解析器应支持注释"`
- WHEN 提供完整参数
- THEN 直接创建观察

**命令格式**:

```bash
# 交互式
/mob-seed:spec observe

# 快速模式
/mob-seed:spec observe [options] <description>

Options:
  --type <type>     观察类型 (user_feedback | pattern_insight)
  --spec <path>     关联规格路径
  --priority <P0-P4> 优先级
```

**Acceptance Criteria:**
- [x] AC-001: 实现 `/mob-seed:spec observe` 子操作
- [x] AC-002: 支持交互式模式
- [x] AC-003: 支持快速模式（命令行参数）
- [x] AC-004: 创建的观察 source 为 `manual`

---

### REQ-002: 交互式信息收集

The system SHALL guide users through observation creation interactively.

**Scenario: 交互式流程**
- GIVEN 用户运行 `/mob-seed:spec observe` 无参数
- WHEN 进入交互模式
- THEN 依次询问必要信息

**交互流程**:

```
📝 添加新观察

? 观察类型:
  ❯ user_feedback - 用户/团队反馈
    pattern_insight - 模式洞察

? 关联规格 (可选，回车跳过):
  > openspec/specs/parser/parser.fspec.md

? 描述你的观察:
  > 解析器在处理大文件时性能下降

? 建议 (可选):
  > 考虑添加流式解析支持

✅ 观察已创建: obs-20260101-xyz789
```

**Acceptance Criteria:**
- [x] AC-005: 询问观察类型（选择题）
- [x] AC-006: 询问关联规格（可选，支持自动补全）
- [x] AC-007: 询问观察描述（必填）
- [x] AC-008: 询问建议（可选）

---

### REQ-003: 列出观察命令

The system SHALL provide a command to list observations.

**Scenario: 列出所有观察**
- GIVEN 存在多个观察
- WHEN 运行 `/mob-seed:spec observe --list`
- THEN 显示观察列表

**Scenario: 按状态过滤**
- GIVEN 存在多个状态的观察
- WHEN 运行 `/mob-seed:spec observe --list --status raw`
- THEN 只显示 raw 状态的观察

**输出格式**:

```
📋 观察列表 (raw: 3, triaged: 2)

raw:
  obs-20260101-abc123  test_failure   parser.fspec.md     2h ago
  obs-20260101-def456  coverage_gap   validator.fspec.md  1d ago
  obs-20260101-xyz789  user_feedback  parser.fspec.md     just now

triaged:
  obs-20251231-aaa111  spec_drift     router.fspec.md     P1  3d ago
  obs-20251231-bbb222  pattern_insight -                  P2  5d ago

💡 运行 `/mob-seed:spec observe --show <id>` 查看详情
```

**Acceptance Criteria:**
- [x] AC-009: 实现 `--list` 选项
- [x] AC-010: 支持 `--status` 过滤
- [x] AC-011: 显示状态分组统计
- [x] AC-012: 显示时间相对表示

---

### REQ-004: 查看观察详情

The system SHALL provide a command to view observation details.

**Scenario: 查看单个观察**
- GIVEN 存在观察 obs-20260101-abc123
- WHEN 运行 `/mob-seed:spec observe --show obs-20260101-abc123`
- THEN 显示观察完整内容

**输出格式**:

```
📄 观察详情: obs-20260101-abc123

类型:     test_failure
状态:     raw
来源:     auto:execute
创建时间: 2026-01-01 20:00:00
更新时间: 2026-01-01 20:00:00
关联规格: openspec/specs/parser/parser.fspec.md

描述:
  测试 `should handle empty input` 失败

上下文:
  错误: TypeError: Cannot read property 'length' of undefined
  文件: skills/mob-seed/test/parser.test.js:45
  执行批次: run-12345

建议:
  添加 AC: 输入为空时返回空数组

操作:
  /mob-seed:spec triage obs-20260101-abc123  # 进行归类
```

**Acceptance Criteria:**
- [x] AC-013: 实现 `--show <id>` 选项
- [x] AC-014: 显示完整观察内容
- [x] AC-015: 显示可执行的后续操作

---

### REQ-005: 删除观察

The system SHALL allow deleting observations in raw status.

**Scenario: 删除 raw 观察**
- GIVEN 存在 raw 状态的观察
- WHEN 运行 `/mob-seed:spec observe --delete <id>`
- THEN 删除该观察

**Scenario: 禁止删除非 raw 观察**
- GIVEN 存在 triaged 状态的观察
- WHEN 尝试删除
- THEN 报错，提示只能删除 raw 状态的观察

**Acceptance Criteria:**
- [x] AC-016: 实现 `--delete <id>` 选项
- [x] AC-017: 只允许删除 raw 状态的观察
- [x] AC-018: 删除前需确认
- [x] AC-019: 删除后更新索引

---

## 派生产物 (Derived Outputs)

> **注**: observe 是 `/mob-seed:spec` 的子操作，不单独派生命令文件。

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/observe-handler.js | observe 子操作处理逻辑 |
| 测试 | skills/mob-seed/test/ace/observe-handler.test.js | 单元测试 |
| 文档 | docs/api/spec-observe.md | API 文档（合并到 spec 命令文档） |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md
- 被依赖: 无
