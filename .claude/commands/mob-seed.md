---
description: SEED 方法论驱动的统一开发工作流（种子法则）
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite, AskUserQuestion
argument-hint: <需求描述> [--spec|--emit|--exec|--defend] [--quick|--full]
---

# mob-seed - 魔鱼 SEED 统一开发工作流

执行内容：$ARGUMENTS

---

## SEED 方法论

> **口诀**: Single 定单源，Emit 自派生，Execute 自动跑，Defend 守规范。
> **理念**: 一粒种子，一棵大树，全自动生长。

| 阶段 | 原则 | 说明 |
|------|------|------|
| **S** | Single-source | 规格是唯一真相源 |
| **E** | Emit | 所有产物自动派生 |
| **E** | Execute | CI/CD 自动执行 |
| **D** | Defend | 守护规范，防御手动干预 |

---

## 依赖资源

本命令引用 `mob-seed` 技能：

```
.claude/skills/mob-seed/
├── SKILL.md              # 技能定义
├── prompts/              # 提示词模板
├── templates/            # 规格模板
├── adapters/
│   └── seed-utils.js     # 工具模块
└── scripts/              # 辅助脚本
```

**项目配置**: `.seed/config.json`（由 `/mob-seed-init` 生成）

---

## 执行步骤

### 步骤 0: 检查初始化状态并加载配置

1. **检查 SEED 是否已初始化**：
   - 检查 `.seed/config.json` 是否存在
   - 如不存在，自动引导用户运行 `/mob-seed-init`

2. **加载配置获取路径**：
```javascript
const config = loadSeedConfig();
const SPECS_DIR = config.paths.specs;
const SRC_DIR = config.paths.src;
const TEST_DIR = config.paths.test;
const DOCS_DIR = config.paths.docs;
const OUTPUT_DIR = config.paths.output;
```

3. **动态检测技能目录**：
```bash
if [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
fi
```

### 步骤 1: 解析参数

根据用户输入解析执行模式：

| 参数 | 模式 | 说明 |
|------|------|------|
| `--spec` | 规格模式 | 只执行 S 阶段（创建/编辑规格） |
| `--emit` | 派生模式 | 执行 E 阶段（从规格派生产物） |
| `--exec` | 执行模式 | 执行 E 阶段（自动触发 CI） |
| `--defend` | 守护模式 | 执行 D 阶段（检查合规性） |
| 无参数 | 智能模式 | 自动判断并执行完整 S-E-E-D 流程 |

**复杂度选项**：
- `--quick`: 快速模式（简单任务）
- `--full`: 完整模式（复杂任务）

### 步骤 2: 智能路由

根据解析结果路由到对应子命令：

```
┌─────────────────────────────────────────────────────────────┐
│                     mob-seed 智能路由                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户输入                          路由目标                   │
│  ─────────                        ─────────                  │
│                                                              │
│  /mob-seed "添加登录功能"    →    完整 S-E-E-D 流程          │
│  /mob-seed --spec "登录"     →    /mob-seed-spec             │
│  /mob-seed --emit            →    /mob-seed-emit             │
│  /mob-seed --exec            →    /mob-seed-exec             │
│  /mob-seed --defend          →    /mob-seed-defend           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 步骤 3: 执行 SEED 流程

#### 3.1 S - Single-source（规格定义）

1. 检查是否已有规格文件（`{config.paths.specs}/*.fspec.md`）
2. 如无，引导用户创建规格
3. 如有，验证规格完整性

```markdown
输出: {config.paths.specs}/{feature-name}.fspec.md
```

#### 3.2 E - Emit（自动派生）

1. 读取规格文件
2. 调用派生引擎生成产物：
   - 代码 → `{config.paths.src}/`
   - 测试 → `{config.paths.test}/`
   - 文档 → `{config.paths.docs}/`

```markdown
输出: {src}/, {test}/, {docs}/ (自动生成，路径由配置决定)
```

#### 3.3 E - Execute（自动执行）

1. 触发测试运行
2. 触发文档生成
3. 触发 CI 流程（如配置）

```markdown
输出: 测试报告、构建产物
```

#### 3.4 D - Defend（守护规范）

1. 检查派生物是否被手动修改
2. 验证规格与产物一致性
3. 报告违规项

```markdown
输出: 合规检查报告
```

### 步骤 4: 输出结果

```
{config.paths.output}/
├── seed-report.md          # 执行报告（人类可读）
├── seed-manifest.json      # 规格→产物映射（程序用）
└── seed-log.txt            # 执行日志
```

> 注：所有路径从 `.seed/config.json` 读取，适配任何项目结构

---

## 使用示例

```bash
# 智能模式：自动完成 S-E-E-D 全流程
/mob-seed "添加用户登录功能"

# 指定阶段模式
/mob-seed --spec "登录功能"      # 只创建规格
/mob-seed --emit                  # 从规格派生产物
/mob-seed --exec                  # 执行 CI
/mob-seed --defend                # 检查合规性

# 复杂度选项
/mob-seed --quick "修复按钮样式"  # 快速模式
/mob-seed --full "重构认证系统"   # 完整模式

# 组合使用
/mob-seed --spec --full "支付系统"
```

---

## 进度显示

| 图标 | 含义 |
|------|------|
| S | 正在定义规格 |
| E | 正在派生产物 |
| E | 正在执行 CI |
| D | 正在检查合规 |
| ✅ | 阶段完成 |
| ❌ | 阶段失败 |

示例输出：
```
🌱 SEED 工作流启动
━━━ S: Single-source ━━━
✅ 规格已创建: specs/login.fspec.md
━━━ E: Emit ━━━
✅ 代码派生: src/auth/login.js
✅ 测试派生: test/auth/login.test.js
✅ 文档派生: docs/auth/login.md
━━━ E: Execute ━━━
✅ 测试通过: 5/5
━━━ D: Defend ━━━
✅ 合规检查通过
🌳 SEED 完成 (耗时 45s)
```
