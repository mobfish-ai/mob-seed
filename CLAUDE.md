# mob-seed 开发指南

## 项目结构

```
mob-seed/                        # 项目根目录
├── .seed/                       # SEED 配置目录
│   ├── config.json              # 核心配置
│   └── mission.md               # 使命声明 (YAML frontmatter + Markdown)
├── openspec/                    # OpenSpec 规格目录
│   ├── specs/                   # 稳定规格
│   ├── changes/                 # 变更提案 (implementing)
│   └── archive/                 # 已归档规格
├── skills/mob-seed/             # 技能代码目录
│   ├── lib/                     # 源代码 (CommonJS)
│   ├── test/                    # 测试代码 (CommonJS)
│   ├── adapters/                # 适配器 (ES Modules)
│   ├── prompts/                 # 提示模板
│   └── SKILL.md                 # 技能定义
├── commands/                    # 用户命令
└── examples/                    # 示例
```

**重要**: 所有路径配置都在 `.seed/config.json` 中，相对于项目根目录。

## 模块系统

项目使用**混合模块系统**：

| 目录 | 模块类型 | 原因 |
|------|----------|------|
| `lib/` | CommonJS | 历史代码，与 Node.js test runner 兼容 |
| `test/` | CommonJS | 使用 `require('node:test')` |
| `adapters/` | ES Modules | 现代 API，支持 top-level await |

**禁止**: 在 `skills/mob-seed/package.json` 中添加 `"type": "module"`，这会破坏所有 CommonJS 测试。

**调用 ESM 适配器**: 使用 `node --input-type=module -e "import {...} from '...'"`

## 测试规范

### 运行测试

```bash
# 进入技能目录
cd skills/mob-seed

# 运行所有测试
node --test test/**/*.test.js

# 运行单个测试
timeout 30 node --test test/router/complexity-router.test.js
```

### 测试要求

1. **必须使用 timeout**: 防止测试进程泄漏
2. **单文件执行**: 避免并发问题
3. **禁止 --watch**: 会累积进程
4. **运行后验证**: 检查无残留进程

## SEED 方法论

### 完整流程

```
S (Spec)    → 创建/更新 .fspec.md 规格
E (Emit)    → 自动派生代码/测试/全部文档
E (Execute) → 运行测试验证
D (Defend)  → 守护规格与代码同步

**Emit 派生范围（完整）**:
- 代码（源代码、配置）
- 测试（单元测试、集成测试）
- 文档（API、用户指南、概念说明、CHANGELOG）
```

### 命令 (v2.1.0+)

| 命令 | 用途 |
|------|------|
| `/mob-seed` | 统一入口（智能路由） |
| `/mob-seed:init` | 初始化项目 |
| `/mob-seed:spec` | S: 创建/验证规格 |
| `/mob-seed:emit` | E: 派生产物 |
| `/mob-seed:exec` | E: 执行测试 |
| `/mob-seed:defend` | D: 守护同步 |
| `/mob-seed:archive` | 归档已完成提案 |

> **v2.1.0 命名变更**: 子命令从 `/mob-seed-*` 改为 `/mob-seed:*`

### OpenSpec 生命周期

```
draft → review → implementing → archived
```

- `changes/` 目录: 正在实现的变更提案
- `specs/` 目录: 稳定规格
- `archive/` 目录: 已归档历史

## ACE 闭环 (Observe → Reflect → Curate)

ACE (Agentic Context Engineering) 让系统能从执行反馈中学习并演化规格。

### 与 SEED 的关系

```
Spec → Emit → Execute → Defend
  ▲                │        │
  │                ▼        ▼
  │         Observe → Reflect → Curate
  └──────────────────────────────────┘
```

### 观察收集

- **自动观察**: Execute/Defend 自动记录失败和偏离
- **手动观察**: `/mob-seed:spec observe "描述"`
- **观察类型**: test_failure, spec_drift, coverage_gap, user_feedback

### 反思分析

- **触发**: `/mob-seed:spec reflect`
- **自动模式识别**:
  - 类型聚合: 同类错误 ≥3 次
  - 规格聚合: 同规格问题 ≥2 次
  - 时间窗口: 24 小时内密集问题

### 整合提案

- **升级**: `/mob-seed:spec promote <reflection-id>`
- 创建正式变更提案
- 进入 OpenSpec 生命周期

### ACE 命令

| 命令 | 用途 |
|------|------|
| `/mob-seed:spec observe` | 手动添加观察 |
| `/mob-seed:spec triage` | 归类待处理观察 |
| `/mob-seed:spec reflect` | 触发反思分析 |
| `/mob-seed:spec promote` | 反思升级为提案 |
| `/mob-seed:insight` | 外部洞见导入和管理 (v3.6+) |

### ACE 目录结构

```
.seed/
├── observations/     # 观察记录
│   ├── index.json   # 索引
│   └── obs-xxx.md   # 单个观察
├── reflections/      # 反思记录
│   ├── index.json   # 索引
│   └── ref-xxx.md   # 单个反思
├── insights/         # 外部洞见 (v3.6+)
│   ├── index.json   # 索引
│   └── ins-xxx.md   # 单个洞见
└── learning/         # 模式学习
    ├── samples.json  # 历史样本
    └── feedback.json # 效果反馈
```

