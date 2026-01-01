# Phase Gate (阶段门禁)

> 工作流阶段转换验证门禁

## 概述

在工作流的每个阶段转换点设置验证门禁，确保前一阶段的产出满足质量要求后才能进入下一阶段。

## 安装

```javascript
const {
  loadGates,
  getGate,
  registerGate,
  validateGate,
  executeRule,
  canTransition,
  forceTransition,
  generateGateReport,
  requestApproval,
  recordApproval
} = require('mob-seed/lib/quality/phase-gate');
```

## API

### loadGates(configPath)

加载门禁配置。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| configPath | string | 配置文件路径 |

**返回:** `GateDefinition[]` - 门禁定义列表

### getGate(gateName)

获取门禁定义。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gateName | string | 门禁名称 |

**返回:** `GateDefinition`

### registerGate(gateDefinition)

注册自定义门禁。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gateDefinition | object | 门禁定义 |

**返回:** void

**示例:**

```javascript
registerGate({
  name: 'gate-custom',
  rules: [
    { type: 'file_exists', path: 'README.md' }
  ]
});
```

### validateGate(gateName, context)

执行门禁验证。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gateName | string | 门禁名称 |
| context | object | 验证上下文 |

**返回:**

```javascript
{
  gateName: string,
  passed: boolean,
  timestamp: Date,
  duration: number,
  results: [
    {
      rule: string,
      passed: boolean,
      message: string
    }
  ]
}
```

### executeRule(rule, context)

执行单条规则。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| rule | RuleDefinition | 规则定义 |
| context | object | 验证上下文 |

**返回:**

```javascript
{
  passed: boolean,
  message: string,
  details: object
}
```

### canTransition(fromStage, toStage)

检查是否可以转换阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fromStage | string | 来源阶段 |
| toStage | string | 目标阶段 |

**返回:** `boolean`

### forceTransition(fromStage, toStage, reason)

强制跳过门禁转换阶段。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fromStage | string | 来源阶段 |
| toStage | string | 目标阶段 |
| reason | string | 跳过原因 |

**返回:** void

### generateGateReport(validationResult)

生成门禁报告。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| validationResult | ValidationResult | 验证结果 |

**返回:** `string` - Markdown 报告

### requestApproval(gateName, content)

请求人工审批。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gateName | string | 门禁名称 |
| content | object | 待审批内容 |

**返回:** `Promise<boolean>` - 审批结果

### recordApproval(gateName, approved, approver)

记录审批决策。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| gateName | string | 门禁名称 |
| approved | boolean | 是否通过 |
| approver | string | 审批人 |

**返回:** void

## Standard Flow 门禁

| 转换 | 门禁名称 | 验证内容 |
|------|----------|----------|
| 分析->设计 | gate-analysis | 任务已拆解、无歧义 |
| 设计->实现 | gate-design | 方案可行、依赖明确 |
| 实现->测试 | gate-implement | 代码完成、可编译 |
| 测试->文档 | gate-test | 测试通过、覆盖率达标 |
| 文档->完成 | gate-document | 文档同步、完整 |

## Full Flow 额外门禁

| 转换 | 门禁名称 | 验证内容 |
|------|----------|----------|
| 研究->规格 | gate-research | 理解充分、方向明确 |
| 规格->设计 | gate-spec | fspec 完整、无模糊词 |
| 文档->评审 | gate-document | 文档完整 |
| 评审->归档 | gate-review | 评审通过 |

## 规则类型

| 类型 | 说明 | 示例 |
|------|------|------|
| file_exists | 文件存在性 | tasks.md 必须存在 |
| file_content | 文件内容 | fspec 无 TODO 标记 |
| command_success | 命令执行成功 | npm test 通过 |
| metric_threshold | 指标阈值 | 覆盖率 > 80% |
| human_approval | 人工审批 | 设计评审通过 |

## 配置示例

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

## 报告示例

```markdown
# 门禁报告: gate-test

> 状态: 通过
> 时间: 2025-01-01 14:30:00
> 耗时: 45s

## 验证结果

| 规则 | 结果 | 详情 |
|------|------|------|
| npm test | OK | 23 tests passed |
| coverage > 80% | OK | 实际 85% |
| no console.log | OK | 无违规 |

## 下一步

可以进入「文档」阶段
```

## 审批交互示例

```
门禁: gate-design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

待审批内容:
- 技术方案: design.md
- 依赖分析: dependencies.md

请确认是否通过设计评审？[Y/n/查看详情]
```

## 相关链接

- [规格文件](../../openspec/specs/quality/phase-gate.fspec.md)
- [源代码](../../skills/mob-seed/lib/quality/phase-gate.js)
- [测试](../../skills/mob-seed/test/quality/phase-gate.test.js)
