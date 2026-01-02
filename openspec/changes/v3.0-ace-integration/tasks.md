---
proposal: v3.0-ace-integration
generated: 2026-01-01T20:00:00Z
source: proposal.md
---

# 任务清单

> 此文件由系统自动生成，请勿手动编辑。
> 源文件: proposal.md

## Phase 1: 观察基础 (v3.0-alpha)

| 任务 | 规格 | 状态 |
|------|------|------|
| 1.1 定义观察数据结构 | observation.fspec.md | :white_check_mark: completed |
| 1.2 Execute/Defend 自动收集 | observation-collector.fspec.md | :white_check_mark: completed |
| 1.3 状态面板增强 | status-panel-enhance.fspec.md | :white_check_mark: completed |
| 1.4 observe 子操作 | spec-observe-command.fspec.md | :white_check_mark: completed |
| 1.5 triage 子操作 | spec-triage-command.fspec.md | :white_check_mark: completed |
| 1.6 tasks.md 自动派生 | task-generation.fspec.md | :white_check_mark: completed |

---

### 任务 1.1: 定义观察数据结构

**关联规格**: `specs/ace/observation.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: Observation 类型定义包含所有必需字段
- [x] AC-002: 支持 4 种核心类型 (test_failure, coverage_gap, spec_drift, user_feedback)
- [x] AC-003: source 字段区分自动/手动来源
- [x] AC-004: 实现 raw → triaged 转换
- [x] AC-005: triaged 状态包含 priority 字段
- [x] AC-006: 实现 triaged → promoted 转换
- [x] AC-007: promoted 状态关联 proposal_id
- [x] AC-008: 实现 raw/triaged → ignored 转换
- [x] AC-009: ignored 为终态，不可变更
- [x] AC-010: promoted 为终态，不可变更
- [x] AC-011: 实现 generateObservationId() 函数
- [x] AC-012: ID 格式符合规范 (obs-YYYYMMDD-hash)
- [x] AC-013: 同一天内 ID 唯一
- [x] AC-014: 实现观察 JSON 文件存储
- [x] AC-015: 文件路径符合 .seed/observations/{id}.json
- [x] AC-016: JSON 格式符合 schema
- [x] AC-017: 实现索引文件 index.json
- [x] AC-018: 索引按状态分组
- [x] AC-019: 索引包含统计信息

**派生产物**:
- `skills/mob-seed/lib/ace/observation.js` ✅
- `skills/mob-seed/test/ace/observation.test.js` ✅ (29/29 pass)

---

### 任务 1.2: Execute/Defend 自动收集

**关联规格**: `specs/ace/observation-collector.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: 实现 collectFromExecute(result) 函数
- [x] AC-002: 测试失败时创建 test_failure 观察
- [x] AC-003: 覆盖率不足时创建 coverage_gap 观察
- [x] AC-004: 观察包含 runId 用于追溯
- [x] AC-005: 实现 collectFromDefend(result) 函数
- [x] AC-006: 规格偏离时创建 spec_drift 观察
- [x] AC-007: 观察包含偏离类型和详情
- [x] AC-008: 实现 findDuplicate(obs, existing) 函数
- [x] AC-009: 相同信号不创建重复观察
- [x] AC-010: 重复信号更新已有观察的 updated 时间戳
- [x] AC-011: 实现 ObservationCollector 类
- [x] AC-012: 提供 processExecuteResult 方法
- [x] AC-013: 提供 processDefendResult 方法
- [x] AC-014: 返回收集结果（新增数、更新数、跳过数）
- [x] AC-015: 实现收集结果格式化输出
- [x] AC-016: 显示分类统计（按类型）
- [x] AC-017: 提示用户查看详情的命令

**派生产物**:
- `skills/mob-seed/lib/ace/observation-collector.js` ✅
- `skills/mob-seed/test/ace/observation-collector.test.js` ✅ (26/26 pass)

---

### 任务 1.3: 状态面板增强

**关联规格**: `specs/ace/status-panel-enhance.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: 在状态面板添加"观察状态"区块
- [x] AC-002: 显示各状态数量统计
- [x] AC-003: triaged 状态按优先级细分
- [x] AC-004: 显示操作提示
- [x] AC-005: 实现 getObservationStats() 函数
- [x] AC-006: 从 index.json 读取统计
- [x] AC-007: 索引不存在时返回空统计
- [x] AC-008: 实现 getPriorityDistribution() 函数
- [x] AC-009: 只显示有数量的优先级
- [x] AC-010: P0/P1 使用醒目颜色
- [x] AC-011: 实现健康度计算逻辑
- [x] AC-012: 根据健康度显示不同颜色
- [x] AC-013: 积压时显示警告提示
- [x] AC-014: 根据状态生成操作建议
- [x] AC-015: 建议可直接复制执行
- [x] AC-016: 优先显示高优先级操作

**派生产物**:
- `skills/mob-seed/lib/ux/progress-panel.js` (待集成)
- `skills/mob-seed/lib/ace/observation-stats.js` ✅
- `skills/mob-seed/test/ace/observation-stats.test.js` ✅ (20/20 pass)

---

### 任务 1.4: observe 子操作

**关联规格**: `specs/ace/spec-observe-command.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: 实现 `/mob-seed:spec observe` 子操作
- [x] AC-002: 支持交互式模式
- [x] AC-003: 支持快速模式（命令行参数）
- [x] AC-004: 创建的观察 source 为 `manual`
- [x] AC-005: 询问观察类型（选择题）
- [x] AC-006: 询问关联规格（可选，支持自动补全）
- [x] AC-007: 询问观察描述（必填）
- [x] AC-008: 询问建议（可选）
- [x] AC-009: 实现 `--list` 选项
- [x] AC-010: 支持 `--status` 过滤
- [x] AC-011: 显示状态分组统计
- [x] AC-012: 显示时间相对表示
- [x] AC-013: 实现 `--show <id>` 选项
- [x] AC-014: 显示完整观察内容
- [x] AC-015: 显示可执行的后续操作
- [x] AC-016: 实现 `--delete <id>` 选项
- [x] AC-017: 只允许删除 raw 状态的观察
- [x] AC-018: 删除前需确认
- [x] AC-019: 删除后更新索引

