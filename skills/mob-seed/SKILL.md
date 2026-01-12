---
name: mob-seed
description: |
  SEED 方法论驱动的统一开发工作流引擎（种子法则）
  🌱 OpenSpec 原生支持 | 规格驱动开发

  核心理念：零冗余 + 全自动
  - S: Single-source 单源定义（规格是唯一真相源）
  - E: Emit 自动派生（所有产物自动生成）
  - E: Execute 自动执行（CI/CD 自动触发）
  - D: Defend 守护规范（防御手动干预）

  触发场景：
  - 新功能开发、代码实现、规格驱动开发
  - 自动化派生（代码、测试、文档）
  - 合规检查、一致性验证

  显式触发词：
  - "SEED"、"种子法则"、"mob-seed"、"OpenSpec"
  - "规格驱动"、"自动派生"、"零冗余"、"fspec"
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite
---

# mob-seed 技能 - SEED 方法论引擎

> **OpenSpec 原生支持** | 规格驱动开发 | MIT License
>
> 📖 详细参考: [REFERENCE.md](REFERENCE.md)

---

## 核心概念

```
🌱 SEED 种子法则: "一粒种子，一棵大树，全自动生长"

规格（种子）──自动生长──► 代码 + 测试 + 文档（大树）

openspec/specs/*.fspec.md  →  src/ + test/ + docs/
```

### SEED 四原则 + ACE 自演化

| 字母 | 原则 | 核心哲学 |
|------|------|----------|
| **S** | Single-source | 每种信息只在规格中定义一次 |
| **E** | Emit | 所有产物必须从规格自动生成 |
| **E** | Execute | CI/CD 自动触发，无需人工 |
| **D** | Defend | 防御手动干预、守护自动化流程 |
| **A** | **ACE** | 系统从经验中学习，持续进化 |

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `/mob-seed` | 智能入口（状态面板 + 建议行动） |
| `/mob-seed:init` | 项目初始化 |
| `/mob-seed:spec` | S: 规格定义 |
| `/mob-seed:emit` | E: 自动派生 |
| `/mob-seed:exec` | E: 自动执行 |
| `/mob-seed:defend` | D: 守护规范 |
| `/mob-seed:archive` | 归档提案 |
| `/mob-seed:insight` | 外部洞见管理 |

### 命令架构

```
/mob-seed             # 智能入口（状态面板 + 建议行动）
├── /mob-seed:init    # 项目初始化
├── /mob-seed:spec    # S: 规格定义（含 --edit, --submit）
├── /mob-seed:emit    # E: 自动派生
├── /mob-seed:exec    # E: 自动执行
├── /mob-seed:defend  # D: 守护规范（含 --diff, --sync）
├── /mob-seed:archive # 归档提案
└── /mob-seed:insight # 外部洞见管理
```

---

## 🚀 强制启动行为（所有命令必须遵守）

> **FR-004**: 每个 mob-seed 命令执行时必须显示版本和场景信息

Claude 在执行任何 `/mob-seed:*` 命令时，**必须**在第一行输出版本信息：

```
🌱 mob-seed v3.6.1 [开发模式] mob-seed dogfooding
```

**实现方式**:

```bash
node {SKILL_DIR}/scripts/show-version.js
```

> `show-version.js` 内置所有逻辑（目录检测、版本获取、格式化输出）

**命令文件中的正确引用方式**:

```markdown
### 步骤 0: 版本显示（遵循 SKILL.md 强制启动行为）

> 遵循 SKILL.md "🚀 强制启动行为" 章节定义，显示版本和场景信息。
```

**禁止**: 在命令文件中复制版本显示代码或目录检测逻辑

---

## ACE 自演化机制

> **ACE = Agentic Context Engineering**
>
> ACE 是基础设施，像空气一样无处不在。任何使用 mob-seed 的项目自动享受 ACE 自演化的好处。

### ACE 三阶段循环

```
Observe（观察）──► Reflect（反思）──► Curate（策展）
     │                  │                  │
     ▼                  ▼                  ▼
自动收集问题      分析根因提取模式    更新规格/工具/文档
```

### ACE 行为约定（不可违反）

Claude 在执行 mob-seed 命令时**必须**遵守以下行为：

| 触发条件 | 必须执行 | 输出 |
|----------|----------|------|
| 测试失败 | 调用 `collectFromExecute()` | `💡 ACE: 收集 N 条观察` |
| 规格漂移 | 调用 `collectFromDefend()` | `💡 ACE: 收集 N 条观察` |
| 用户说"又/再次/还是" | 创建 pattern_detected 观察 | `💡 ACE: 已记录重复模式` |
| 用户报告问题 | 创建 user_feedback 观察 | `💡 ACE: 已记录反馈` |
| 同类观察 ≥ 3 | 主动提议反思 | `💡 ACE: 建议进行反思分析` |

### ACE 触发点

```
/mob-seed:exec   → 步骤末尾自动调用 ACE 收集器
/mob-seed:defend → 步骤末尾自动调用 ACE 收集器
/mob-seed        → 智能入口分析用户输入
git commit       → pre-commit hook 检查 ACE 状态
git push         → pre-push hook 检查反思阈值
```

---

## OpenSpec 生命周期

### 状态流转

```
draft → review → implementing → archived
  📝      🔍         🔨           ✅
```

### 目录结构

```
openspec/
├── specs/      # 真相源（已归档的规格）
├── changes/    # 变更提案（开发中）
└── archive/    # 归档历史
```

> 详细结构见 [REFERENCE.md](REFERENCE.md#openspec-生命周期)

---

## 架构原则

> **核心原则**: 行为定义集中化，命令执行引用化。
>
> 一处定义，处处生效。避免冗余，确保一致性。

### Claude 执行顺序

```
1. 读取 SKILL.md 获取强制启动行为
2. 执行强制启动行为（版本显示）
3. 读取具体命令文件（commands/*.md）
4. 按命令文件步骤执行
5. 执行 ACE 行为（如适用）
```

**禁止**: 在命令文件中重复 SKILL.md 已定义的代码块

---

## 详细参考

以下内容已移至 [REFERENCE.md](REFERENCE.md) 以优化加载性能：

- [目录结构详解](REFERENCE.md#目录结构)
- [配置说明](REFERENCE.md#配置说明)
- [完整工作流程](REFERENCE.md#完整工作流程)
- [Delta 规格格式](REFERENCE.md#delta-规格格式)
- [输出目录](REFERENCE.md#输出目录)
- [资源引用规范](REFERENCE.md#资源引用规范)
- [ACE 存储结构](REFERENCE.md#ace-存储结构)
- [版本显示格式](REFERENCE.md#版本显示格式)

---

*保持此文件 <500 行以确保完整加载。详细内容见 REFERENCE.md。*