### ACE 配置

在 `.seed/config.json` 中配置 ACE 行为：

```json
{
  "ace": {
    "enabled": true,
    "sources": {
      "core": ["test_failure", "spec_drift", "coverage_gap", "user_feedback"]
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

## 核心规则 ⚠️

> **完整定义见 [.seed/mission.md](.seed/mission.md)**
>
> 以下是快速检查清单，详细说明请阅读 mission.md。

### 派生链（不可违反）

```
Spec → Code → Docs
规格 → 代码 → 文档
```

### 快速检查清单

每次操作前，必须确认：

| 规则 | 检查项 | ✅ 正确 | ❌ 错误 |
|------|--------|---------|---------|
| 规则 1 | 规格是真相源 | 先写规格再派生代码 | 先写代码再补规格 |
| 规则 2 | 代码是文档真相源 | Code → Docs | Spec → Docs |
| 规则 3 | 测试验证完成 | 基于测试标记 AC | 无测试直接标记 |
| 规则 4 | 命令职责分离 | defend 只读 | defend 改文件 |

### 常见违规

| 模式 | 违反 | 正确做法 |
|------|------|----------|
| Spec → Docs | 规则 2 | Spec → Code → Docs |
| 无测试标记 AC | 规则 3 | 测试通过再标记 |
| 检查命令改文件 | 规则 4 | 分离检查和修改 |
| 手动创建代码 | 规则 1 | 从规格派生 |

> 💡 **提示**: 运行 `/mob-seed-defend` 自动检查这些规则

## 经验教训

> **元原则**: 所有教训必须通过**程序化方式**解决，而非仅仅写文档。
>
> | 层级 | 强度 | 示例 |
> |------|------|------|
> | L1 文档 | 弱 | CLAUDE.md 教训记录 |
> | L2 命令提示 | 中 | commands/*.md 步骤指导 |
> | L3 验证脚本 | **强** | `scripts/verify-*.js` |
> | L4 Git Hooks | **强** | pre-commit, pre-push |
>
> **新增教训时必须**：
> 1. 先创建验证脚本 (`scripts/verify-{issue}.js`)
> 2. 验证脚本可运行并检测问题
> 3. 然后才在 CLAUDE.md 记录教训（引用验证脚本）

### 1. 路径配置必须完整

**错误**:
```json
{
  "src": "skills/mob-seed",
  "test": "test"
}
```

**正确**:
```json
{
  "src": "skills/mob-seed/lib",
  "test": "skills/mob-seed/test"
}
```

### 2. 不要混淆模块系统

- 添加 `"type": "module"` 到 package.json 会影响**所有** .js 文件
- CommonJS 文件会报错: `require is not defined in ES module scope`
- 解决方案: 不设置 `type`，按需指定模块类型

### 3. mob-seed 自包含

mob-seed 有完整的 SEED 方法论实现，**不依赖**外部技能（如 superpowers:test-driven-development）。

所有 prompts、templates、workflows 都在 `skills/mob-seed/` 内。

### 4. emit 不生成空壳

`/mob-seed-emit` 生成的代码包含 Claude 提示（如 `// Claude 应该根据规格实现此函数`），而非 `throw new Error('Not implemented')`。

这是**设计决策**，确保生成的代码对 Claude 有指导意义。

### 5. 禁止硬编码绝对路径

**错误**:
```markdown
项目目录: /Users/username/projects/mob-seed/
```

**正确**:
```markdown
项目目录: mob-seed/
```

- 绝对路径会暴露用户隐私信息
- 文档、配置中只使用相对路径
- 提交前检查: `grep -rn "/Users/" --include="*.md"`

### 6. 中英文文档同步

项目有两份 README：
- `README.md` (英文)
- `README.zh-CN.md` (中文)

**任何修改必须同时更新两份文档**，确保内容一致。

检查清单：
- [ ] 新增章节：两份都添加
- [ ] 修改内容：两份都修改
- [ ] 删除内容：两份都删除

### 7. 归档流程必须完整执行

**问题**: 执行归档时只移动了 `changes/` 到 `archive/`，漏掉了合并到 `specs/` 的步骤。

**正确流程**:
```
/mob-seed-defend <proposal>  → 检查同步状态
/mob-seed-archive <proposal> → 完整归档流程
  ├── 步骤1: 合并 specs/ 到真相源 (openspec/specs/)
  ├── 步骤2: 移动提案到 archive/
  └── 步骤3: 更新状态为 archived
```

**关键点**:
- `/mob-seed-defend` 只做检查，不做归档
- `/mob-seed-archive` 执行完整归档（包括合并）
- 归档后 `openspec/specs/` 应包含所有生效规格
- `openspec/archive/` 只保留历史快照

**检查清单**:
- [ ] 归档前运行 `/mob-seed-status` 确认规格数量
- [ ] 归档后验证 `openspec/specs/` 包含新规格
- [ ] 不要手动 `mv`，使用 `/mob-seed-archive` 命令

### 8. 命令职责分离

| 命令 | 职责 | 副作用 |
|------|------|--------|
| `/mob-seed-defend` | 检查同步状态 | 只读，无副作用 |
| `/mob-seed-archive` | 执行归档 | 移动文件、合并规格 |

