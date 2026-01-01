# 变更提案: v2.1-release-automation

> 状态: archived
> 归档日期: 2026-01-01
> 创建: 2026-01-01
> 作者: Claude
> 进度跟踪: 见 tasks.md（执行记录）

## 概述

实现完整的闭环自动化开发流程：命令统一、流程自动触发、状态自动进化、版本同步发布。核心目标是**最小化手动操作**，让各个环节的动作**环环相扣**。

## 设计理念

### 闭环自动化原则

```
┌─────────────────────────────────────────────────────────────┐
│                    SEED 闭环自动化                           │
│                                                             │
│   ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐            │
│   │ Spec │───→│ Emit │───→│ Exec │───→│Defend│            │
│   └──────┘    └──────┘    └──────┘    └──────┘            │
│       ↑                                   │                 │
│       └───────────────────────────────────┘                 │
│                    自动反馈                                  │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：
1. **一键触发**: 用户只需执行一个命令，后续流程自动衔接
2. **智能建议**: 检测到问题后自动分析并给出最优行动建议
3. **确认即执行**: 用户只需确认(Y/N)，无需手动输入命令
4. **状态自进化**: 规格状态根据实际进展自动更新
5. **异常自愈**: 检测到漂移时自动修复或引导修复

## 问题背景

### 1. 命令碎片化与命名不规范
当前有 11 个独立命令，且使用连字符命名（不符合业界惯例）：
- `/mob-seed-status` - 查看状态
- `/mob-seed-sync` - 同步检查
- `/mob-seed-defend` - 守护检查
- `/mob-seed-spec` - 规格定义
- `/mob-seed-emit` - 自动派生
- `/mob-seed-exec` - 自动执行
- `/mob-seed-init` - 初始化
- `/mob-seed-archive` - 归档
- `/mob-seed-diff` - 差异对比
- `/mob-seed-edit` - 编辑规格

**问题**：
1. 命令过多（11 个），认知负担重
2. 连字符命名不符合 Git/npm/Docker 等业界标准
3. status/sync/defend/diff 功能重叠
4. 用户需要分别执行，无法一步到位

### 2. 流程断裂
检测到问题后需要用户：
1. 阅读问题描述
2. 决定下一步操作
3. 手动输入命令
4. 再次检查结果

**期望**: 检测 → 建议 → 确认 → 执行 → 验证，全自动衔接。

### 3. 状态更新滞后
规格文件中的 FR/AC 状态需要手动维护：
- 测试通过后需手动标记 `[x]`
- 可归档时需手动运行 archive
- 版本号需手动同步多个文件

### 4. 版本文件不同步
v2.0.0 发布时发现：
- `package.json`: 1.2.0
- `.claude-plugin/plugin.json`: 1.2.0
- `skills/mob-seed/package.json`: 1.0.0

## 解决方案

### 1. 命令体系重构

#### 1.1 设计原则

遵循业界标准的**子命令模式**（空格分隔），对齐 SEED 四字诀：

```
┌─────────────────────────────────────────────────────────────────┐
│                    /mob-seed 命令体系 v2.1                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /mob-seed                    # 智能状态面板（默认入口）         │
│  /mob-seed init               # 项目初始化                       │
│  /mob-seed spec [name]        # S: 规格管理                      │
│  /mob-seed emit [path]        # E: 自动派生                      │
│  /mob-seed exec [path]        # E: 执行测试                      │
│  /mob-seed defend [path]      # D: 守护检查                      │
│  /mob-seed archive [proposal] # 归档提案                         │
│                                                                  │
│  总计: 6 个子命令（从 11 个减少 45%）                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.2 命令对照表

