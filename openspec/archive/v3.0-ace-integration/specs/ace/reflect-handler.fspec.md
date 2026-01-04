---
status: archived
archived: 2026-01-02
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/ace/
---
# Feature: Reflect 命令处理器
## 概述 (Overview)

实现 `/mob-seed:spec reflect` 子操作，触发反思分析并展示结果。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 作为 `/mob-seed:spec` 的子操作
- 分析 triaged 状态的观察
- 生成反思建议供用户确认

---

## ADDED Requirements

### REQ-001: 基本触发

The system SHALL trigger reflection analysis via `/mob-seed:spec reflect` command.

**命令格式**:

```bash
/mob-seed:spec reflect [options]
```

**选项**:

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--auto` | 自动接受高置信度反思 | false |
| `--min-confidence` | 最低置信度阈值 | 0.5 |
| `--patterns` | 指定模式类型 | 全部 |

**Acceptance Criteria:**
- [ ] AC-001: 实现 `/mob-seed:spec reflect` 子操作
- [ ] AC-002: 读取 triaged 状态的观察
- [ ] AC-003: 调用 PatternMatcher 进行分析
- [ ] AC-004: 返回反思建议列表

---

### REQ-002: 交互式确认

The system SHALL provide interactive confirmation for reflection candidates.

**交互流程**:

```
┌─────────────────────────────────────────────┐
│  💡 发现 2 个反思建议                         │
├─────────────────────────────────────────────┤
│                                              │
│  [1] 类型聚合: test_failure (3 个观察)        │
│      置信度: 85%                             │
│      教训: 项目缺乏统一的空值处理策略          │
│      观察: obs-001, obs-002, obs-003         │
│      操作: [a] 接受  [r] 拒绝  [s] 跳过       │
│                                              │
│  [2] 规格聚合: parser.fspec.md (2 个观察)     │
│      置信度: 72%                             │
│      教训: parser 规格可能需要补充边界条件      │
│      观察: obs-004, obs-005                  │
│      操作: [a] 接受  [r] 拒绝  [s] 跳过       │
│                                              │
└─────────────────────────────────────────────┘
```

**快捷键**:

| 键 | 操作 | 说明 |
|----|------|------|
| a | accept | 接受反思，创建 draft 状态反思 |
| r | reject | 拒绝反思，不创建 |
| s | skip | 跳过，稍后处理 |
| q | quit | 退出交互 |

**Acceptance Criteria:**
- [ ] AC-005: 显示反思建议列表
- [ ] AC-006: 每个建议显示置信度、教训、观察
- [ ] AC-007: 支持 a/r/s/q 快捷键
- [ ] AC-008: 接受后创建 draft 状态反思

---

### REQ-003: 反思创建

The system SHALL create Reflection records when user accepts candidates.

**创建流程**:

```
用户选择 [a] 接受
         │
         ▼
┌─────────────────────────┐
│  1. 生成反思 ID          │
│  2. 创建反思文件         │
│  3. 更新索引            │
│  4. 显示创建结果         │
└─────────────────────────┘
```

**Acceptance Criteria:**
- [ ] AC-009: 调用 createReflection() 创建反思
- [ ] AC-010: 反思文件包含教训、分析、建议行动
- [ ] AC-011: 自动填充来源追溯表
- [ ] AC-012: 更新索引文件

---

### REQ-004: 自动模式

The system SHALL support automatic acceptance of high-confidence reflections.

**自动接受条件**:

```javascript
if (candidate.confidence >= autoThreshold) {
  // 自动创建反思
  createReflection(candidate);
}
```

**配置**:

```json
{
  "ace": {
    "reflect": {
      "auto_trigger": true,
      "auto_accept_threshold": 0.9
    }
  }
}
```

**Acceptance Criteria:**
- [ ] AC-013: 支持 `--auto` 选项
- [ ] AC-014: 配置 auto_accept_threshold
- [ ] AC-015: 自动接受的反思标记 source: auto

---

### REQ-005: 空结果处理

The system SHALL handle cases with no pattern matches.

**空结果响应**:

```
📊 反思分析完成

未发现新的模式匹配。

可能原因:
- triaged 观察数量不足（当前: 2，阈值: 3）
- 观察类型分散，无明显聚合

建议:
- 继续收集更多观察
- 尝试手动添加观察: /mob-seed:spec observe
```

**Acceptance Criteria:**
- [ ] AC-016: 检测无匹配情况
- [ ] AC-017: 显示友好的空结果提示
- [ ] AC-018: 提供下一步建议

---

### REQ-006: 列表和查看

The system SHALL support listing and viewing existing reflections.

**列表命令**:

```bash
/mob-seed:spec reflect --list
```

**输出**:

```
📋 反思列表

| ID | 状态 | 模式 | 观察数 | 创建时间 |
|----|------|------|--------|---------|
| ref-001 | accepted | type_aggregation | 3 | 2 天前 |
| ref-002 | draft | spec_aggregation | 2 | 1 小时前 |
| ref-003 | rejected | time_clustering | 2 | 3 天前 |

统计: 3 total (1 accepted, 1 draft, 1 rejected)
```

**查看命令**:

```bash
/mob-seed:spec reflect --show ref-001
```

**Acceptance Criteria:**
- [ ] AC-019: 实现 `--list` 选项
- [ ] AC-020: 显示时间相对表示
- [ ] AC-021: 实现 `--show <id>` 选项
- [ ] AC-022: 显示完整反思内容

---

### REQ-007: 接受和拒绝操作

The system SHALL support accepting or rejecting draft reflections.

**接受命令**:

```bash
/mob-seed:spec reflect --accept ref-002
```

**拒绝命令**:

```bash
/mob-seed:spec reflect --reject ref-002 --reason "误报"
```

**Acceptance Criteria:**
- [ ] AC-023: 实现 `--accept <id>` 选项
- [ ] AC-024: 实现 `--reject <id>` 选项
- [ ] AC-025: 拒绝需要理由
- [ ] AC-026: 更新反思状态和索引

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/reflect-handler.js | 反思命令处理器 |
| 测试 | skills/mob-seed/test/ace/reflect-handler.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: reflection.fspec.md, pattern-matcher.fspec.md
- 被依赖: promote-handler.fspec.md