**禁止**: 在 `/mob-seed-defend` 中手动执行归档操作

### 9. 归档时基于测试结果更新 AC 状态

**问题**: 归档后规格中的 AC 仍然是 `- [ ]` 未完成状态。

**正确做法**: `/mob-seed-archive` 步骤 4.4 会基于测试结果更新 AC 状态：
```javascript
// 只有通过测试验证的 AC 才标记为完成
if (testPassed) {
  updateACStatus(ac.id, 'completed');  // [ ] → [x]
} else {
  console.warn(`⚠️ ${ac.id} 未通过测试验证`);
}
```

**重要原则**:
- ✅ 只有通过测试的 AC 才标记 `[x]`
- ❌ 禁止无条件假设所有 AC 已完成
- ⚠️ 未覆盖的 AC 应触发警告

### 10. 文档派生范围（完整）

**SEED 派生所有文档类型**，不仅仅是 API 文档：

| 文档类型 | 派生来源 | 生成时机 |
|----------|----------|----------|
| API 参考 | Code (JSDoc/签名) | emit --docs |
| 用户指南 | Code + Spec | emit --docs |
| 概念说明 | Spec (方法论) | emit --docs |
| CHANGELOG | Git log + Spec 变更 | 发布时自动 |
| README | Spec + Code 概述 | emit --docs |

**派生链**:
```
Spec (规格) → Code (代码) → Docs (全部文档)
                  ↑
             API 文档真相源是代码
             概念文档真相源是规格
             CHANGELOG 真相源是 Git + Spec
```

**为什么 Code → API Docs**:
- Spec 描述"应该是什么"
- Code 描述"实际是什么"
- API Docs 应该反映实际实现

**文档生成方法**:
```bash
# 生成全部文档
/mob-seed-emit --docs

# 文档来源
# - 函数签名 → API 参考
# - JSDoc 注释 → 参数说明
# - Spec 概述 → 概念说明
# - Git commits → CHANGELOG
```

**禁止**: 手动创建文档（除非先有规格定义）

### 11. 规格派生路径必须与配置一致

**问题**: 规格文件的"派生产物"章节使用了通用路径（如 `lib/xxx`、`test/xxx`），与 `.seed/config.json` 中的实际配置（`skills/mob-seed/lib`、`skills/mob-seed/test`）不一致，导致文件被创建到错误位置。

**根本原因**:
1. 模板文件 (`templates/feature.fspec.md`) 使用了通用路径占位符
2. 创建规格时未读取配置来解析实际路径
3. 缺乏路径一致性验证机制

**修复措施**:
1. **更新模板**:
   ```markdown
   ## 派生产物 (Derived Outputs)

   > **路径规范**: 所有路径必须遵循 `.seed/config.json` 中的 `paths` 配置。
   > 例如: 若 `paths.src = "skills/mob-seed/lib"`，则代码路径为 `skills/mob-seed/lib/{module}/{file}.js`

   | 类型 | 路径 | 说明 |
   |------|------|------|
   | 代码 | {config.paths.src}/{module}/{file}.js | 主要实现 |
   | 测试 | {config.paths.test}/{module}/{file}.test.js | 单元测试 |
   ```

2. **更新 spec-create.md 指导**:
   - 明确说明路径必须与配置一致
   - 提供配置字段引用方式

3. **规格审查检查项**:
   - [ ] 派生路径是否与 `.seed/config.json` 一致
   - [ ] 是否添加了路径规范说明

**防御机制**:
```bash
# 检查规格路径是否与配置一致
grep -rn "^| 代码 |" openspec/changes/**/specs/**/*.fspec.md | \
  grep -v "skills/mob-seed"  # 应该无输出
```

**教训**:
- ✅ 模板和指导文档必须引用配置，而非硬编码路径
- ✅ 路径问题要追溯到根源（模板/指导文档），而非仅修复症状
- ✅ 修复后同步更新所有受影响的规格文件
- ❌ 不要在规格中使用与配置不一致的相对路径

### 12. AI 偏离核心哲学的根本原因分析

**问题**: SEED 核心哲学明确规定 `Code → Docs`，但 AI 实际操作时却执行了 `Spec → Docs`。

**底层原因分析**:

1. **指令优先 vs 原则优先**:
   - AI 在执行具体任务时，优先执行字面指令
   - mob-seed-emit.md 写着 "根据规格生成文档"，AI 就字面执行
   - 没有先验证这个指令是否符合核心原则