| 旧命令 | 新命令 | 说明 |
|--------|--------|------|
| `/mob-seed-init` | `/mob-seed init` | 子命令化 |
| `/mob-seed-spec` | `/mob-seed spec` | 子命令化 |
| `/mob-seed-emit` | `/mob-seed emit` | 子命令化 |
| `/mob-seed-exec` | `/mob-seed exec` | 子命令化 |
| `/mob-seed-defend` | `/mob-seed defend` | 子命令化 |
| `/mob-seed-archive` | `/mob-seed archive` | 子命令化 |
| `/mob-seed-status` | `/mob-seed` | **移除**，融入默认入口 |
| `/mob-seed-sync` | `/mob-seed defend --sync` | **移除**，融入 defend |
| `/mob-seed-diff` | `/mob-seed defend --diff` | **移除**，融入 defend |
| `/mob-seed-edit` | `/mob-seed spec --edit` | **移除**，融入 spec |
| `/mob-seed` (旧) | `/mob-seed` (新) | 重新定义为智能入口 |

#### 1.3 智能入口 `/mob-seed`

无参数执行时，自动进行全量检查 + 建议行动：

```
/mob-seed
  │
  ├── 1. 项目检测
  │   ├── 检查 .seed/config.json 存在
  │   ├── 加载项目配置
  │   └── 识别当前活动提案
  │
  ├── 2. 状态收集
  │   ├── 规格状态 (draft/review/implementing/archived)
  │   ├── 代码覆盖 (已派生/未派生)
  │   ├── 测试结果 (通过/失败/未运行)
  │   └── AC 完成度 (N/M 完成)
  │
  ├── 3. 同步检查
  │   ├── 规格 ↔ 代码 一致性
  │   ├── 规格 ↔ 测试 覆盖度
  │   └── 规格 ↔ 文档 同步性
  │
  ├── 4. 漂移检测
  │   ├── 新增检测 (代码有但规格无)
  │   ├── 缺失检测 (规格有但代码无)
  │   └── 不一致检测 (实现与规格不符)
  │
  └── 5. 输出报告 + 建议行动
```

**全局选项**:

| 选项 | 行为 |
|------|------|
| 无参数 | 全量检查 + 建议行动 |
| `--quick` | 快速检查（秒级完成） |
| `--fix` | 自动修复可修复的问题 |
| `--auto` | 自动执行所有建议（无需确认） |
| `--ci` | CI 模式（严格检查，失败则退出码非零） |
| `--strict` | 严格模式（警告也算失败） |

### 2. 闭环自动触发流程

#### 2.1 问题 → 行动映射

```
┌─────────────┬───────────────────────┬─────────────────────────┐
│ 检测到问题   │ 自动建议              │ 用户交互                │
├─────────────┼───────────────────────┼─────────────────────────┤
│ 规格未派生   │ → /mob-seed emit      │ [Y] 立即派生            │
│ 测试未运行   │ → /mob-seed exec      │ [Y] 运行测试            │
│ 测试失败     │ → 修复指导 + 重新执行  │ [Y] 查看失败详情        │
│ 文档未生成   │ → /mob-seed emit --docs│ [Y] 生成文档            │
│ 文档过时     │ → /mob-seed emit --docs│ [Y] 更新文档            │
│ AC 未完成    │ → 更新规格状态        │ [Y] 自动标记已完成 AC   │
│ 代码漂移     │ → 逆向同步建议        │ [Y] 同步到规格          │
│ 可归档       │ → /mob-seed archive   │ [Y] 执行归档            │
│ 版本不一致   │ → bump-version        │ [Y] 同步版本            │
└─────────────┴───────────────────────┴─────────────────────────┘
```

**文档派生链**: `Spec → Code → Docs`（文档从代码派生，不是直接从规格派生）

#### 2.2 链式触发

每个操作完成后自动触发下一步检查：

```
emit 完成 → 自动检查: 是否需要运行测试？
                 ↓ [Y]
exec 完成 → 自动检查: AC 是否全部通过？
                 ↓ [Y]
更新 AC   → 自动检查: 是否可以归档？
                 ↓ [Y]
archive   → 自动检查: 版本是否需要更新？
```

#### 2.3 Git Hooks 集成

