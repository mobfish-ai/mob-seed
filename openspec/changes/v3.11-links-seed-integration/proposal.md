# v3.11 LINKS × SEED 深度整合

> **状态**: 📝 draft
> **创建**: 2026-01-30
> **版本**: v3.11.0
> **作者**: Kelvin

---

## 概述

将 LINKS 方法论与 SEED 方法论进行深度整合，实现知识驱动的规格开发流程。

**共同理念**: 都强调**单一真相源**
- SEED: 规格是代码的真相源
- LINKS: KB 是知识的真相源

**目标**: 让 SEED 的每个阶段都能从 LINKS KB 获得知识支撑，同时将 SEED 归档的经验沉淀为 LINKS 知识。

---

## 核心价值

### 1. 知识驱动的规格定义

Spec 阶段不再从零开始，而是从 KB 中检索：
- 领域知识 (`methods-kb`, `business-kb`)
- 最佳实践 (`patterns-kb`)
- 历史经验 (`ace-kb`)

### 2. 事实锚点指导代码生成

Emit 阶段的代码生成基于事实而非概率：
- 编码规范 (`coding-standards`)
- 架构模式 (`architecture-kb`)
- 禁用清单 (`standards-kb`)

### 3. 规则化守护验证

Defend 阶段的验证规则来自 KB：
- 验证规则 (`rules-kb`)
- 检查清单 (`checklist-kb`)
- 质量标准 (`quality-kb`)

### 4. 经验沉淀闭环

归档完成后自动：
- 提取实施经验
- 生成 ACE 观察/洞见
- 更新相关 KB

---

## 时序关系图

```
SEED 流程                    LINKS 支撑
─────────────────────────────────────────
S - Spec 规格定义    ◄────   领域 KB 提供背景知识
        ↓                     ├── methods-kb
        ↓                     ├── business-kb
        ↓                     └── ace-kb (历史洞见)
        ↓
E - Emit 自动派生    ◄────   最佳实践 KB 指导生成
        ↓                     ├── coding-standards
        ↓                     ├── patterns-kb
        ↓                     └── architecture-kb
        ↓
E - Execute 执行
        ↓
D - Defend 守护      ◄────   验证规则 KB 提供检查依据
        ↓                     ├── rules-kb
        ↓                     └── checklist-kb
        ↓
归档完成             ────►   沉淀为 LINKS 知识
                             ├── 生成 ACE 观察
                             ├── 提炼为洞见
                             └── 更新相关 KB
```

---

## 实现范围

### Phase 1: KB 集成框架

| 模块 | 说明 |
|------|------|
| `lib/kb/kb-resolver.js` | KB 路径解析和加载 |
| `lib/kb/kb-query.js` | KB 内容查询接口 |
| `lib/kb/kb-registry.js` | KB 注册和索引 |

### Phase 2: SEED 阶段增强

| 阶段 | 增强内容 |
|------|----------|
| Spec | 自动从 KB 加载领域背景 |
| Emit | 从 KB 获取编码规范和模式 |
| Defend | 从 KB 加载验证规则 |

### Phase 3: 经验沉淀

| 功能 | 说明 |
|------|------|
| 归档触发器 | 归档完成时触发沉淀流程 |
| 经验提取器 | 从变更中提取关键经验 |
| KB 更新器 | 自动更新相关 KB |

---

## 规格清单

| 规格文件 | 说明 |
|----------|------|
| `kb-integration.fspec.md` | KB 集成框架规格 |

---

## 依赖

- LINKS 方法论 v2.0 (`/link-method`)
- Knowledge Loop (`/knowledge-loop`)
- ACE 系统 (observations, reflections, insights)

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| KB 不存在或为空 | 优雅降级，显示"无 KB 支撑"提示 |
| KB 内容过期 | 提供 KB 更新时间戳检查 |
| 循环依赖 | 明确 KB 依赖层级，禁止循环引用 |

---

## 成功标准

1. Spec 阶段能自动加载并显示相关 KB 内容
2. Emit 阶段生成的代码符合 KB 中的编码规范
3. Defend 阶段能基于 KB 规则进行验证
4. 归档后能自动生成 ACE 观察或洞见

---

*创建: 2026-01-30 | 方法论: SEED + LINKS*
