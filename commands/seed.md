---
name: mob-seed
description: SEED 方法论驱动的统一开发工作流（智能入口）
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite, AskUserQuestion
argument-hint: [subcommand] [options]
---

# mob-seed - 统一开发工作流

执行内容：$ARGUMENTS

---

## SEED 方法论 + ACE 自演化

> **口诀**: Single 定单源，Emit 自派生，Execute 自动跑，Defend 守规范，**ACE 自演化**。
> **理念**: 一粒种子，一棵大树，全自动生长，**持续进化**。

| 阶段 | 原则 | 说明 |
|------|------|------|
| **S** | Single-source | 规格是唯一真相源 |
| **E** | Emit | 所有产物自动派生 |
| **E** | Execute | CI/CD 自动执行 |
| **D** | Defend | 守护规范，防御手动干预 |
| **A** | ACE | 系统从经验中学习，持续进化 |

---

## 命令格式

```
/mob-seed [subcommand] [options]
```

### 子命令列表

| 子命令 | 说明 |
|--------|------|
| (无) | 智能状态面板 + 建议行动 |
| init | 项目初始化 |
| spec | 规格管理 |
| emit | 自动派生 |
| exec | 执行测试 |
| defend | 守护检查 |
| archive | 归档提案 |
| ace | ACE 自演化管理 |

### 全局选项

| 选项 | 说明 |
|------|------|
| --quick | 快速检查（秒级） |
| --fix | 自动修复可修复问题 |
| --auto | 自动执行所有建议 |
| --ci | CI 模式（严格检查） |

---

## 执行步骤

### 步骤 0: 版本显示（遵循 SKILL.md 强制启动行为）

> 遵循 SKILL.md "🚀 强制启动行为" 章节定义，显示版本和场景信息。

### 步骤 0.5: 检查初始化状态

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，自动引导用户运行 `/mob-seed init`

2. **加载配置**：
```javascript
const config = loadSeedConfig();
```

### 步骤 0.5: ACE 对话拦截（自动）

> **ACE 自演化机制**：此步骤自动执行，无需用户干预。
> 分析用户输入，检测问题反馈和重复模式，自动创建观察。

```javascript
// 分析用户输入（$ARGUMENTS 或对话上下文）
const userInput = "$ARGUMENTS" || context.lastUserMessage;

// 关键词检测
const patterns = {
  repeat: /又|再次|还是|老是|总是/,
  problem: /问题|错误|bug|失败|不对|不行/,
  frustration: /为什么|怎么回事|搞不懂/
};

// 检测重复模式
if (patterns.repeat.test(userInput)) {
  createObservation({
    type: 'pattern_detected',
    source: 'conversation',
    description: `检测到重复问题关键词: "${userInput}"`,
    context: { trigger: 'repeat_keyword' }
  });
  console.log('💡 ACE: 已记录重复模式');
}

// 检测问题反馈
if (patterns.problem.test(userInput)) {
  createObservation({
    type: 'user_feedback',
    source: 'conversation',
    description: `用户报告问题: "${userInput}"`,
    context: { trigger: 'problem_keyword' }
  });
  console.log('💡 ACE: 已记录反馈');
}

// 检查反思阈值
const threshold = checkReflectionThreshold();
if (threshold.shouldReflect) {
  console.log(`💡 ACE: 同类问题已出现 ${threshold.count} 次`);
  console.log('   建议: 运行 /mob-seed ace reflect 进行反思分析');
}
```

**触发规则**：

| 关键词 | 观察类型 | 说明 |
|--------|----------|------|
| 又/再次/还是 | pattern_detected | 重复问题模式 |
| 问题/错误/bug | user_feedback | 用户反馈 |
| 为什么/搞不懂 | user_feedback | 困惑反馈 |

### 步骤 1: 解析参数

根据用户输入解析子命令和选项：