```bash
# .seed/hooks/pre-commit (快速检查)
/mob-seed --quick --ci
# 通过才能提交

# .seed/hooks/pre-push (增量检查)
/mob-seed --ci
# 通过才能推送

# .seed/hooks/post-merge (同步检查)
/mob-seed defend --sync
# 合并后自动检查同步状态
```

### 3. 状态自动进化

#### 3.1 OpenSpec 生命周期自动化

```
draft ──────────→ review ──────────→ implementing ──────────→ archived
  │   [规格完整]    │   [用户确认]       │       [AC全通过]      │
  │                 │                    │                       │
  └─ 自动检测 ──────┴─ 等待确认 ─────────┴─ 自动检测 ────────────┘
```

**自动转换条件**:

| 当前状态 | 目标状态 | 自动触发条件 |
|---------|---------|-------------|
| draft | review | 规格通过 linter 检查 |
| review | implementing | 用户确认开始实现 |
| implementing | archived | 所有 AC 标记完成 + 测试通过 |

#### 3.2 AC 状态自动更新

```javascript
// 测试运行后自动更新对应 AC
exec 结果:
  ✓ test/user-auth.test.js (AC-001, AC-002)
  ✓ test/login-flow.test.js (AC-003)

→ 自动更新 fspec:
  - [x] AC-001: 用户可以注册 ← 自动标记
  - [x] AC-002: 用户可以登录 ← 自动标记
  - [x] AC-003: 登录失败显示错误 ← 自动标记
```

#### 3.3 进度可视化

```
/mob-seed 输出:

╔══════════════════════════════════════════════════════════════╗
║  📊 v2.1-release-automation 进度面板                          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  状态: implementing                                          ║
║  进度: ████████████████░░░░ 80%                             ║
║                                                              ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ 📋 规格: 4/4 完成                                        │ ║
║  │ 💻 代码: 3/4 已派生                                      │ ║
║  │ 🧪 测试: 12/15 通过                                      │ ║
║  │ ✅ AC:   8/10 完成                                       │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                                              ║
║  ⚠️  待处理:                                                 ║
║  • lib/workflow/action-suggest.js 未派生                     ║
║  • 3 个测试失败                                              ║
║  • AC-009, AC-010 未完成                                     ║
║                                                              ║
║  💡 建议行动:                                                ║
║  [1] 派生 action-suggest.js                                  ║
║  [2] 修复失败的测试                                          ║
║                                                              ║
║  选择操作 (1/2/a=全部/n=跳过): _                             ║
╚══════════════════════════════════════════════════════════════╝
```

### 4. 版本同步自动化

#### 4.1 发布流程

```bash
# 一键发布
./scripts/release.sh v2.1.0
```

自动执行：
1. ✓ 验证版本格式 (semver)
2. ✓ 检查工作区干净
3. ✓ 运行测试确保通过
4. ✓ 更新所有版本文件
5. ✓ 生成 CHANGELOG 条目
6. ✓ 创建 commit: "chore(release): v2.1.0"
7. ✓ 创建 tag: v2.1.0
8. ✓ 推送触发 CI
9. ✓ CI 自动发布 GitHub Release

#### 4.2 版本文件清单

| 文件 | 字段 | 说明 |
|------|------|------|
| `package.json` | version | 主版本 |
| `.claude-plugin/plugin.json` | version | 插件版本 |
| `skills/mob-seed/package.json` | version | 技能版本 |

#### 4.3 版本检查 (CI)

```yaml
# .github/workflows/release.yml
- name: Verify version sync
  run: |
    TAG_VERSION=${GITHUB_REF#refs/tags/v}
    PKG_VERSION=$(node -p "require('./package.json').version")
    PLUGIN_VERSION=$(node -p "require('./.claude-plugin/plugin.json').version")

    if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
      echo "Version mismatch: tag=$TAG_VERSION, package.json=$PKG_VERSION"
      exit 1
    fi
```

### 5. 用户体验提升

#### 5.1 交互式确认

