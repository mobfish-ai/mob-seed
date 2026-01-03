# ACE: 规格自演化能力

> Agentic Context Engineering - 让系统从执行反馈中学习并演化规格

## 什么是 ACE？

ACE (Agentic Context Engineering) 是一种让系统能够从执行反馈中学习并演化自身规格的方法论。它是 SEED 方法论的闭环扩展，将执行中的失败、偏离、反馈转化为规格的持续改进。

### 核心理念

传统开发流程：
```
规格 → 代码 → 测试 → 失败 → 手动分析 → 手动修复
```

SEED + ACE 流程：
```
规格 → 代码 → 测试 → 失败 → 自动观察 → 模式识别 → 规格演化
```

ACE 让系统能够：
- 从重复的测试失败中识别模式
- 从规格偏离中发现设计缺陷
- 从用户反馈中提取改进建议
- 自动生成规格修订提案

## 核心概念

### 观察 (Observation)

**定义**: 从执行结果中提取的轻量级信号，记录"发生了什么"。

**信号来源**:
| 来源 | 说明 | 触发方式 |
|------|------|----------|
| test_failure | 测试失败 | Execute 自动记录 |
| spec_drift | 规格偏离 | Defend 自动检测 |
| coverage_gap | 覆盖率缺口 | Execute 自动记录 |
| user_feedback | 用户反馈 | 手动添加 |

**观察结构**:
```json
{
  "id": "obs-20250101-001",
  "type": "test_failure",
  "description": "测试 X 在 CI 中间歇性失败",
  "context": {
    "file": "test/auth.test.js",
    "test_name": "should handle concurrent login",
    "error_message": "Timeout exceeded"
  },
  "created": "2025-01-01T10:30:00Z",
  "related_spec": "auth.fspec.md"
}
```

**收集方式**:
- **自动收集**: Execute 和 Defend 命令自动记录失败
- **手动添加**: `/mob-seed:spec observe "描述"`

### 反思 (Reflection)

**定义**: 对多个观察进行模式分析，识别"为什么会发生"。

**模式识别维度**:
| 维度 | 说明 | 阈值 |
|------|------|------|
| 类型聚合 | 同类型观察累积 | 3 次 |
| 规格聚合 | 同规格相关观察 | 2 次 |
| 时间窗口 | 短时间内密集观察 | 24 小时 |

**反思结构**:
```json
{
  "id": "ref-20250101-001",
  "trigger": {
    "type": "rule_match",
    "rule": "same_type >= 3"
  },
  "observations": ["obs-001", "obs-002", "obs-003"],
  "pattern": "test_failure",
  "lesson": "并发测试缺少超时配置",
  "suggested_actions": [
    "在 test 配置中添加默认超时",
    "更新规格明确并发测试要求"
  ]
}
```

**触发方式**:
- **自动触发**: 达到阈值时自动分析
- **手动触发**: `/mob-seed:spec reflect`

### 整合 (Curation)

**定义**: 将观察和反思中的洞察转化为规格修订提案。

**整合流程**:
```
观察收集 → 模式识别 → 反思生成 → 人工审核 → 规格更新
```

**输出格式**:
- 自动生成 Delta 语法的规格修订
- 标注修订来源（观察 ID、反思 ID）
- 需要人工审核确认

**整合命令**:
- `/mob-seed:spec promote <reflection-id>`: 将反思升级为正式提案

## 与 SEED 的关系

ACE 是 SEED 的闭环扩展，形成完整的自演化循环：

```
┌───────────────────────────────────────────────────────────────────┐
│                        SEED + ACE 循环                             │
│                                                                    │
│   Spec ──────► Emit ──────► Execute ──────► Defend                │
│    ▲                           │              │                   │
│    │                           ▼              ▼                   │
│    │                    ┌──────────────────────────┐              │
│    │                    │ Observe (收集信号)        │              │
│    │                    └───────────┬──────────────┘              │
│    │                                ▼                              │
│    │                    ┌──────────────────────────┐              │
│    │                    │ Reflect (识别模式)        │              │
│    │                    └───────────┬──────────────┘              │
│    │                                ▼                              │
│    │                    ┌──────────────────────────┐              │
│    └────────────────────│ Curate (演化规格)         │              │
│                         └──────────────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

### 职责分工

| 组件 | SEED 职责 | ACE 扩展 |
|------|-----------|----------|
| Spec | 定义规格 | 接收改进提案 |
| Emit | 派生代码 | - |
| Execute | 运行测试 | 收集失败观察 |
| Defend | 检查同步 | 收集偏离观察 |
| Observe | - | 收集执行信号 |
| Reflect | - | 分析模式 |
| Curate | - | 提出改进 |

## 使用场景

### 1. 测试失败模式识别

**场景**: CI 中某个测试反复失败，但本地通过。

**ACE 流程**:
1. Execute 自动记录每次失败（观察）
2. 累积 3 次后触发反思
3. 反思识别模式："并发测试缺少超时配置"
4. 生成规格修订建议
5. 开发者审核后更新规格

### 2. 规格偏离追踪

**场景**: 代码实现逐渐偏离原始规格设计。

**ACE 流程**:
1. Defend 检测规格与代码不一致（观察）
2. 收集多次偏离后触发反思
3. 反思识别模式："需求变更未同步到规格"
4. 提示更新规格或回退代码

### 3. 用户反馈积累

**场景**: 用户多次报告类似问题。

**ACE 流程**:
1. 开发者手动添加观察 `/mob-seed:spec observe`
2. 累积后触发反思
3. 识别根本原因
4. 生成规格改进提案

## 目录结构

```
.seed/
├── config.json              # ACE 配置
├── observations/            # 观察记录
│   ├── index.json          # 索引
│   └── obs-{id}.md         # 单个观察
├── reflections/             # 反思记录
│   ├── index.json          # 索引
│   └── ref-{id}.md         # 单个反思
└── learning/                # 模式学习
    └── patterns.json        # 历史模式
```

## 配置说明

在 `.seed/config.json` 中配置 ACE 行为：

```json
{
  "ace": {
    "enabled": true,
    "sources": {
      "core": ["test_failure", "spec_drift", "coverage_gap", "user_feedback"],
      "extensions": []
    },
    "reflect": {
      "auto_trigger": true,
      "thresholds": {
        "same_type": 3,
        "same_spec": 2,
        "time_window_hours": 24
      }
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| ace.enabled | boolean | true | 是否启用 ACE |
| ace.sources.core | array | [...] | 核心信号来源 |
| ace.reflect.auto_trigger | boolean | true | 自动触发反思 |
| ace.reflect.thresholds.same_type | number | 3 | 同类型观察阈值 |
| ace.reflect.thresholds.same_spec | number | 2 | 同规格观察阈值 |
| ace.reflect.thresholds.time_window_hours | number | 24 | 时间窗口（小时） |

## 命令参考

| 命令 | 说明 |
|------|------|
| `/mob-seed:spec observe` | 手动添加观察 |
| `/mob-seed:spec triage` | 归类观察 |
| `/mob-seed:spec reflect` | 触发反思分析 |
| `/mob-seed:spec promote` | 将反思升级为提案 |

## 相关文档

- [SEED 方法论](./seed-methodology.md)
- [OpenSpec 生命周期](./openspec-lifecycle.md)