2. **上下文分离问题**:
   - 核心哲学写在 CLAUDE.md 中
   - 具体操作指令写在各个 command/*.md 中
   - 执行时没有同时交叉验证两者是否一致

3. **文档不一致的连锁反应**:
   - mob-seed-emit.md 的描述本身就与 SEED 哲学不一致
   - AI 信任了错误的文档描述
   - 这是**系统性问题**，不仅仅是执行问题

4. **缺乏主动质疑机制**:
   - AI 没有习惯在执行前问："这样做符合核心原则吗？"
   - "按指令执行" 比 "质疑指令是否正确" 更容易

**防御机制（必须执行）**:

```
执行任何操作前，必须验证：
┌────────────────────────────────────────┐
│ ❓ 这个操作符合 SEED 核心原则吗？        │
│                                         │
│ S → 规格是单一真相源？                   │
│ E → 产物是从规格/代码自动派生？          │
│ E → 派生产物可执行可验证？               │
│ D → 防止手动篡改？                      │
│                                         │
│ 派生链: Spec → Code → Docs              │
│ 不是: Spec → Docs (跳过代码)            │
└────────────────────────────────────────┘
```

**教训**:
- ✅ 具体指令与核心原则冲突时，核心原则优先
- ✅ 发现文档不一致时，立即修复文档
- ✅ 执行前主动验证操作是否符合哲学
- ❌ 不要盲目信任单一文档的字面描述

### 13. CHANGELOG 必须基于 Git 历史

**问题**: 编写 CHANGELOG 时凭记忆或猜测，遗漏了大量重要变更。

**正确流程**:

```bash
# 1. 先查看完整的 git 变更记录
git log v{上一版本}..HEAD --stat --oneline

# 2. 分析每个 commit 的变更
git show <commit-hash> --stat

# 3. 按 Keep a Changelog 规范分类
# - Added: 新增功能
# - Changed: 变更功能
# - Deprecated: 即将移除
# - Removed: 已移除
# - Fixed: 修复问题
# - Security: 安全相关
```

**CHANGELOG 编写清单**:

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1 | 运行 `git log` 获取完整历史 | 必须先执行 |
| 2 | 列出所有新增模块（带行数） | 对照 git 输出 |
| 3 | 列出所有 Breaking Changes | 特别检查 |
| 4 | 列出所有移除的内容 | 特别检查 |
| 5 | 检查配置/命名变更 | 影响用户 |
| 6 | 交叉验证：changelog 条目 vs git log | 不遗漏 |

**Breaking Changes 必须突出**:
```markdown
### ⚠️ Breaking Changes
- **命令系统重构**: 统一为子命令模式 (`/mob-seed:*`)
  - `/mob-seed-spec` → `/mob-seed:spec`
  - `/mob-seed-emit` → `/mob-seed:emit`
  - 移除: `/mob-seed-status`, `/mob-seed-diff`
```

**教训**:
- ✅ **先 git log，后写 changelog**（不可逆顺序）
- ✅ 使用 `--stat` 看到每个文件变更，不遗漏
- ✅ Breaking Changes 放最前面，用警告图标
- ❌ 禁止凭记忆编写 changelog
- ❌ 禁止先写 changelog 再验证

**连锁检查**:
发布时必须同时更新：
- [ ] CHANGELOG.md（changelog 完整性）
- [ ] README.md（反映新功能/命令变更）
- [ ] README.zh-CN.md（中英同步）
- [ ] 版本号（4 个文件同步）

### 14. 单源版本管理

**问题**: 版本号分散在多个文件中，容易遗漏导致不一致。

**解决方案**: `package.json` 作为唯一真相源，其他文件通过脚本同步。

```
┌─────────────────────────────────────────────────────────────┐
│  package.json (真相源)                                       │
│       │                                                      │
│       ├──► .claude-plugin/plugin.json     (脚本同步)         │
│       ├──► .claude-plugin/marketplace.json (脚本同步)        │
│       └──► skills/mob-seed/package.json   (脚本同步)         │
│                                                              │
│  ❌ .seed/config.json 不含版本号（配置文件，非版本文件）       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**版本同步工具**:
```bash
# 检查版本一致性
node scripts/bump-version.js --check

# 同步到指定版本
node scripts/bump-version.js 2.1.2

# 递增版本
node scripts/bump-version.js --patch  # 2.1.1 → 2.1.2
node scripts/bump-version.js --minor  # 2.1.1 → 2.2.0
node scripts/bump-version.js --major  # 2.1.1 → 3.0.0

# 预览模式
node scripts/bump-version.js 2.1.2 --dry-run

# ⭐ 发布模式（推荐）
node scripts/bump-version.js 3.0.0 --release
# 自动: 验证根目录 → 检查 git 状态 → 更新版本 → 暂存文件 → 显示检查清单
```

**版本文件清单（4 个）**:
1. `package.json` - 根目录
2. `.claude-plugin/plugin.json` - 插件定义
3. `.claude-plugin/marketplace.json` - 市场配置
4. `skills/mob-seed/package.json` - 技能包

**禁止**: 在 `.seed/config.json` 中添加版本号

### 15. 归档操作必须完整执行命令流程

**问题**: 归档 v2.1-release-automation 时，只更新了 `proposal.md` 状态，但遗漏了：
- 8 个 `.fspec.md` 规格文件的状态没有更新
- 所有 AC/FR checkbox 仍为 `- [ ]` 未完成状态

**根因分析**:

| 假设 | 实际情况 |
|------|----------|
| 归档命令文档不完整？ | ❌ 错误 - `archive.md` 已定义完整步骤 |
| AI 没遵循命令流程？ | ✅ 正确 - 手动 `mv` 而非按步骤执行 |
| 缺乏归档后验证？ | ✅ 正确 - 没有机制确保步骤都执行 |

**archive.md 已定义的关键步骤（但被跳过）**:
- 步骤 4.3: 更新所有规格文件状态为 archived
- 步骤 4.4: 基于测试结果更新 AC 完成状态

**正确做法**:
```
归档执行清单（必须全部完成）:
□ 1. 验证前置条件（状态=implementing, 测试通过）
□ 2. 合并 Delta 到真相源 openspec/specs/
□ 3. 移动提案到 archive/ 目录
□ 4. 更新 proposal.md 状态为 archived
□ 5. 更新所有 .fspec.md 文件状态为 archived  ← 容易遗漏
□ 6. 基于测试结果更新 AC checkbox             ← 容易遗漏
□ 7. 归档后验证所有文件状态正确              ← 新增
```

**归档后验证命令**:
```bash
# 检查所有归档规格文件是否有状态标记
grep -rL "状态: archived" openspec/archive/{提案名}/specs/*.fspec.md

# 如有输出，说明有文件遗漏状态更新
```

**教训**:
- ✅ 命令文档已完整，问题在于执行时跳过步骤
- ✅ 复杂操作必须逐步执行命令定义的每个步骤
- ✅ 执行后必须验证结果符合预期
- ❌ 禁止手动 `mv` 代替完整归档流程
- ❌ 禁止假设"只要文件移动了就算归档完成"

**防御机制**: 归档后运行 `/mob-seed:defend` 验证

### 16. 边开发边更新进度文档

**问题**: 开发完成多个任务后才更新进度文档，导致进度不透明且容易遗漏。

**正确做法**: 每完成一个任务/AC 立即更新相关进度文档：

| 完成事项 | 必须更新的文档 |
|----------|---------------|
| AC 测试通过 | tasks.md 中对应 AC checkbox |
| 任务完成 | tasks.md 任务状态 + 进度统计 |
| 模块实现 | TodoWrite 任务列表 |
| 阶段完成 | tasks.md 阶段进度条 |

**更新时机（强制）**:

```
任务开始 → 更新 TodoWrite 为 in_progress
    ↓
AC 测试通过 → 更新 tasks.md AC checkbox
    ↓
任务完成 → 更新 tasks.md 任务状态 + 进度统计
         → 更新 TodoWrite 为 completed
```

**程序化验证**:
```bash
# 检查 tasks.md 进度是否与实际测试结果一致
node scripts/verify-task-progress.js

# 验证内容:
# 1. tasks.md 中标记 [x] 的 AC 是否有对应通过的测试
# 2. tasks.md 进度百分比是否与完成的 AC 数一致
# 3. 测试统计表是否与实际测试结果一致
```

**教训**:
- ✅ 每个 AC 通过测试后立即更新 tasks.md
- ✅ 使用 TodoWrite 实时跟踪当前任务状态
- ✅ 进度透明有助于任务管理和上下文恢复
- ❌ 禁止批量更新进度（容易遗漏）
- ❌ 禁止只在内存中跟踪进度

### 17. init 命令必须智能检测项目结构

> **ACE 来源**: obs-20260103-init-improvements

**问题**: 在 mars-nexus 项目初始化时发现三个问题：
1. `.seed/mission.md` 被填充为 mob-seed 自己的 mission
2. `.seed/config.json` 路径配置硬编码（src 应该是 server）
3. `openspec/project.md` 使用空模板，需要手动填写所有信息

**根因分析**:
- 命令文档未明确指定应使用通用模板而非 mob-seed 自己的 mission
- 未实现项目结构智能检测，直接使用硬编码默认值
- 未实现从 package.json 提取信息自动填充 project.md

**解决方案**:
1. 创建 `scripts/detect-project.js` 智能检测脚本：
   - 检测 src/test/docs 目录位置（支持多种命名）
   - 从 package.json 提取项目信息和技术栈
   - 自动生成 config.json 和 project.md 内容

2. 更新 `commands/init.md` 流程：
   - 步骤1.1: 运行智能检测脚本
   - 步骤1.3: 使用检测结果生成配置
   - 明确指定使用 `templates/openspec/mission.yaml` 而非 mob-seed mission

**检测脚本特性**:
```bash
# 检测目录候选列表
src:  [src, lib, server, app, source, code]
test: [test, tests, __tests__, spec, specs]
docs: [docs, documentation, doc, documents]

# 自动提取信息
- package.json: 名称、描述、版本、仓库、技术栈
- 技术栈: 语言、框架、测试框架、构建工具
```

**教训**:
- ✅ init 命令必须智能检测，不能假设项目结构
- ✅ 模板选择必须明确，避免复制错误内容
- ✅ 能自动填充的信息就不要让用户手动填写
- ✅ **直接使用检测脚本的输出文件**（`cat /tmp/xxx.json > .seed/config.json`）
- ❌ 禁止硬编码项目路径默认值（src/test/docs）
- ❌ 禁止复制 mob-seed 自己的配置到用户项目
- ❌ **禁止手动解析检测脚本的 JSON 再重新构造配置**（易被 CLAUDE.md 误导）
- ❌ **禁止读取 CLAUDE.md 中的路径配置来覆盖检测结果**

**验证命令**:
```bash
# 测试检测脚本
node .claude/skills/mob-seed/scripts/detect-project.js .

# 检查生成的配置
node .claude/skills/mob-seed/scripts/detect-project.js . --config

# 检查生成的 project.md
node .claude/skills/mob-seed/scripts/detect-project.js . --project-md
```

### 18. 发布流程完整性保障

> **ACE 来源**: obs-20260103-release-workflow → ref-20260103-release-workflow → pat-release-integrity

**问题**: v3.0.0 发布时，版本同步脚本修改了 4 个文件，但 git commit 只提交了 1 个，导致 tag 创建后发现 3 个版本文件未提交。

**根因分析**:
1. bump-version.js 使用 `process.cwd()` 解析路径，依赖当前目录
2. 从 `skills/mob-seed/` 执行时，相对路径解析错误
3. 创建 tag 前未验证 git status 是否干净

**解决方案（发布完整性模式）**:

| 原则 | 说明 | 强制机制 |
|------|------|----------|
| 单一执行点 | 必须从项目根目录执行 | 脚本内置根目录验证 |
| 原子化操作 | 版本更新和暂存作为原子操作 | `--release` 自动暂存 |
| 强制验证 | tag 前验证 git status 干净 | 脚本检查并警告 |
| 引导式流程 | 输出下一步操作指引 | 发布检查清单 |

**发布检查清单（强制）**:

```
发布流程（必须全部完成）:
□ 1. 确保在项目根目录: cd /path/to/mob-seed
□ 2. 确保所有功能开发已完成并提交
□ 3. 运行测试: cd skills/mob-seed && node --test test/**/*.test.js
□ 4. 使用发布模式更新版本:
       node scripts/bump-version.js X.Y.Z --release