```
检测到 3 个可修复问题:

[1] 📝 lib/workflow/action-suggest.js 未派生
    → 自动派生代码框架

[2] 🧪 3 个测试失败
    → 查看失败详情并提供修复建议

[3] 📊 AC-009, AC-010 未标记完成
    → 根据测试结果自动标记

选择操作:
  [a] 全部执行
  [1-3] 选择单个
  [n] 跳过
  [q] 退出

>
```

#### 5.2 智能上下文感知

```
# 场景1: 刚创建新规格
/mob-seed
→ 检测到新规格 user-auth.fspec.md
→ 建议: [Y] 开始派生代码？

# 场景2: 修改了规格
/mob-seed
→ 检测到规格变更 (REQ-003 修改)
→ 建议: [Y] 重新派生受影响的代码？

# 场景3: 测试全部通过
/mob-seed
→ 所有测试通过，AC 100% 完成
→ 建议: [Y] 归档此提案？
```

#### 5.3 错误恢复

```
执行中断? 继续上次操作:

/mob-seed --resume

恢复点: emit action-suggest.js (50% 完成)
[Y] 继续 / [N] 重新开始 / [S] 跳过
```

### 6. Mission 原则检查集成

#### 6.1 各环节 Mission 对齐验证

将 Mission 原则检查集成到 SEED 各阶段：

```
┌──────────┬─────────────────────────────────────────────────┐
│  阶段    │ Mission 检查内容                                │
├──────────┼─────────────────────────────────────────────────┤
│ Spec     │ 规格是否符合核心原则？是否触犯反目标？           │
│ Emit     │ 派生策略是否符合简单优先原则？                   │
│ Exec     │ 测试覆盖是否满足质量要求？                       │
│ Defend   │ 变更是否偏离使命？对齐分数是否达标？             │
└──────────┴─────────────────────────────────────────────────┘
```

**对齐度检查流程**:

```javascript
// 每个阶段开始时
const alignment = evaluateAlignment(mission, {
  description: '当前操作描述',
  type: 'emit|exec|defend',
  affectedPrinciples: ['spec_first', 'simplicity']
});

if (!alignment.meetsThreshold) {
  // 警告但不阻止（除非 --strict 模式）
  console.warn(`⚠️ 对齐分数 ${alignment.total} < 阈值 0.7`);
  console.warn(`违反原则: ${alignment.violations.join(', ')}`);
}
```

**自动建议**:

| 对齐问题 | 建议行动 |
|----------|----------|
| 触犯 feature_creep | 建议拆分为独立提案 |
| 触犯 over_engineering | 建议简化实现 |
| 触犯 sync_breaking | 强制要求先更新规格 |
| 分数 < 0.5 | 阻止操作，要求人工审核 |

#### 6.2 三层检查机制 + 缓存复用

基于现有 `quick-defend.js` 和 `incremental-defend.js`，扩展为完整的三层检查体系：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        三层检查架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: Quick Check (秒级)         ←── pre-commit / --quick      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • staged 文件基础检查                                        │   │
│  │ • 规格语法验证                                               │   │
│  │ • 基本同步检查                                               │   │
│  │ • 缓存: 基于文件 hash                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              ↓ 结果缓存 → Layer 2 复用                              │
│                                                                     │
│  Layer 2: Incremental Check (十秒级)  ←── pre-push / 默认模式      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • 复用 Layer 1 已通过的检查结果                              │   │
│  │ • SEED 四字诀完整验证                                        │   │
│  │ • Mission 原则对齐检查                                       │   │
│  │ • 派生链完整性验证                                           │   │
│  │ • 缓存: 基于 commit hash                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│              ↓ 结果缓存 → Layer 3 复用                              │
│                                                                     │
│  Layer 3: Full Check (分钟级)         ←── CI / --full / --strict   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • 复用 Layer 2 已通过的检查结果                              │   │
│  │ • 完整测试运行                                               │   │
│  │ • AC 状态验证                                                │   │
│  │ • 文档同步检查                                               │   │
│  │ • 版本一致性检查                                             │   │
│  │ • 缓存: 基于测试结果 + 时间戳                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**层级间复用规则**:

