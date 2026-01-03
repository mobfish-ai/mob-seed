# Feature: 历史模式学习

> 状态: draft
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/
> 优先级: Phase 4 (v3.1+)

## 概述 (Overview)

从历史反思和提案中学习模式，提升未来反思分析的准确性和效率。

### 目标用户

- 使用 mob-seed 的成熟项目
- 需要持续改进的团队

### 业务约束

- 学习基于已确认的反思 (accepted)
- 需要足够的历史数据
- 隐私安全考虑

---

## ADDED Requirements

### REQ-001: 历史数据收集

The system SHALL collect accepted reflections for pattern learning.

**收集内容**:

```javascript
/**
 * 学习样本
 * @typedef {Object} LearningSample
 * @property {string} pattern - 模式类型
 * @property {Object[]} observations - 观察特征
 * @property {string} lesson - 教训描述
 * @property {string[]} actions - 采取的行动
 * @property {boolean} effective - 是否有效解决问题
 * @property {string} outcome - 最终结果
 */
```

**收集时机**:

| 事件 | 收集内容 |
|------|---------|
| 反思被接受 | 观察特征 + 教训 + 行动 |
| 提案归档 | 标记 effective = true |
| 问题复发 | 标记 effective = false |

**Acceptance Criteria:**
- [x] AC-001: 定义学习样本结构
- [x] AC-002: 反思接受时收集样本
- [x] AC-003: 提案归档时更新有效性
- [x] AC-004: 支持手动标记问题复发

---

### REQ-002: 模式特征提取

The system SHALL extract features from observations for pattern matching.

**特征维度**:

| 维度 | 特征 | 示例 |
|------|------|------|
| 类型 | observation.type | test_failure |
| 模块 | context.file 目录 | lib/parser/ |
| 错误类型 | 从 error_message 提取 | TypeError, ReferenceError |
| 关键词 | 从 description 提取 | null, undefined, empty |
| 时间 | 创建时间相对位置 | 密集/分散 |
| 规格 | related_spec | parser.fspec.md |

**特征提取函数**:

```javascript
function extractFeatures(observation) {
  return {
    type: observation.type,
    module: extractModule(observation.context?.file),
    errorType: extractErrorType(observation.context?.error_message),
    keywords: extractKeywords(observation.description),
    timeCluster: calculateTimeCluster(observation.created),
    spec: observation.related_spec
  };
}

function extractKeywords(text) {
  const stopWords = ['the', 'a', 'an', 'is', 'are', ...];
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !stopWords.includes(w))
    .slice(0, 10);
}
```

**Acceptance Criteria:**
- [x] AC-005: 提取类型特征
- [x] AC-006: 提取模块/目录特征
- [x] AC-007: 提取错误类型特征
- [x] AC-008: 提取关键词特征
- [x] AC-009: 计算时间聚类特征

---

### REQ-003: 相似度匹配

The system SHALL match new observations against historical patterns.

**匹配算法**:

```javascript
function matchHistoricalPatterns(observations, historySamples) {
  const currentFeatures = observations.map(extractFeatures);
  const matches = [];

  for (const sample of historySamples) {
    const similarity = calculateSimilarity(currentFeatures, sample.features);

    if (similarity >= 0.6) {
      matches.push({
        sample,
        similarity,
        suggestedLesson: sample.lesson,
        suggestedActions: sample.actions,
        wasEffective: sample.effective
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

function calculateSimilarity(current, historical) {
  let score = 0;
  let weights = 0;

  // 类型匹配 (权重 0.3)
  if (hasTypeOverlap(current, historical)) {
    score += 0.3;
  }
  weights += 0.3;

  // 关键词相似度 (权重 0.3)
  score += 0.3 * jaccardSimilarity(
    extractAllKeywords(current),
    extractAllKeywords(historical)
  );
  weights += 0.3;

  // 模块匹配 (权重 0.2)
  if (hasModuleOverlap(current, historical)) {
    score += 0.2;
  }
  weights += 0.2;

  // 错误类型匹配 (权重 0.2)
  if (hasErrorTypeOverlap(current, historical)) {
    score += 0.2;
  }
  weights += 0.2;

  return score / weights;
}
```

**Acceptance Criteria:**
- [x] AC-010: 实现特征相似度计算
- [x] AC-011: 支持多维度加权匹配
- [x] AC-012: 返回相似度排序的匹配结果
- [x] AC-013: 配置相似度阈值

---

### REQ-004: 历史建议增强

The system SHALL enhance reflection candidates with historical insights.

**增强内容**:

```
💡 反思建议 [历史增强]

模式: test_failure 聚合 (3 个观察)
置信度: 85%

📚 历史参考 (相似度 78%):
┌─────────────────────────────────────────┐
│ 历史案例 ref-042 (2025-11-15)           │
│                                         │
│ 当时教训:                                │
│   "缺乏统一的错误边界处理"               │
│                                         │
│ 采取行动:                                │
│   ✅ 创建 error-boundary.fspec.md       │
│   ✅ 实现统一错误处理中间件              │
│                                         │
│ 结果: 有效 - 后续无同类问题              │
└─────────────────────────────────────────┘

建议采用类似策略处理当前问题。

操作: [a] 接受  [r] 拒绝  [s] 跳过
```

**增强逻辑**:

```javascript
function enhanceWithHistory(candidate, historicalMatches) {
  if (historicalMatches.length === 0) {
    return candidate;
  }

  const bestMatch = historicalMatches[0];

  return {
    ...candidate,
    historical: {
      reference: bestMatch.sample.id,
      similarity: bestMatch.similarity,
      previousLesson: bestMatch.sample.lesson,
      previousActions: bestMatch.sample.actions,
      wasEffective: bestMatch.sample.effective,
      date: bestMatch.sample.created
    },
    // 调整置信度
    confidence: adjustConfidence(
      candidate.confidence,
      bestMatch.similarity,
      bestMatch.sample.effective
    )
  };
}

function adjustConfidence(base, similarity, wasEffective) {
  if (wasEffective) {
    // 历史有效，提升置信度
    return Math.min(1.0, base + similarity * 0.1);
  } else {
    // 历史无效，降低置信度
    return Math.max(0.3, base - similarity * 0.1);
  }
}
```

**Acceptance Criteria:**
- [x] AC-014: 在候选中附加历史参考
- [x] AC-015: 显示历史案例详情
- [x] AC-016: 根据历史有效性调整置信度
- [x] AC-017: 显示历史策略是否有效

---

### REQ-005: 反馈闭环

The system SHALL track effectiveness and learn from outcomes.

**反馈收集**:

```
提案归档后自动询问:

📊 效果反馈: fix-null-handling

该提案已归档，请评估效果:

问题是否已解决?
  [1] 完全解决 - 无后续同类问题
  [2] 部分解决 - 问题减少但未消除
  [3] 未解决 - 问题仍然存在
  [4] 跳过评估

选择 (1-4):
```

**反馈存储**:

```javascript
// .seed/learning/feedback.json
{
  "ref-001": {
    "proposal": "fix-null-handling",
    "archived_at": "2026-01-15",
    "feedback_at": "2026-02-01",
    "effectiveness": "fully_resolved",
    "notes": "实施后 30 天无同类测试失败"
  }
}
```

**自动检测**:

```javascript
async function checkRecurrence(reflection) {
  // 检查是否有新观察与已解决反思的模式匹配
  const resolvedPatterns = await getResolvedPatterns();

  for (const pattern of resolvedPatterns) {
    const similarity = matchPattern(reflection, pattern);
    if (similarity > 0.7) {
      // 可能是问题复发
      return {
        recurrence: true,
        originalReflection: pattern.reflection_id,
        similarity
      };
    }
  }

  return { recurrence: false };
}
```

**Acceptance Criteria:**
- [x] AC-018: 归档后请求效果反馈
- [x] AC-019: 存储反馈记录
- [x] AC-020: 自动检测问题复发
- [x] AC-021: 复发时标记历史记录

---

### REQ-006: 学习数据管理

The system SHALL manage learning data storage and privacy.

**存储结构**:

```
.seed/
└── learning/
    ├── samples.json    # 学习样本
    ├── feedback.json   # 效果反馈
    └── stats.json      # 学习统计
```

**隐私保护**:

```javascript
function sanitizeSample(sample) {
  return {
    ...sample,
    // 移除敏感信息
    observations: sample.observations.map(obs => ({
      type: obs.type,
      module: obs.module,
      keywords: obs.keywords,
      // 不包含完整描述和错误信息
    })),
    // 脱敏教训描述
    lesson: generalizeLesson(sample.lesson)
  };
}
```

**数据清理**:

```javascript
// 定期清理过期数据
async function cleanupLearningData(retentionDays = 365) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const samples = await loadSamples();
  const active = samples.filter(s =>
    new Date(s.created).getTime() > cutoff ||
    s.effective === true  // 保留有效样本
  );

  await saveSamples(active);
}
```

**Acceptance Criteria:**
- [x] AC-022: 定义学习数据存储结构
- [x] AC-023: 实现敏感信息脱敏
- [x] AC-024: 支持数据过期清理
- [x] AC-025: 保留有效样本不过期

---

### REQ-007: 学习统计

The system SHALL provide learning statistics and insights.

**统计内容**:

```
📊 学习统计

样本总数: 42
有效样本: 35 (83%)
平均相似度命中: 72%

最常见模式:
  1. null_handling (12 次)
  2. error_boundary (8 次)
  3. async_await (6 次)

最有效策略:
  1. 创建统一规范 → 91% 有效
  2. 添加工具函数 → 85% 有效
  3. 增加测试覆盖 → 78% 有效

问题复发率: 8%
```

**统计命令**:

```bash
/mob-seed:spec reflect --stats
```

**Acceptance Criteria:**
- [x] AC-026: 统计样本数量和有效率
- [x] AC-027: 识别最常见模式
- [x] AC-028: 识别最有效策略
- [x] AC-029: 计算问题复发率

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/pattern-learner.js | 模式学习器 |
| 代码 | skills/mob-seed/lib/ace/feature-extractor.js | 特征提取器 |
| 代码 | skills/mob-seed/lib/ace/similarity-matcher.js | 相似度匹配 |
| 代码 | skills/mob-seed/lib/ace/feedback-collector.js | 反馈收集器 |
| 测试 | skills/mob-seed/test/ace/pattern-learner.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: reflection.fspec.md, pattern-matcher.fspec.md
- 被依赖: 无（闭环终点）