```javascript
const args = "$ARGUMENTS".split(/\s+/);
const subcommand = args.find(a => !a.startsWith('--'));
const options = {
  quick: args.includes('--quick'),
  fix: args.includes('--fix'),
  auto: args.includes('--auto'),
  ci: args.includes('--ci'),
  strict: args.includes('--strict')
};
```

### 步骤 2: 子命令路由

```
┌─────────────────────────────────────────────────────────────┐
│                     mob-seed 子命令路由                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户输入                          路由目标                   │
│  ─────────                        ─────────                  │
│                                                              │
│  /mob-seed                     →  智能状态面板               │
│  /mob-seed init                →  commands/init.md           │
│  /mob-seed spec "登录"         →  commands/spec.md           │
│  /mob-seed emit                →  commands/emit.md           │
│  /mob-seed exec                →  commands/exec.md           │
│  /mob-seed defend              →  commands/defend.md         │
│  /mob-seed archive             →  commands/archive.md        │
│  /mob-seed ace                 →  commands/ace.md            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

如果有子命令，路由到对应子命令文件执行。

如果无子命令，执行智能入口逻辑（步骤 3）。

### 步骤 3: 智能入口（无子命令时）

执行全量检查并输出状态面板 + 建议行动：

#### 3.1 状态收集

```javascript
// 调用 lib/workflow/unified-command.js
const status = await collectStatus();
// 返回: { specs, changes, sync, drift }
```

#### 3.2 同步检查

检查规格与派生物一致性：
- 代码覆盖率
- 测试覆盖率
- 文档同步状态

#### 3.3 漂移检测

识别问题：
- 新增：代码中有规格未定义的功能
- 缺失：规格定义但代码未实现
- 不一致：实现与规格描述不符

#### 3.4 ACE 状态检查

```javascript
// 检查 ACE 观察状态
const aceStatus = checkACEStatus();
// 返回: { raw, triaged, promoted, patterns, shouldReflect }
```

#### 3.5 输出报告

```
🌱 SEED 项目状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 规格库
   真相源: 5 个规格
   变更提案: 2 个 (1 implementing, 1 draft)

🔄 同步状态
   ✅ 代码覆盖: 100% (25/25 FR)
   ⚠️ 测试覆盖: 80% (20/25 AC)
   ❌ 文档同步: 版本号过时

📊 漂移检测
   ✅ 无漂移

🧠 ACE 自演化
   观察: {raw} 待处理 / {total} 总数
   模式: {patterns} 个已提取
   {shouldReflect ? "⚠️ 达到反思阈值" : "✅ 状态健康"}

💡 建议行动
   1. 运行 /mob-seed defend --fix 修复文档版本
   2. 补充 5 个缺失的 AC 测试
   {raw > 0 ? "3. 运行 /mob-seed ace 处理待处理观察" : ""}

下一步: /mob-seed <action> 或 /mob-seed --auto 自动执行
```

### 步骤 4: 自动执行（--auto）

如果指定 `--auto`，自动执行所有可修复的建议：

1. 自动修复文档版本
2. 生成测试骨架
3. 重新验证

---

## 使用示例

```bash
# 智能状态面板（推荐日常使用）
/mob-seed

# 快速检查
/mob-seed --quick

# 自动修复
/mob-seed --fix

# 全自动模式
/mob-seed --auto

# 子命令
/mob-seed init                    # 初始化项目
/mob-seed spec "登录功能"         # 创建规格
/mob-seed emit                    # 派生产物
/mob-seed exec                    # 执行测试
/mob-seed defend                  # 守护检查
/mob-seed archive "v1.0-login"    # 归档提案
```

---

## 进度显示

| 图标 | 含义 |
|------|------|
| 🌱 | SEED 项目 |
| 📦 | 规格库状态 |
| 🔄 | 同步状态 |
| 📊 | 漂移检测 |
| 💡 | 建议行动 |
| ✅ | 正常 |
| ⚠️ | 警告 |
| ❌ | 错误 |