| 当前层 | 复用来源 | 跳过条件 |
|--------|----------|----------|
| Layer 2 | Layer 1 | 如果 Layer 1 结果有效且文件未变更 |
| Layer 3 | Layer 2 | 如果 Layer 2 结果有效且 commit 未变更 |
| 同层重复 | 上次结果 | 如果缓存未过期且依赖未变更 |

**缓存实现**:

```javascript
// lib/cache/layered-cache.js
class LayeredCache {
  constructor() {
    this.layers = {
      quick: new Map(),      // Layer 1: 文件级缓存
      incremental: new Map(), // Layer 2: commit 级缓存
      full: new Map()         // Layer 3: 会话级缓存
    };
  }

  /**
   * 获取缓存，自动检查依赖层
   */
  get(layer, key, dependencies = {}) {
    const cache = this.layers[layer];
    const item = cache.get(key);

    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      cache.delete(key);
      return null;
    }

    // 检查依赖层是否仍然有效
    if (dependencies.requiresLayer) {
      const depLayer = dependencies.requiresLayer;
      const depKey = dependencies.key;
      if (!this.isValid(depLayer, depKey)) {
        cache.delete(key);
        return null;
      }
    }

    return item.value;
  }

  /**
   * 设置缓存
   */
  set(layer, key, value, options = {}) {
    const ttl = options.ttl || this.getDefaultTTL(layer);
    this.layers[layer].set(key, {
      value,
      expiresAt: Date.now() + ttl,
      dependencies: options.dependencies
    });
  }

  /**
   * 获取默认 TTL
   */
  getDefaultTTL(layer) {
    switch (layer) {
      case 'quick': return 60 * 1000;        // 1 分钟
      case 'incremental': return 5 * 60 * 1000; // 5 分钟
      case 'full': return 30 * 60 * 1000;    // 30 分钟
      default: return 5 * 60 * 1000;
    }
  }
}
```

**文件变更自动失效**:

```javascript
// 基于文件 hash 的缓存键
function getCacheKey(files) {
  const hashes = files.map(f => {
    const content = fs.readFileSync(f, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  });
  return hashes.sort().join(':');
}

// 检查是否需要重新运行
function shouldRecheck(cacheKey, cachedResult) {
  if (!cachedResult) return true;
  return cachedResult.cacheKey !== cacheKey;
}
```

**会话内复用流程**:

```
/mob-seed 首次执行:

1. Layer 1: 快速检查 ───→ 缓存结果 (file-hash: result-1)
2. Layer 2: 增量检查 ───→ 缓存结果 (commit-hash: result-2)
3. Layer 3: 完整检查 ───→ 缓存结果 (session-id: result-3)

/mob-seed 再次执行 (文件未变):

1. Layer 1: 检查缓存 ───→ [命中] ───→ 跳过，复用 result-1
2. Layer 2: 检查缓存 ───→ [命中] ───→ 跳过，复用 result-2
3. Layer 3: 检查缓存 ───→ [命中] ───→ 跳过，复用 result-3
                                       ↓
                                    秒级完成！

/mob-seed 再次执行 (部分文件变更):

1. Layer 1: 检查变更文件 ───→ 仅检查变更的
2. Layer 2: 复用未变更的 ───→ 增量更新结果
3. Layer 3: 失效需重新验证 ───→ 重新运行完整检查
```

### 7. 命令清理（直接移除）

由于目前无外部用户依赖，v2.1 直接移除废弃命令，不保留兼容层：

#### 7.1 移除的命令文件

```bash
# 直接删除以下文件
commands/mob-seed-status.md   # 功能融入 /mob-seed 默认入口
commands/mob-seed-sync.md     # 功能融入 /mob-seed defend --sync
commands/mob-seed-diff.md     # 功能融入 /mob-seed defend --diff
commands/mob-seed-edit.md     # 功能融入 /mob-seed spec --edit
```

#### 7.2 重命名的命令文件

