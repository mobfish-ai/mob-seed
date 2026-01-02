# Feature: 观察自动收集器

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/

## 概述 (Overview)

实现从 Execute 和 Defend 阶段自动收集观察的机制。当测试失败、覆盖率不足、规格偏离时，自动创建对应的观察记录。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 收集器作为 Execute/Defend 的后处理钩子运行
- 自动创建的观察 source 字段为 `auto:execute` 或 `auto:defend`
- 避免重复收集相同的信号

---

## ADDED Requirements

### REQ-001: Execute 阶段观察收集

The system SHALL automatically collect observations from test execution results.

**Scenario: 测试失败时收集观察**
- GIVEN 运行 `/mob-seed:exec` 测试
- WHEN 某个测试用例失败
- THEN 创建 type=test_failure 的观察

**Scenario: 覆盖率不足时收集观察**
- GIVEN 运行测试并收集覆盖率
- WHEN 某个 AC 未被测试覆盖
- THEN 创建 type=coverage_gap 的观察

**收集逻辑**:

```javascript
/**
 * 从测试结果收集观察
 * @param {TestResult} result - 测试执行结果
 * @returns {Observation[]} 收集到的观察列表
 */
function collectFromExecute(result) {
  const observations = [];

  // 收集测试失败
  for (const failure of result.failures) {
    observations.push({
      type: 'test_failure',
      source: 'auto:execute',
      description: failure.message,
      context: {
        testFile: failure.file,
        testName: failure.name,
        error: failure.error,
        runId: result.runId
      }
    });
  }

  // 收集覆盖率缺口
  for (const gap of result.coverageGaps) {
    observations.push({
      type: 'coverage_gap',
      source: 'auto:execute',
      description: `AC ${gap.acId} 未被测试覆盖`,
      context: {
        specFile: gap.specFile,
        acId: gap.acId,
        runId: result.runId
      }
    });
  }

  return observations;
}
```

**Acceptance Criteria:**
- [ ] AC-001: 实现 collectFromExecute(result) 函数
- [ ] AC-002: 测试失败时创建 test_failure 观察
- [ ] AC-003: 覆盖率不足时创建 coverage_gap 观察
- [ ] AC-004: 观察包含 runId 用于追溯

---

### REQ-002: Defend 阶段观察收集

The system SHALL automatically collect observations from spec-code sync checks.

**Scenario: 规格偏离时收集观察**
- GIVEN 运行 `/mob-seed:defend` 检查
- WHEN 检测到代码与规格不同步
- THEN 创建 type=spec_drift 的观察

**收集逻辑**:

```javascript
/**
 * 从同步检查结果收集观察
 * @param {DefendResult} result - Defend 检查结果
 * @returns {Observation[]} 收集到的观察列表
 */
function collectFromDefend(result) {
  const observations = [];

  for (const drift of result.drifts) {
    observations.push({
      type: 'spec_drift',
      source: 'auto:defend',
      spec: drift.specFile,
      description: drift.message,
      context: {
        specFile: drift.specFile,
        codeFile: drift.codeFile,
        driftType: drift.type, // 'missing_code' | 'extra_code' | 'signature_mismatch'
        details: drift.details
      }
    });
  }

  return observations;
}
```

**Acceptance Criteria:**
- [ ] AC-005: 实现 collectFromDefend(result) 函数
- [ ] AC-006: 规格偏离时创建 spec_drift 观察
- [ ] AC-007: 观察包含偏离类型和详情

---

### REQ-003: 观察去重机制

The system SHALL prevent duplicate observations for the same signal.

**Scenario: 相同信号不重复收集**
- GIVEN 已存在一个 test_failure 观察（test-abc 失败）
- WHEN 再次运行测试，test-abc 再次失败
- THEN 不创建新观察，而是更新已有观察的 context

**去重规则**:

| 观察类型 | 唯一键 |
|---------|--------|
| test_failure | testFile + testName |
| coverage_gap | specFile + acId |
| spec_drift | specFile + codeFile + driftType |

```javascript
/**
 * 检查是否已存在相同观察
 * @param {Observation} obs - 待检查的观察
 * @param {Observation[]} existing - 已存在的观察列表
 * @returns {Observation|null} 已存在的观察，或 null
 */
function findDuplicate(obs, existing) {
  // Claude 应该根据去重规则实现此函数
}
```

**Acceptance Criteria:**
- [ ] AC-008: 实现 findDuplicate(obs, existing) 函数
- [ ] AC-009: 相同信号不创建重复观察
- [ ] AC-010: 重复信号更新已有观察的 updated 时间戳

---

### REQ-004: 收集器集成接口

The system SHALL provide integration points for Execute and Defend commands.

**Scenario: Execute 命令集成**
- GIVEN 执行 `/mob-seed:exec`
- WHEN 测试完成
- THEN 自动调用收集器处理结果

**集成接口**:

```javascript
/**
 * 观察收集器
 * @class ObservationCollector
 */
class ObservationCollector {
  constructor(config) {
    this.observationsDir = config.observationsDir || '.seed/observations';
  }

  /**
   * 处理 Execute 结果
   * @param {TestResult} result
   * @returns {Promise<CollectResult>}
   */
  async processExecuteResult(result) {
    // 1. 收集观察
    // 2. 去重检查
    // 3. 保存新观察
    // 4. 更新索引
  }

  /**
   * 处理 Defend 结果
   * @param {DefendResult} result
   * @returns {Promise<CollectResult>}
   */
  async processDefendResult(result) {
    // 类似 processExecuteResult
  }
}
```

**Acceptance Criteria:**
- [ ] AC-011: 实现 ObservationCollector 类
- [ ] AC-012: 提供 processExecuteResult 方法
- [ ] AC-013: 提供 processDefendResult 方法
- [ ] AC-014: 返回收集结果（新增数、更新数、跳过数）

---

### REQ-005: 收集结果报告

The system SHALL report collection results to the user.

**Scenario: 显示收集统计**
- GIVEN 运行 `/mob-seed:exec` 完成
- WHEN 收集器处理完结果
- THEN 显示收集统计摘要

**输出格式**:

```
📊 观察收集完成
  新增: 3 条 (2 test_failure, 1 coverage_gap)
  更新: 1 条
  跳过: 0 条 (无重复)

💡 运行 `/mob-seed:spec observe --list` 查看详情
```

**Acceptance Criteria:**
- [ ] AC-015: 实现收集结果格式化输出
- [ ] AC-016: 显示分类统计（按类型）
- [ ] AC-017: 提示用户查看详情的命令

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/observation-collector.js | 收集器实现 |
| 测试 | skills/mob-seed/test/ace/observation-collector.test.js | 单元测试 |
| 文档 | docs/api/observation-collector.md | API 文档 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md
- 被依赖: spec-exec-command（集成）, spec-defend-command（集成）
