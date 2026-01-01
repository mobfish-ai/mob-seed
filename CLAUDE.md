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

### 命令

| 命令 | 用途 |
|------|------|
| `/mob-seed-spec` | S: 创建/验证规格 |
| `/mob-seed-emit` | E: 派生产物 |
| `/mob-seed-exec` | E: 执行测试 |
| `/mob-seed-defend` | D: 守护同步 |
| `/mob-seed-status` | 查看项目状态 |
| `/mob-seed` | 统一入口 |

### OpenSpec 生命周期

```
draft → review → implementing → archived
```

- `changes/` 目录: 正在实现的变更提案
- `specs/` 目录: 稳定规格
- `archive/` 目录: 已归档历史

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

## 快速开始

```bash
# 1. 检查状态
/mob-seed-status

# 2. 创建新规格
/mob-seed-spec create feature-name

# 3. 派生代码
/mob-seed-emit

# 4. 运行测试
cd skills/mob-seed && node --test test/**/*.test.js

# 5. 守护同步
/mob-seed-defend
```

## 当前状态

- **版本**: 2.0.0 (archived)
- **变更提案**: 无活跃提案
- **模块**: 11/11 已实现
- **测试**: 407 pass
- **规格**: 15 个稳定规格 (openspec/specs/)