```bash
# 所有命令改为子命令模式
commands/mob-seed-init.md    → commands/mob-seed/init.md
commands/mob-seed-spec.md    → commands/mob-seed/spec.md
commands/mob-seed-emit.md    → commands/mob-seed/emit.md
commands/mob-seed-exec.md    → commands/mob-seed/exec.md
commands/mob-seed-defend.md  → commands/mob-seed/defend.md
commands/mob-seed-archive.md → commands/mob-seed/archive.md
commands/mob-seed.md         → commands/mob-seed/index.md (主入口)
```

## 规格文件

| 规格 | 说明 | 优先级 |
|------|------|--------|
| `specs/workflow/unified-command.fspec.md` | 统一命令入口 | P0 |
| `specs/workflow/action-suggest.fspec.md` | 行动建议引擎 | P0 |
| `specs/workflow/state-evolution.fspec.md` | 状态自动进化 | P1 |
| `specs/automation/version-sync.fspec.md` | 版本同步 | P0 |
| `specs/automation/release-flow.fspec.md` | 发布流程 | P1 |
| `specs/cache/session-cache.fspec.md` | 会话级缓存 | P1 |
| `specs/mission/integration.fspec.md` | Mission 集成检查 | P1 |
| `specs/ux/interactive-mode.fspec.md` | 交互式体验 | P2 |

## 验收标准

### 命令统一 (P0)
- [ ] AC-001: `/mob-seed` 无参数执行全量检查
- [ ] AC-002: 输出包含状态 + 同步 + 守护三部分
- [ ] AC-003: `--quick` 模式秒级完成
- [ ] AC-004: `--fix` 自动修复简单问题
- [ ] AC-005: `--auto` 无需确认自动执行

### 闭环自动化 (P0)
- [ ] AC-006: 检测问题后输出建议行动列表
- [ ] AC-007: 用户确认后自动执行建议
- [ ] AC-008: 操作完成后自动触发下一步检查
- [ ] AC-009: Git hooks 集成 pre-commit/pre-push

### 状态进化 (P1)
- [ ] AC-010: 测试通过后自动更新 AC 状态
- [ ] AC-011: AC 全完成后提示归档
- [ ] AC-012: 进度可视化面板

### 版本同步 (P0)
- [ ] AC-013: release.sh 更新所有版本文件
- [ ] AC-014: CI 检查 tag 版本与文件版本一致
- [ ] AC-015: 版本不一致时阻止发布

### 用户体验 (P2)
- [ ] AC-016: 交互式确认流程
- [ ] AC-017: 智能上下文建议
- [ ] AC-018: 错误恢复机制

### Mission 集成 (P1)
- [ ] AC-019: 各 SEED 阶段执行 Mission 对齐检查
- [ ] AC-020: 对齐分数低于阈值时输出警告
- [ ] AC-021: --strict 模式下对齐不达标阻止操作
- [ ] AC-022: 会话级缓存避免重复加载 Mission
- [ ] AC-023: 文件变更时自动失效缓存

## 影响范围

### 新增
- `scripts/release.sh` - 发布脚本
- `scripts/bump-version.js` - 版本同步工具
- `lib/workflow/action-suggest.js` - 行动建议引擎
- `lib/workflow/state-evolution.js` - 状态进化器
- `lib/workflow/unified-command.js` - 统一命令入口
- `lib/cache/session-cache.js` - 会话级缓存
- `lib/mission/integration.js` - Mission 集成检查
- `lib/ux/interactive-prompt.js` - 交互式提示
- `lib/ux/progress-panel.js` - 进度面板
- `docs/guide/releasing.md` - 发布指南

### 修改
- `SKILL.md` - 更新命令说明
- `prompts/seed.md` - 合并为统一 prompt
- `.github/workflows/release.yml` - 添加版本检查
- `.seed/hooks/` - 更新 Git hooks

