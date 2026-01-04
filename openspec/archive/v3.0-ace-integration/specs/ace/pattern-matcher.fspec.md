---
status: archived
archived: 2026-01-02
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/ace/
---
# Feature: 规则匹配式反思
## 概述 (Overview)

实现基于规则的模式匹配，从多个观察中自动识别共性模式，生成反思建议。

### 目标用户

- 使用 mob-seed 的开发者
- mob-seed 框架本身

### 业务约束

- 模式匹配基于可配置的阈值
- 支持多种聚合策略
- 输出反思建议供用户确认

---

## ADDED Requirements

### REQ-001: 类型聚合模式

The system SHALL detect patterns when multiple observations share the same type.

**触发条件**: 同一 `type` 的 triaged 观察 ≥ 阈值（默认 3）

**匹配逻辑**:

```javascript
function matchTypeAggregation(observations, threshold = 3) {
  // 1. 过滤 triaged 状态的观察
  // 2. 按 type 分组
  // 3. 找出数量 >= threshold 的分组
  // 4. 生成反思建议
}
```

**Acceptance Criteria:**
- [ ] AC-001: 实现 matchTypeAggregation() 函数
- [ ] AC-002: 只处理 triaged 状态的观察
- [ ] AC-003: 阈值可配置，默认 3
- [ ] AC-004: 返回匹配的观察分组

---

### REQ-002: 规格聚合模式

The system SHALL detect patterns when multiple observations relate to the same spec.

**触发条件**: 同一 `related_spec` 的观察 ≥ 阈值（默认 2）

**匹配逻辑**:

```javascript
function matchSpecAggregation(observations, threshold = 2) {
  // 1. 过滤有 spec 关联的观察
  // 2. 按 related_spec 分组
  // 3. 找出数量 >= threshold 的分组
  // 4. 生成反思建议
}
```

**Acceptance Criteria:**
- [ ] AC-005: 实现 matchSpecAggregation() 函数
- [ ] AC-006: 按 related_spec 字段分组
- [ ] AC-007: 阈值可配置，默认 2
- [ ] AC-008: 返回匹配的观察分组和关联规格

---

### REQ-003: 时间窗口聚合模式

The system SHALL detect patterns when multiple observations occur within a time window.

**触发条件**: 24 小时内同模块观察 ≥ 阈值（默认 2）

**匹配逻辑**:

```javascript
function matchTimeClustering(observations, windowHours = 24, threshold = 2) {
  // 1. 按模块/文件分组
  // 2. 在每个分组内按时间窗口聚合
  // 3. 找出窗口内数量 >= threshold 的分组
  // 4. 生成反思建议
}
```

**Acceptance Criteria:**
- [ ] AC-009: 实现 matchTimeClustering() 函数
- [ ] AC-010: 按 context.file 或 related_spec 确定模块
- [ ] AC-011: 时间窗口可配置，默认 24 小时
- [ ] AC-012: 返回时间窗口内的观察分组

---

### REQ-004: 关键词相似度模式

The system SHALL detect patterns based on description/error message similarity.

**触发条件**: 描述或错误信息相似度 > 阈值（默认 70%）

**匹配逻辑**:

```javascript
function matchKeywordSimilarity(observations, threshold = 0.7) {
  // 1. 提取观察的描述和错误信息
  // 2. 计算两两相似度（Jaccard 或 Levenshtein）
  // 3. 聚类相似度 > threshold 的观察
  // 4. 生成反思建议
}
```

**相似度算法选择**:

| 算法 | 适用场景 | 复杂度 |
|------|---------|--------|
| Jaccard | 词袋模型，适合短文本 | O(n) |
| Levenshtein | 字符级别，适合错误信息 | O(m*n) |

**Acceptance Criteria:**
- [ ] AC-013: 实现 matchKeywordSimilarity() 函数
- [ ] AC-014: 使用 Jaccard 相似度计算
- [ ] AC-015: 阈值可配置，默认 0.7
- [ ] AC-016: 返回相似观察的聚类

---

### REQ-005: 组合模式匹配

The system SHALL run all pattern matchers and combine results.

**执行流程**:

```
┌─────────────────────────────────────────────┐
│  Pattern Matcher Pipeline                    │
├─────────────────────────────────────────────┤
│  Input: triaged observations                 │
│                                              │
│  1. matchTypeAggregation()                   │
│  2. matchSpecAggregation()                   │
│  3. matchTimeClustering()                    │
│  4. matchKeywordSimilarity()                 │
│                                              │
│  5. Deduplicate overlapping matches          │
│  6. Rank by confidence/observation count     │
│                                              │
│  Output: ranked reflection candidates        │
└─────────────────────────────────────────────┘
```

**去重策略**: 如果同一组观察被多个模式匹配，选择置信度最高的

**Acceptance Criteria:**
- [ ] AC-017: 实现 PatternMatcher 类
- [ ] AC-018: runAllPatterns() 执行所有匹配器
- [ ] AC-019: 去除重复的匹配结果
- [ ] AC-020: 按置信度排序返回

---

### REQ-006: 反思建议生成

The system SHALL generate Reflection candidates from pattern matches.

**建议格式**:

```javascript
/**
 * 反思建议
 * @typedef {Object} ReflectionCandidate
 * @property {string} pattern - 模式类型
 * @property {string[]} observations - 匹配的观察ID
 * @property {number} confidence - 置信度 (0-1)
 * @property {string} suggestedLesson - 建议的教训描述
 * @property {string[]} suggestedActions - 建议的行动
 */
```

**教训生成规则**:

| 模式 | 教训模板 |
|------|---------|
| type_aggregation | "{count} 个 {type} 类型观察，可能需要统一处理策略" |
| spec_aggregation | "规格 {spec} 相关的 {count} 个问题，考虑修订规格" |
| time_clustering | "{module} 模块在短时间内出现 {count} 个问题" |
| keyword_similarity | "多个观察包含相似描述: {keywords}" |

**Acceptance Criteria:**
- [ ] AC-021: 实现 generateCandidate() 函数
- [ ] AC-022: 根据模式类型生成教训描述
- [ ] AC-023: 生成建议行动列表
- [ ] AC-024: 置信度基于观察数量和匹配强度

---

### REQ-007: 配置支持

The system SHALL support configurable thresholds from .seed/config.json.

**配置结构**:

```json
{
  "ace": {
    "reflect": {
      "thresholds": {
        "same_type": 3,
        "same_spec": 2,
        "time_window_hours": 24,
        "keyword_similarity": 0.7
      }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] AC-025: 从 config.json 读取阈值配置
- [ ] AC-026: 配置缺失时使用默认值
- [ ] AC-027: 支持运行时覆盖配置

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/pattern-matcher.js | 模式匹配器 |
| 测试 | skills/mob-seed/test/ace/pattern-matcher.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md, reflection.fspec.md
- 被依赖: reflect-handler.fspec.md