□ 5. 检查 git status（应只有版本文件变更）
□ 6. 提交版本更改:
       git commit -m "chore(release): vX.Y.Z"
□ 7. 验证 git status 干净（无未提交文件）
□ 8. 创建 tag:
       git tag -a vX.Y.Z -m "Release vX.Y.Z"
□ 9. 推送到远程:
       git push origin main && git push origin vX.Y.Z
```

**防御机制**:
```bash
# 使用 --release 模式自动执行前 4 步验证
node scripts/bump-version.js 3.0.0 --release

# 脚本会自动:
# 1. 验证在项目根目录
# 2. 检查 git 状态（警告未提交更改）
# 3. 更新所有 4 个版本文件
# 4. 自动 git add 所有版本文件
# 5. 输出发布检查清单
```

**教训**:
- ✅ 多文件操作必须原子化，通过工具强制而非依赖人工记忆
- ✅ 发布脚本必须从项目根目录执行
- ✅ 创建 tag 前必须验证 git status 干净
- ❌ 禁止从子目录执行根目录脚本
- ❌ 禁止手动 git add 部分文件
- ❌ 禁止跳过 git status 检查直接创建 tag

### 19. 架构重构遵循渐进式五步法

> **ACE 来源**: v3.3-brownfield-support 实施经验

**问题**: 在 v3.3 brownfield support 开发中，发现以下架构问题：
1. 通用能力（hooks）放在 `.seed/scripts/`（项目特定目录），用户项目无法使用
2. 新增模块时路径设计与现有架构不一致
3. 测试需要与实现同步迭代，避免测试与实现脱节

**渐进式重构五步法**:

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1. 创建新位置 | 创建目标目录和空文件 | 目录存在 |
| 2. 复制逻辑 | 复制核心逻辑到新位置 | 文件内容正确 |
| 3. 更新引用 | 更新所有 import/require | 无报错 |
| 4. 验证功能 | 运行测试验证功能 | 测试通过 |
| 5. 清理旧位置 | 删除旧文件/目录 | 无残留 |

**架构决策原则**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 通用能力归位原则                                                 │
│                                                                  │
│ 用户可用？ ──► skills/mob-seed/lib/  (插件代码)                  │
│             └► .seed/scripts/        ❌ 项目特定，用户不可见      │
│                                                                  │
│ 示例迁移：                                                       │
│   .seed/scripts/check-cache.js                                   │
│   └──► skills/mob-seed/lib/hooks/cache-checker.js               │
└─────────────────────────────────────────────────────────────────┘
```