### 删除（直接移除，无兼容）
- `commands/mob-seed-status.md` - 功能融入 `/mob-seed` 默认入口
- `commands/mob-seed-sync.md` - 功能融入 `/mob-seed defend --sync`
- `commands/mob-seed-diff.md` - 功能融入 `/mob-seed defend --diff`
- `commands/mob-seed-edit.md` - 功能融入 `/mob-seed spec --edit`
- `prompts/status.md` - 合并到 `prompts/seed.md`
- `prompts/sync.md` - 合并到 `prompts/seed.md`
- `prompts/defend-*.md` - 合并到 `prompts/seed.md`

### 重构（命令目录结构）
```
commands/
├── mob-seed.md              → 删除（旧主入口）
├── mob-seed-*.md            → 删除（旧子命令）
└── mob-seed/                → 新建（子命令目录）
    ├── index.md             # 主入口 /mob-seed
    ├── init.md              # /mob-seed init
    ├── spec.md              # /mob-seed spec
    ├── emit.md              # /mob-seed emit
    ├── exec.md              # /mob-seed exec
    ├── defend.md            # /mob-seed defend
    └── archive.md           # /mob-seed archive
```

## 实施路径

> **重要**: 本节与 `tasks.md` 保持完全同步。修改任一文件时必须同步更新另一文件。

### Phase 1: 基础设施 (P0) ✅
1. 版本同步工具 (`bump-version.js`)
2. 发布脚本 (`release.sh`)
3. CI 版本检查
4. 同步当前版本到 2.0.0

### Phase 2: 规格设计 ✅
1. 编写 8 个 fspec 规格文件（详见 `specs/` 目录）

### Phase 3: 命令体系重构 (P0)
1. 创建 `commands/mob-seed/` 子命令目录
2. 迁移命令文件到子命令模式
3. 删除废弃命令（status/sync/diff/edit）
4. 实现统一智能入口逻辑 (`lib/workflow/unified-command.js`)
5. 合并 prompts 文件为 `prompts/seed.md`
6. 更新 SKILL.md 命令说明

### Phase 4: 闭环自动化 (P0)
1. 行动建议引擎 (`lib/workflow/action-suggest.js`)
2. 链式触发机制
3. 用户确认后自动执行建议
4. Git hooks 更新

### Phase 5: Mission 集成 (P1)
1. 会话级缓存 (`lib/cache/session-cache.js`)
2. Mission 集成检查 (`lib/mission/integration.js`)
3. 各 SEED 阶段对齐验证
4. 文件变更监听自动失效缓存

### Phase 6: 状态进化 (P1)
1. 状态自动进化器 (`lib/workflow/state-evolution.js`)
2. AC 测试通过后自动更新状态
3. AC 全完成后自动提示归档
4. 进度可视化面板

### Phase 7: 用户体验 (P2)
1. 交互式确认流程 (`lib/ux/interactive-prompt.js`)
2. 智能上下文感知
3. 错误恢复机制 (`--resume`)
4. 编写发布指南 `docs/guide/releasing.md`

## 预期收益

| 维度 | 现状 | 改进后 |
|------|------|--------|
| 命令数量 | 11 个独立命令 | 6 个子命令 (-45%) |
| 命令风格 | 连字符命名（非标准） | 空格子命令（业界标准） |
| 检查命令 | 3 个命令分别执行 | 1 个命令全覆盖 |
| 手动操作 | 检测 → 决策 → 输入 → 验证 | 检测 → 确认(Y) |
| AC 更新 | 手动编辑规格文件 | 测试通过自动标记 |
| 发布流程 | 手动改版本 → commit → tag | 一键 release.sh |
| 版本同步 | 容易遗漏某个文件 | 脚本保证一致 |
| 学习成本 | 记忆 11 个命令 | 只需记忆 `/mob-seed` + 6 个子命令 |

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 自动操作误触发 | 中 | 高 | 所有危险操作需确认 |
| 状态判断错误 | 低 | 中 | 增加人工审核选项 |
| 命令习惯迁移 | 低 | 低 | 无外部用户，直接移除旧命令 |

## 依赖

- v2.0.0 已发布 ✅
