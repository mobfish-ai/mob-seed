# mob-seed 开发指南

## 项目结构

```
mob-seed/                        # 项目根目录
├── .seed/                       # SEED 配置目录
│   ├── config.json              # 核心配置
│   └── mission.yaml             # 使命声明
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
E (Emit)    → 自动派生代码/测试/文档
E (Execute) → 运行测试验证
D (Defend)  → 守护规格与代码同步
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

### 10. SEED 派生必须包含文档

**问题**: `/mob-seed-emit` 只生成了代码和测试，遗漏了文档 (docs/)。

**SEED 完整派生**:
```
Spec (fspec.md) → Code (lib/) + Tests (test/) + Docs (docs/)
```

**正确命令**:
```bash
/mob-seed-emit specs/xxx.fspec.md --all   # 派生所有产物
/mob-seed-emit specs/xxx.fspec.md --docs  # 仅派生文档
```

**文档内容**:
- API 参考文档
- 使用示例
- 配置说明

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