**模块设计检查清单**:

- [ ] 新模块放在 `skills/mob-seed/lib/` 下正确子目录
- [ ] 导出的 API 与现有模块风格一致（命名、参数顺序）
- [ ] 测试文件放在 `skills/mob-seed/test/` 对应子目录
- [ ] 测试覆盖所有导出函数
- [ ] 函数签名：通用参数在前（projectPath），特定参数在后

**测试与实现同步迭代**:

```
错误模式:
  写完所有实现 ──► 一次性写所有测试 ──► 发现 10 个失败

正确模式:
  写一个函数 ──► 写对应测试 ──► 验证通过 ──► 下一个函数
```

**教训**:
- ✅ 通用能力必须放在用户可访问的位置（`skills/*/lib/`）
- ✅ 测试要与实现同步写，避免批量失败
- ✅ 函数签名设计要考虑调用者便利性（projectPath 优先）
- ✅ 重构时保持旧代码可用，直到新代码验证通过
- ❌ 禁止把通用能力放在项目特定目录（`.seed/`）
- ❌ 禁止先写完所有代码再写测试（易脱节）

### 20. 禁止跳过 SEED Hook 检查

> **ACE 来源**: v3.4.0 发布时的错误决策

**问题**: v3.4.0 发布时，pre-push hook 报错，我选择用 `git push --no-verify` 跳过检查。