**派生产物**:
- `skills/mob-seed/lib/ace/observe-handler.js` ✅
- `skills/mob-seed/test/ace/observe-handler.test.js` ✅ (32/32 pass)

---

### 任务 1.5: triage 子操作

**关联规格**: `specs/ace/spec-triage-command.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: 实现 `/mob-seed:spec triage` 子操作
- [x] AC-002: 支持单个观察归类
- [x] AC-003: 支持快速归类模式
- [x] AC-004: 支持批量归类
- [x] AC-005: 显示观察完整内容
- [x] AC-006: 收集决策（accept/defer/ignore）
- [x] AC-007: 收集优先级
- [x] AC-008: 收集备注（可选）
- [x] AC-009: accept 决策触发提案创建
- [x] AC-010: 提案与原观察关联（source 字段）
- [x] AC-011: 观察状态变更为 promoted
- [x] AC-012: 更新观察的 proposal_id 字段
- [x] AC-013: ignore 决策需要确认
- [x] AC-014: 记录忽略理由
- [x] AC-015: 观察状态变更为 ignored
- [x] AC-016: ignored 为终态，不可恢复
- [x] AC-017: 实现 `--batch <status>` 选项
- [x] AC-018: 支持快捷键操作（a/d/i/s）
- [x] AC-019: 显示进度和统计
- [x] AC-020: 支持跳过（稍后处理）

**派生产物**:
- `skills/mob-seed/lib/ace/triage-handler.js` ✅
- `skills/mob-seed/test/ace/triage-handler.test.js` ✅ (26/26 pass)

---

### 任务 1.6: tasks.md 自动派生

**关联规格**: `specs/ace/task-generation.fspec.md`

**Acceptance Criteria**:
- [x] AC-001: review → implementing 触发任务生成
- [x] AC-002: 生成的 tasks.md 在 proposal 目录下
- [x] AC-003: 重复进入 implementing 时覆盖更新
- [x] AC-004: 解析 Proposal 的阶段结构
- [x] AC-005: 提取任务和子任务
- [x] AC-006: 关联 fspec 文件
- [x] AC-007: 支持中英文标题格式
- [x] AC-008: 使用 YAML frontmatter 记录元信息
- [x] AC-009: 包含"请勿手动编辑"警告
- [x] AC-010: 任务表格显示状态
- [x] AC-011: 每个任务详情包含派生产物
- [x] AC-012: fspec 状态变更触发 tasks.md 更新
- [x] AC-013: 任务状态与 fspec 状态同步
- [x] AC-014: 更新时保留手动无法编辑的警告
- [x] AC-015: 计算各阶段完成百分比
- [x] AC-016: 显示进度条可视化
- [x] AC-017: 在状态面板集成显示

**派生产物**:
- `skills/mob-seed/lib/spec/task-generator.js` ✅
- `skills/mob-seed/lib/spec/proposal-parser.js` ✅
- `skills/mob-seed/test/spec/task-generator.test.js` ✅ (32/32 pass)

---

## Phase 2: 反思能力 (v3.0-beta)

| 任务 | 规格 | 状态 |
|------|------|------|
| 2.1 定义反思数据结构 | - | :hourglass: pending |
| 2.2 规则匹配式反思 | - | :hourglass: pending |
| 2.3 reflect 子操作 | - | :hourglass: pending |
| 2.4 反思结果展示 | - | :hourglass: pending |

---

## Phase 3: 整合闭环 (v3.0)

| 任务 | 规格 | 状态 |
|------|------|------|
| 3.1 promote 子操作 | - | :hourglass: pending |
| 3.2 来源追溯链完整 | - | :hourglass: pending |
| 3.3 文档更新 | - | :hourglass: pending |
| 3.4 迁移指南 | - | :hourglass: pending |

---

## Phase 4: 智能增强 (v3.1+)

| 任务 | 规格 | 状态 |
|------|------|------|
| 4.1 LLM 辅助反思 | - | :hourglass: pending |
| 4.2 自动建议提案内容 | - | :hourglass: pending |
| 4.3 历史模式学习 | - | :hourglass: pending |

---

## 进度统计

```
Phase 1: [████████████████████] 100% (6/6) ✅
Phase 2: [                    ] 0% (0/4)
Phase 3: [                    ] 0% (0/4)
Phase 4: [                    ] 0% (0/3)
总进度:  [███████░░░░░░░░░░░░░] 35% (6/17)
```

### 测试统计
| 模块 | 通过/总数 | 状态 |
|------|----------|------|
| observation.js | 29/29 | ✅ |
| observation-collector.js | 26/26 | ✅ |
| observation-stats.js | 20/20 | ✅ |
| observe-handler.js | 32/32 | ✅ |
| triage-handler.js | 26/26 | ✅ |
| task-generator.js | 32/32 | ✅ |
| **累计** | **165/165** | ✅ |
