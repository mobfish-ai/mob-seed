# Feature: Phase Gate (阶段门禁)

> 状态: archived
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/quality/
> 优先级: P1
> 预计工作量: 1-2天

## 概述

在工作流的每个阶段转换点设置验证门禁，确保前一阶段的产出满足质量要求后才能进入下一阶段。

## ADDED Requirements

### REQ-001: 门禁定义

The system SHALL define gates for each workflow stage transition.

**Standard Flow 门禁:**

| 转换 | 门禁名称 | 验证内容 |
|------|----------|----------|
| 分析→设计 | gate-analysis | 任务已拆解、无歧义 |
| 设计→实现 | gate-design | 方案可行、依赖明确 |
| 实现→测试 | gate-implement | 代码完成、可编译 |
| 测试→文档 | gate-test | 测试通过、覆盖率达标 |
| 文档→完成 | gate-document | 文档同步、完整 |

**Full Flow 额外门禁:**

| 转换 | 门禁名称 | 验证内容 |
|------|----------|----------|
| 研究→规格 | gate-research | 理解充分、方向明确 |
| 规格→设计 | gate-spec | fspec 完整、无模糊词 |
| 文档→评审 | gate-document | 文档完整 |
| 评审→归档 | gate-review | 评审通过 |

**Acceptance Criteria:**
- [ ] AC-001: 每个阶段转换有对应门禁
- [ ] AC-002: 门禁验证内容可配置
- [ ] AC-003: 支持自定义门禁

### REQ-002: 验证规则引擎

The system SHALL implement validation rule engine.

**规则类型:**

| 类型 | 说明 | 示例 |
|------|------|------|
| file_exists | 文件存在性 | tasks.md 必须存在 |
| file_content | 文件内容 | fspec 无 TODO 标记 |
| command_success | 命令执行成功 | npm test 通过 |
| metric_threshold | 指标阈值 | 覆盖率 > 80% |
| human_approval | 人工审批 | 设计评审通过 |

**Scenario: 执行文件存在性验证**
- WHEN 门禁规则为 `{ type: 'file_exists', path: 'tasks.md' }`
- THEN 检查文件是否存在
- AND 返回 `{ passed: true/false, message: '...' }`

**Scenario: 执行命令成功验证**
- WHEN 门禁规则为 `{ type: 'command_success', cmd: 'npm test' }`
- THEN 执行命令并检查退出码
- AND 返回执行结果和输出

**Acceptance Criteria:**
- [ ] AC-004: 支持至少 5 种规则类型
- [ ] AC-005: 规则可组合（AND/OR）
- [ ] AC-006: 返回详细验证结果

### REQ-003: 门禁执行

The system SHALL execute gate validations at stage transitions.

**Scenario: 自动门禁验证**
- WHEN 尝试从阶段 A 进入阶段 B
- THEN 执行阶段 A 对应的门禁验证
- AND 所有规则通过后允许转换

**Scenario: 门禁失败处理**
- WHEN 门禁验证失败
- THEN 阻止阶段转换
- AND 输出失败原因和修复建议
- AND 记录失败日志

**Acceptance Criteria:**
- [ ] AC-007: 阻止未通过门禁的转换
- [ ] AC-008: 提供修复建议
- [ ] AC-009: 支持强制跳过（需记录原因）

### REQ-004: 人工审批集成

The system SHALL support human approval gates.

**Scenario: 设计评审门禁**
- WHEN 门禁包含 `{ type: 'human_approval', role: 'reviewer' }`
- THEN 暂停流程等待人工确认
- AND 显示待审批内容摘要
- AND 记录审批人和时间

**审批交互:**

```
🚦 门禁: gate-design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

待审批内容:
- 技术方案: design.md
- 依赖分析: dependencies.md

请确认是否通过设计评审？[Y/n/查看详情]
```

**Acceptance Criteria:**
- [ ] AC-010: 清晰展示待审批内容
- [ ] AC-011: 支持查看详情选项
- [ ] AC-012: 记录审批决策

### REQ-005: 门禁报告

The system SHALL generate gate validation reports.

**Scenario: 生成门禁报告**
- WHEN 完成一次门禁验证
- THEN 生成详细报告
- AND 包含每条规则的结果

**报告格式:**

```markdown
# 门禁报告: gate-test

> 状态: ✅ 通过
> 时间: 2025-01-01 14:30:00
> 耗时: 45s

## 验证结果

| 规则 | 结果 | 详情 |
|------|------|------|
| npm test | ✅ | 23 tests passed |
| coverage > 80% | ✅ | 实际 85% |
| no console.log | ✅ | 无违规 |

## 下一步

可以进入「文档」阶段
```

**Acceptance Criteria:**
- [ ] AC-013: Markdown 格式报告
- [ ] AC-014: 包含每条规则详情
- [ ] AC-015: 提示下一步操作

### REQ-006: 门禁配置

The system SHALL support gate configuration.

**配置示例:**

```yaml
gates:
  gate-test:
    name: "测试门禁"
    rules:
      - type: command_success
        cmd: "npm test"
        timeout: 300
      - type: metric_threshold
        metric: coverage
        threshold: 80
        operator: ">="
    on_failure:
      - notify: "测试未通过"
      - suggest: "请检查失败的测试用例"
```

**Scenario: 加载门禁配置**
- WHEN 读取 `.seed/gates.yaml` 配置
- THEN 解析并注册所有门禁定义
- AND 验证配置格式正确性

**Acceptance Criteria:**
- [ ] AC-016: YAML 格式配置
- [ ] AC-017: 支持默认门禁 + 自定义门禁
- [ ] AC-018: 配置验证和错误提示

## 导出接口

```javascript
module.exports = {
  // 门禁管理
  loadGates,             // (configPath) => GateDefinition[]
  getGate,               // (gateName) => GateDefinition
  registerGate,          // (gateDefinition) => void

  // 验证执行
  validateGate,          // (gateName, context) => ValidationResult
  executeRule,           // (rule, context) => RuleResult

  // 流程控制
  canTransition,         // (fromStage, toStage) => boolean
  forceTransition,       // (fromStage, toStage, reason) => void

  // 报告生成
  generateGateReport,    // (validationResult) => string

  // 人工审批
  requestApproval,       // (gateName, content) => Promise<boolean>
  recordApproval,        // (gateName, approved, approver) => void
};
```

## 配置项

```json
{
  "phaseGate": {
    "configFile": ".seed/gates.yaml",
    "strictMode": true,
    "allowForceSkip": true,
    "reportDir": "output/gates/",
    "defaultTimeout": 300
  }
}
```

## 依赖

- `workflow/flow-router.js` - 工作流阶段
- `core/task-sync.js` - 任务状态

## 测试要点

1. 各类规则验证正确性
2. 门禁阻止/通过逻辑
3. 配置加载和解析
4. 人工审批流程
5. 报告生成格式