**为什么这是错误决策**:

| 问题 | 分析 |
|------|------|
| 违反 SEED 精神 | D (Defend) 的存在就是守护同步，跳过等于放弃防护 |
| 没先诊断 | 应该先运行 incremental-defender 分析具体错误 |
| 走捷径 | `--no-verify` 是"绕过问题"而非"解决问题" |
| 过度自信 | 假设自己对变更的理解正确，认定是误报 |

**正确做法**:

```
Hook 报错
    ↓
运行 incremental-defender 分析具体错误
    ↓
├── 真问题 → 补充缺失内容
└── 误报 → 修复 hook 检测逻辑
    ↓
正常提交推送（不跳过）
```

**SKIP_SEED_CHECK 的正确使用场景**:
- ✅ 紧急热修复（事后必须补充验证）
- ✅ Hook 本身有 bug 导致无法运行（需同时提 issue 修复）
- ❌ 因为"觉得是误报"就跳过
- ❌ 因为"赶时间发布"就跳过
- ❌ 因为"对自己的代码有信心"就跳过

**教训**:
- ✅ Hook 报错时，先诊断再决策
- ✅ 如果是误报，修复 hook 逻辑而非跳过
- ✅ 如果是真问题，补充缺失内容
- ❌ 禁止因为"觉得是误报"就用 `--no-verify`
- ❌ 禁止因为时间压力走捷径

### 21. init 命令必须通过脚本强制执行

> **ACE 来源**: 用户报告 init 未创建 mission.md (2026-01-12)

**问题**: 在用户项目中执行 `/mob-seed:init` 时，AI 没有创建 `mission.md` 文件，甚至错误地声称 "mob-seed 没有内置的 mission 机制"。

**根因分析**:

| 问题 | 分析 |
|------|------|
| AI 自行实现 | AI 没有遵循 `init.md` 定义的步骤，自己发明了初始化逻辑 |
| 目录结构错误 | 创建了 `specs/` 而非 `openspec/specs/` |
| 遗漏必需文件 | 7 个必需文件只创建了部分 |
| 文档不足以约束 | 仅靠文档说明无法确保 AI 遵循步骤 |

**解决方案**: 程序化强制执行

创建 `scripts/init-project.js` 脚本，包含：
- 所有初始化逻辑集中在脚本中
- 7 个必需文件的创建和验证
- 失败时明确报错

更新 `commands/init.md`：
- 简化为只调用脚本
- 添加强制执行规则表
- 移除 Write/Edit 权限，只保留 Bash/Read/AskUserQuestion

**必需文件清单（7 个）**:
```
.seed/config.json        - SEED 配置
.seed/mission.md         - 项目使命声明 ⭐ 关键
.seed/observations/index.json - ACE 观察索引
openspec/specs/.gitkeep  - 规格目录
openspec/changes/.gitkeep - 变更目录
openspec/project.md      - 项目约定
openspec/AGENTS.md       - AI 工作流
```

**验证命令**:
```bash
# 运行初始化
node "$SKILL_DIR/scripts/init-project.js" .

# 验证初始化结果
node "$SKILL_DIR/scripts/verify-init.js" .
```

**教训**:
- ✅ 复杂命令必须通过脚本执行，而非依赖 AI 遵循文档
- ✅ 移除不必要的工具权限（Write/Edit）可防止 AI 自行实现
- ✅ 脚本内置验证步骤确保所有必需文件都创建
- ❌ 禁止 AI 在 init 命令中手动创建文件
- ❌ 禁止跳过 mission.md 创建

### 22. SKILL.md 必须遵守 Claude Code 加载限制

> **ACE 来源**: 用户报告 /mob-seed 加载内容被简化 (2026-01-12)

**问题**: 用户调用 `/mob-seed` 时，Claude 加载的 SKILL.md 内容被截断/简化，导致关键行为定义丢失。

**根因分析**:

| 限制类型 | 官方限制值 | 原 SKILL.md | 状态 |
|----------|------------|-------------|------|
| 行数限制 | 500 行 | 538 行 | ⚠️ 超出 |
| 字符预算 | 15,000 字符 | 22,975 字节 | ❌ 超出 53% |

**Claude Code Skill 加载机制**:
```
用户调用 /mob-seed
       ↓
Claude Code 通过 Skill tool 加载 SKILL.md
       ↓
检测到超出字符预算
       ↓
截断/简化内容以适应预算
       ↓
用户看到不完整版本
```

**解决方案**: 渐进式披露 (Progressive Disclosure)

```
重构后结构:
skills/mob-seed/
├── SKILL.md (208 行, 6095 字符) ← 核心指令，完整加载
└── REFERENCE.md (详细参考)      ← 按需加载
```

**SKILL.md 内容规范**:

| 必须保留 | 移至 REFERENCE.md |
|----------|-------------------|
| Frontmatter（name, description, allowed-tools） | 目录结构详解 |
| 命令列表和路由表 | 配置说明 |
| 强制启动行为（版本显示） | 完整工作流程图 |
| ACE 行为约定 | Delta 规格格式 |
| OpenSpec 生命周期（简化版） | 输出目录详解 |
| 架构原则（精简版） | 资源引用规范 |

