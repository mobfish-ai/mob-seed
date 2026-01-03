# Feature: LLM 辅助反思

> 状态: archived
> 归档日期: 2026-01-03
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/ace/
> 优先级: Phase 4 (v3.1+)

## 概述 (Overview)

使用 LLM 增强反思能力，从观察中提取更深层次的洞察和模式。

### 目标用户

- 使用 mob-seed 的开发者
- 需要更智能分析的项目

### 业务约束

- LLM 调用为可选功能
- 需要配置 API 密钥
- 本地/云端模型可选
- 用户确认后才采纳建议

---

## ADDED Requirements

### REQ-001: LLM 提供商抽象

The system SHALL support multiple LLM providers through abstraction.

**提供商接口**:

```javascript
/**
 * LLM 提供商接口
 * @interface LLMProvider
 */
interface LLMProvider {
  /**
   * 分析观察并生成反思
   * @param {Observation[]} observations - 观察列表
   * @param {Object} context - 项目上下文
   * @returns {Promise<ReflectionCandidate[]>}
   */
  analyzeObservations(observations, context);

  /**
   * 生成提案建议
   * @param {Reflection} reflection - 反思
   * @returns {Promise<ProposalSuggestion>}
   */
  suggestProposal(reflection);
}
```

**支持的提供商**:

| 提供商 | 类型 | 配置 |
|--------|------|------|
| OpenAI | 云端 | `ace.llm.provider: "openai"` |
| Anthropic | 云端 | `ace.llm.provider: "anthropic"` |
| Ollama | 本地 | `ace.llm.provider: "ollama"` |
| Mock | 测试 | `ace.llm.provider: "mock"` |

**Acceptance Criteria:**
- [x] AC-001: 定义 LLMProvider 接口
- [x] AC-002: 实现 OpenAI 适配器
- [x] AC-003: 实现 Anthropic 适配器
- [x] AC-004: 实现 Ollama 本地适配器
- [x] AC-005: 提供 Mock 适配器用于测试

---

### REQ-002: 配置支持

The system SHALL support LLM configuration in config.json.

**配置结构**:

```json
{
  "ace": {
    "llm": {
      "enabled": false,
      "provider": "openai",
      "model": "gpt-4o-mini",
      "api_key_env": "OPENAI_API_KEY",
      "options": {
        "temperature": 0.3,
        "max_tokens": 1000
      },
      "fallback": "rule-based"
    }
  }
}
```

**配置说明**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| llm.enabled | boolean | false | 是否启用 LLM |
| llm.provider | string | "openai" | 提供商名称 |
| llm.model | string | 提供商默认 | 模型名称 |
| llm.api_key_env | string | - | API 密钥环境变量名 |
| llm.fallback | string | "rule-based" | 失败时回退策略 |

**Acceptance Criteria:**
- [x] AC-006: 支持 LLM 配置读取
- [x] AC-007: API 密钥从环境变量读取
- [x] AC-008: 配置校验（必填项检查）
- [x] AC-009: 提供合理默认值

---

### REQ-003: 观察分析增强

The system SHALL use LLM to analyze observations when enabled.

**分析流程**:

```
┌─────────────────────────────────────────┐
│  LLM 增强反思流程                        │
├─────────────────────────────────────────┤
│                                         │
│  1. 收集 triaged 观察                   │
│  2. 构建分析提示词                       │
│  3. 调用 LLM API                        │
│  4. 解析 LLM 响应                       │
│  5. 与规则匹配结果合并                   │
│  6. 去重和排序                          │
│  7. 返回候选反思                        │
│                                         │
└─────────────────────────────────────────┘
```

**提示词模板**:

```markdown
## 任务

分析以下软件开发观察记录，识别潜在的系统性问题和改进机会。

## 观察列表

{{observations}}

## 项目上下文

- 项目名称: {{project_name}}
- 技术栈: {{tech_stack}}
- 核心规格: {{specs}}

## 输出格式

请返回 JSON 格式的反思建议:

```json
{
  "reflections": [
    {
      "pattern": "模式名称",
      "confidence": 0.85,
      "lesson": "发现的教训",
      "observations": ["obs-001", "obs-002"],
      "suggested_actions": ["行动1", "行动2"]
    }
  ]
}
```
```

**Acceptance Criteria:**
- [x] AC-010: 实现提示词模板
- [x] AC-011: 支持上下文注入
- [x] AC-012: 解析 LLM JSON 响应
- [x] AC-013: 处理格式错误响应
- [x] AC-014: 与规则匹配结果合并

---

### REQ-004: 回退机制

The system SHALL fallback to rule-based when LLM fails.

**回退触发条件**:

| 条件 | 回退行为 |
|------|---------|
| LLM 未配置 | 直接使用规则匹配 |
| API 调用失败 | 使用规则匹配 + 警告 |
| 响应解析失败 | 使用规则匹配 + 警告 |
| 超时 (30s) | 使用规则匹配 + 警告 |

**回退流程**:

```javascript
async function analyzeWithFallback(observations) {
  if (!config.ace.llm.enabled) {
    return ruleBasedAnalysis(observations);
  }

  try {
    const llmResult = await llmProvider.analyzeObservations(observations);
    return mergeResults(llmResult, ruleBasedAnalysis(observations));
  } catch (error) {
    console.warn(`LLM 分析失败，回退到规则匹配: ${error.message}`);
    return ruleBasedAnalysis(observations);
  }
}
```

**Acceptance Criteria:**
- [x] AC-015: LLM 禁用时使用规则匹配
- [x] AC-016: API 失败时自动回退
- [x] AC-017: 记录回退原因
- [x] AC-018: 回退后继续正常流程

---

### REQ-005: 结果合并策略

The system SHALL merge LLM and rule-based results intelligently.

**合并策略**:

```javascript
function mergeResults(llmResults, ruleResults) {
  const merged = [];
  const seen = new Set();

  // 1. 添加高置信度 LLM 结果
  for (const r of llmResults) {
    if (r.confidence >= 0.7) {
      merged.push({ ...r, source: 'llm' });
      seen.add(r.observations.sort().join(','));
    }
  }

  // 2. 添加规则匹配结果（不重复）
  for (const r of ruleResults) {
    const key = r.observations.sort().join(',');
    if (!seen.has(key)) {
      merged.push({ ...r, source: 'rule' });
    }
  }

  // 3. 按置信度排序
  return merged.sort((a, b) => b.confidence - a.confidence);
}
```

**合并规则**:
- LLM 高置信度 (≥0.7) 结果优先
- 相同观察集合的结果去重
- 保留来源标记 (llm/rule)
- 按置信度降序排列

**Acceptance Criteria:**
- [x] AC-019: 实现结果合并逻辑
- [x] AC-020: 去除重复候选
- [x] AC-021: 保留来源标记
- [x] AC-022: 按置信度排序

---

### REQ-006: 用户确认增强

The system SHALL show LLM source in reflection candidates.

**显示增强**:

```
💡 发现 3 个反思建议

[1] 类型聚合: test_failure (3 个观察) [规则匹配]
    置信度: 85%
    教训: 项目缺乏统一的空值处理策略
    ...

[2] 深层模式: null 与 undefined 混用 [LLM 分析] 🤖
    置信度: 78%
    教训: 代码库中 null 和 undefined 使用不一致，
          建议统一为 null 或采用 Optional 模式
    观察: obs-001, obs-002, obs-004
    操作: [a] 接受  [r] 拒绝  [s] 跳过  [d] 详情
```

**详情视图**:

```
[d] 查看 LLM 分析详情

📊 分析依据:
- 观察 obs-001: TypeError: undefined is not...
- 观察 obs-002: null check failed
- 观察 obs-004: Expected null, got undefined

🤖 LLM 推理:
"这三个错误都涉及空值处理，但使用了不同的空值表示。
 obs-001 期望值但收到 undefined，obs-002 显式检查 null，
 obs-004 表明存在类型混淆。建议制定统一的空值策略。"

📝 建议行动:
1. 在 mission.md 添加空值处理规范
2. 使用 ESLint 规则强制一致性
3. 创建 isNil() 工具函数统一处理
```

**Acceptance Criteria:**
- [x] AC-023: 显示来源标记 (规则/LLM)
- [x] AC-024: 支持 [d] 详情查看
- [x] AC-025: 显示 LLM 推理过程
- [x] AC-026: 显示完整建议行动

---

### REQ-007: 成本和限流控制

The system SHALL implement cost and rate limiting controls.

**控制措施**:

```json
{
  "ace": {
    "llm": {
      "limits": {
        "max_observations_per_call": 10,
        "max_calls_per_day": 50,
        "min_interval_seconds": 60
      }
    }
  }
}
```

**限流逻辑**:

```javascript
class LLMRateLimiter {
  async checkLimit() {
    const today = new Date().toISOString().slice(0, 10);
    const usage = await this.getUsage(today);

    if (usage.calls >= this.config.max_calls_per_day) {
      throw new Error('已达到每日调用限制');
    }

    const lastCall = await this.getLastCallTime();
    const elapsed = Date.now() - lastCall;
    if (elapsed < this.config.min_interval_seconds * 1000) {
      const wait = this.config.min_interval_seconds - elapsed / 1000;
      throw new Error(`请等待 ${wait.toFixed(0)} 秒后重试`);
    }
  }
}
```

**Acceptance Criteria:**
- [x] AC-027: 限制每次调用的观察数量
- [x] AC-028: 限制每日调用次数
- [x] AC-029: 实现调用间隔控制
- [x] AC-030: 超限时给出明确提示

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ace/llm-provider.js | LLM 提供商接口 |
| 代码 | skills/mob-seed/lib/ace/providers/openai.js | OpenAI 适配器 |
| 代码 | skills/mob-seed/lib/ace/providers/anthropic.js | Anthropic 适配器 |
| 代码 | skills/mob-seed/lib/ace/providers/ollama.js | Ollama 适配器 |
| 代码 | skills/mob-seed/lib/ace/llm-analyzer.js | LLM 分析器 |
| 测试 | skills/mob-seed/test/ace/llm-analyzer.test.js | 单元测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: pattern-matcher.fspec.md, reflect-handler.fspec.md
- 被依赖: auto-propose.fspec.md
