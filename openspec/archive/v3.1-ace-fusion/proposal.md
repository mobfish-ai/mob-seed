# v3.1 ACE 无缝融合提案

> 状态: archived
> 归档日期: 2026-01-03
> 版本: 3.1.0
> 创建: 2026-01-03
> 作者: Claude + User

## 概述

将 ACE（Agentic Context Engineering）从可选功能升级为基础设施，实现真正的无缝融合。

**核心目标**: 任何使用 mob-seed 的用户和项目都能自动享受 ACE 自演进机制的好处。

## 动机

当前 ACE 实现存在以下问题：

1. **依赖 Claude 加载 ace.md** - 如果没加载，ACE 不会触发
2. **命令层未集成** - exec/defend 命令没有调用 ACE 收集器
3. **缺乏强制机制** - 没有程序化保障确保 ACE 始终运行
4. **项目隔离** - 只在 mob-seed 自身项目有效，其他项目无法受益

## 目标

让 ACE 像空气一样存在：
- **项目无关**: 任何使用 mob-seed 的项目自动生效
- **零配置**: 用户不需要了解 ACE 就能受益
- **自动激活**: 无需用户主动调用或记得
- **持续进化**: 系统从每个项目的经验中学习

## 设计方案

### 项目无关机制

```
┌─────────────────────────────────────────────────────────────────┐
│  用户项目 A          用户项目 B          用户项目 C              │
│  (web app)          (CLI tool)         (library)              │
│       │                  │                  │                  │
│       ▼                  ▼                  ▼                  │
│  /mob-seed:init     /mob-seed:init     /mob-seed:init         │
│       │                  │                  │                  │
│       ▼                  ▼                  ▼                  │
│  .seed/             .seed/             .seed/                  │
│  ├─ observations/   ├─ observations/   ├─ observations/       │
│  ├─ reflections/    ├─ reflections/    ├─ reflections/        │
│  └─ learning/       └─ learning/       └─ learning/           │
│       │                  │                  │                  │
│       └──────────────────┴──────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│              mob-seed SKILL.md 定义 ACE 核心行为                │
│              (Claude 加载技能时自动激活 ACE)                    │
└─────────────────────────────────────────────────────────────────┘
```

**关键点**:
1. `/mob-seed:init` 自动创建 ACE 目录结构（零配置）
2. SKILL.md 定义 ACE 为不可违反的核心行为（自动激活）
3. 每个项目独立的 `.seed/` 目录（项目隔离）
4. 命令执行时自动调用 ACE（无感知）

### 四层融合机制

| 层级 | 名称 | 作用 | 强制程度 |
|------|------|------|----------|
| L1 | Skill 核心层 | SKILL.md 定义 ACE 为核心行为 | 最强 |
| L2 | 命令嵌入层 | 每个命令末尾调用 ACE 收集器 | 强 |
| L3 | 对话拦截层 | 智能入口分析用户输入 | 中 |
| L4 | Hooks 保障层 | Git 操作时检查 ACE 状态 | 强 |

### 触发矩阵

| 触发源 | 触发条件 | 观察类型 | 实现层 |
|--------|----------|----------|--------|
| /mob-seed:exec | 测试失败 | test_failure | L2 |
| /mob-seed:exec | 覆盖率缺口 | coverage_gap | L2 |
| /mob-seed:defend | 规格漂移 | spec_drift | L2 |
| 用户对话 | "又"、"再次" | pattern_detected | L3 |
| 用户对话 | "问题"、"错误" | user_feedback | L3 |
| git commit | 有待处理观察 | - | L4 |
| git push | 达到反思阈值 | - | L4 |

## 规格清单

1. `ace-skill-integration.fspec.md` - L1 Skill 核心层
2. `ace-command-embedding.fspec.md` - L2 命令嵌入层
3. `ace-conversation-intercept.fspec.md` - L3 对话拦截层
4. `ace-hooks.fspec.md` - L4 Hooks 保障层

## 验收标准

### 项目无关验收

- [x] AC-001: `/mob-seed:init` 自动创建 `.seed/observations/`, `.seed/reflections/`, `.seed/learning/`
- [x] AC-002: 新项目初始化后无需额外配置即可使用 ACE
- [x] AC-003: ACE 配置有合理默认值，无需用户干预

### 自动激活验收

- [x] AC-004: SKILL.md 包含 ACE 核心行为定义（不可违反）
- [x] AC-005: exec.md 末尾自动调用 ACE 收集器
- [x] AC-006: defend.md 末尾自动调用 ACE 收集器
- [x] AC-007: seed.md 智能入口包含用户输入分析

### Hooks 保障验收

- [x] AC-008: pre-commit hook 检查 ACE 观察状态
- [x] AC-009: pre-push hook 检查反思阈值

### 测试验收

- [x] AC-010: 测试覆盖所有触发场景
- [x] AC-011: 新项目初始化端到端测试通过