**教训**:
- ✅ SKILL.md 必须保持 <500 行, <15000 字符
- ✅ 详细内容移至 REFERENCE.md，通过链接引用
- ✅ 核心行为定义（强制启动、ACE 约定）必须在 SKILL.md 中
- ✅ 使用渐进式披露模式，按需加载详细内容
- ❌ 禁止在 SKILL.md 中放置大量示例代码或详细流程图
- ❌ 禁止假设 Claude 会完整加载超长 SKILL.md

**验证命令**:
```bash
# 检查 SKILL.md 是否符合限制
wc -l skills/mob-seed/SKILL.md  # 应 < 500
wc -c skills/mob-seed/SKILL.md  # 应 < 15000
```

**参考文档**:
- Claude Code Skills Guide: https://code.claude.com/docs/en/skills.md
- Agent Skills Best Practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

### 23. 简化优于优化：版本缓存移除案例

> **ACE 来源**: 版本缓存一致性问题 (2026-01-12)

**问题**: 版本检查缓存（24h TTL）导致版本升级后仍显示旧版本，需要三层防护机制维护一致性。

**原方案分析**:

| 机制 | 位置 | 复杂度 |
|------|------|--------|
| 被动检测 | version-checker.js: 检查版本变化 | 中 |
| 主动清理 | bump-version.js: 版本更新时清理 | 中 |
| 再次清理 | release.sh: 发布时再次清理 | 高 |

**问题根因**:
1. 缓存收益：节省 2-5 秒/天（10 次 × 200-500ms）
2. 维护成本：三层防护 + 一致性问题
3. 性价比：维护成本 >> 缓存收益

**简化方案**: 移除缓存，直接请求 npm registry

```
修改前:
checkRemoteVersion() {
  1. 检查缓存是否存在
  2. 检查缓存是否过期（24h）
  3. 检查版本是否一致
  4. 决定是否请求远程
  5. 更新缓存
  6. 返回结果
}

修改后:
checkRemoteVersion() {
  1. 请求 npm registry
  2. 返回结果
}
```

**代码变化**:
- 移除：100+ 行缓存相关代码
- 保留：核心版本检查逻辑
- 简化：导出模块从 9 个函数 → 5 个函数

**防御机制**: git hooks 验证版本一致性

```bash
# .git/hooks/pre-commit
if 版本文件被修改; then
  if ! node scripts/bump-version.js --check; then
    阻止提交，提示运行版本同步
  fi
fi
```

**效果对比**:

| 指标 | 移除前 | 移除后 | 变化 |
|------|--------|--------|------|
| 代码行数 | ~240 行 | ~135 行 | -105 行 (-44%) |
| 导出函数 | 9 个 | 5 个 | -4 个 |
| 一致性问题 | 偶发 | 无 | ✅ 解决 |
| 响应延迟 | <10ms | 200-500ms | +200-500ms |
| 维护复杂度 | 高（三层） | 低（无缓存） | ✅ 大幅简化 |

**教训**:
- ✅ **简洁性优先**: 移除不必要的复杂性，即使有小性能损失
- ✅ **权衡决策**: 200-500ms 延迟 vs 维护成本，后者更重要
- ✅ **防御前置**: 用 git hooks 提前发现问题，而非事后修复
- ✅ **直接请求**: 现代网络条件下，直接请求往往比缓存更简单可靠
- ❌ 禁止过度优化：缓存带来的收益无法抵消维护成本
- ❌ 禁止为缓存而缓存：不是所有场景都需要缓存

**适用场景判断**:
- 使用缓存：高频调用（>100 次/天）、延迟敏感（实时系统）
- 不使用缓存：低频调用（<100 次/天）、延迟不敏感（开发工具）
- mob-seed 场景：开发工具，启动频率低 → 不需要缓存

## 缓存文件说明

项目运行时会生成以下缓存文件，用于加速 git hook 检查：

| 文件 | 创建者 | 用途 | 有效期 |
|------|--------|------|--------|
| `.seed/check-cache.json` | `lib/hooks/cache-updater.js` | 增量检查文件哈希缓存，加速 git hook 检查 | 24h |

**注意**：
- 这些文件已在 `.gitignore` 中，不应提交到版本控制
- 版本检查已移除缓存机制，直接请求 npm registry（200-500ms 延迟可接受）

**详细规格**：
- 增量检查缓存：`openspec/specs/automation/git-hooks.fspec.md` (REQ-003)

## 快速开始

```bash
# 1. 统一入口（智能路由）
/mob-seed

# 2. 创建新规格
/mob-seed:spec create feature-name

# 3. 派生代码
/mob-seed:emit

# 4. 运行测试
cd skills/mob-seed && node --test test/**/*.test.js

# 5. 守护同步
/mob-seed:defend
```

## 当前状态

- **版本**: 3.10.0
- **变更提案**: v3.9-file-import (archived)
- **模块**: 50+ 个已实现 (ace/insight-* 模块含 v2.0 双索引架构)
- **测试**: 1854 pass
- **规格**: 50 个规格 (openspec/specs/ + openspec/archive/)
- **ACE 状态**: 外部洞见机制已实现 (/mob-seed:insight)，索引架构 v2.0
