---
description: SEED 同步 - 同步规格与代码的变更（自动检测前置条件）
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [spec-path] [--direction=<spec|code>] [--dry-run] [--interactive]
---

# mob-seed-sync

执行内容：$ARGUMENTS

## 📦 依赖资源

- 技能目录: `.claude/skills/mob-seed/`
- 工具模块: `adapters/seed-utils.js`
- 差异检测: `adapters/defend-checker.js`

## 执行步骤

### 步骤0: 初始化路径

```bash
# 动态检测技能目录
if [ -d ".claude/skills/mob-seed" ]; then
    SKILL_DIR=".claude/skills/mob-seed"
elif [ -d "$HOME/.claude/skills/mob-seed" ]; then
    SKILL_DIR="$HOME/.claude/skills/mob-seed"
else
    echo "❌ 未找到 mob-seed 技能目录"
    exit 1
fi
```

### 步骤1: 前置检查与自动引导

**检查 SEED 项目是否已初始化**：

1. 检查 `.seed/config.json` 是否存在

**如果未初始化**：
```
⚠️ 当前项目尚未初始化 SEED 结构

需要先执行以下步骤：
1. /mob-seed-init - 智能扫描并初始化配置
2. /mob-seed-spec <功能名> - 创建规格文件

是否现在自动执行初始化？[Y/n]
```

- 用户确认后，自动执行 `/mob-seed-init`
- 初始化完成后，提示用户创建规格文件

**加载配置获取路径**：
```javascript
const config = loadSeedConfig();
const SPECS_DIR = config.paths.specs;  // 可能是 "specs", "docs/specs" 等
```

**检查规格文件是否存在**：

1. 如果提供了 `<spec-path>` 参数，检查文件是否存在
2. 如果未提供参数，扫描 `{config.paths.specs}/` 目录

**如果没有规格文件**：

首先检测是否存在代码目录：
```javascript
// 检测常见代码目录
const codeDirs = ['src/', 'lib/', 'skills/', 'commands/', 'adapters/'];
const existingCode = codeDirs.filter(dir => fs.existsSync(dir));
```

**情况A: 有代码但无规格（逆向同步场景）**：
```
🔍 检测到代码但无规格文件

发现以下代码目录：
- lib/ (15 个文件)
- skills/ (8 个文件)
- commands/ (5 个文件)

这是一个已有代码的项目，建议执行逆向同步：
从代码生成初始规格文件

是否执行逆向同步？[Y/n]
```

用户确认后，执行逆向同步：
1. 扫描代码目录，识别模块结构
2. 提取函数签名、类定义、导出接口
3. 生成 fspec.md 规格文件到 `{specs_dir}/`
4. 生成 CODEBASE_SPEC.md 概览文档

**情况B: 无代码无规格（空项目）**：
```
⚠️ 未找到规格文件和代码

请先创建规格文件：
/mob-seed-spec "功能名称"

是否现在创建一个示例规格？[Y/n]
```

- 用户确认后，引导创建规格文件

**如果有多个规格文件但未指定**：
```
📋 发现以下规格文件：

1. {specs_dir}/user-auth.fspec.md
2. {specs_dir}/payment.fspec.md
3. {specs_dir}/notification.fspec.md

请选择要同步的规格（输入编号或路径）：
```

> 注：`specs_dir` 来自 `.seed/config.json` 的 `paths.specs` 配置

### 步骤2: 解析参数

从 `$ARGUMENTS` 中解析：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<spec-path>` | 规格文件路径 | 可选（交互选择） |
| `--direction` | 同步方向 (spec→code 或 code→spec) | spec |
| `--dry-run` | 只显示将要执行的操作 | false |
| `--interactive` | 交互式确认每个操作 | false |

### 步骤3: 检测差异

调用 DefendChecker 检测规格与代码的差异。

### 步骤4: 确定同步方向

#### spec → code（规格为准）

将代码同步到规格定义：
- 生成缺失的代码骨架
- 更新文档版本
- 生成缺失的测试骨架

#### code → spec（代码为准）

将规格同步到代码实现：
- 在规格中添加额外功能的 FR
- 更新规格版本号

### 步骤5: 执行同步

#### Dry Run 模式

```
🔄 同步预览: user-auth (spec → code)

将执行以下操作:

1. [CREATE] src/user-auth/resetPassword.js
   - 为 FR-003 生成代码骨架

2. [CREATE] test/user-auth/ac-003.test.js
   - 为 AC-003 生成测试骨架

3. [UPDATE] docs/user-auth.md
   - 更新版本号 1.1.0 → 1.2.0

确认执行? [y/N]
```

#### 实际执行

```
🔄 正在同步: user-auth

⏳ 生成 FR-003 代码骨架...
✅ 创建 src/user-auth/resetPassword.js

⏳ 生成 AC-003 测试骨架...
✅ 创建 test/user-auth/ac-003.test.js

⏳ 更新文档版本...
✅ 更新 docs/user-auth.md

---
✅ 同步完成

已创建: 2 个文件
已更新: 1 个文件
```

### 步骤6: 生成同步报告

```
📊 同步报告: user-auth

执行时间: 2024-12-28 10:35:00
同步方向: spec → code

| 操作 | 文件 | 状态 |
|------|------|------|
| CREATE | src/user-auth/resetPassword.js | ✅ |
| CREATE | test/user-auth/ac-003.test.js | ✅ |
| UPDATE | docs/user-auth.md | ✅ |

下一步:
1. 实现 resetPassword.js 中的 TODO
2. 完善 ac-003.test.js 中的测试断言
3. 运行 /mob-seed-exec --test 验证
```

## 同步规则

> ⚠️ **重要**: 文档从代码派生，不是从规格派生！
> 派生链: `Spec → Code → Docs`

### spec → code（默认）

| 差异类型 | 同步动作 |
|----------|----------|
| FR 未实现 | 生成代码骨架（带 TODO） |
| AC 无测试 | 生成测试骨架（带 TODO） |
| 文档过时 | **从代码重新生成文档**（不是从规格！） |
| 额外代码 | 不处理（提示警告） |

**文档同步**: 当代码变更后，从代码提取 API 签名、JSDoc 等重新生成文档。

### code → spec

| 差异类型 | 同步动作 |
|----------|----------|
| 额外功能 | 在规格中添加 FR |
| 额外测试 | 在规格中添加 AC |
| 版本不符 | 更新规格版本 |

## 安全机制

1. **Dry Run**: 默认先预览，需确认才执行
2. **备份**: 修改前自动备份原文件
3. **Git**: 建议在同步前提交当前更改
4. **回滚**: 保留同步日志，支持回滚

## 示例用法

```bash
# 自动检测并引导（无参数）
/mob-seed-sync

# 预览同步操作
/mob-seed-sync seed/specs/user-auth.fspec.md --dry-run

# 执行同步（规格为准）
/mob-seed-sync seed/specs/user-auth.fspec.md

# 代码为准的同步
/mob-seed-sync seed/specs/user-auth.fspec.md --direction=code

# 交互式同步
/mob-seed-sync seed/specs/user-auth.fspec.md --interactive
```

## 自动引导流程

```
用户执行 /mob-seed-sync
        ↓
    检查 .seed/ 目录
        ↓
   ┌────┴────┐
   ↓         ↓
 不存在     存在
   ↓         ↓
 询问是否   检查规格文件
 初始化         ↓
   ↓      ┌────┴────┐
 Y → 执行  ↓         ↓
 init    无文件    有文件
   ↓       ↓         ↓
 继续流程  检测代码   ┌────┴────┐
           ↓        ↓         ↓
      ┌───┴───┐   单个       多个
      ↓       ↓   直接执行   列表选择
    有代码   无代码   ↓         ↓
      ↓       ↓     └────┬────┘
    逆向    创建          ↓
    同步    示例      执行同步
      ↓       ↓
      └───────┴─────────────┘
                  ↓
              执行同步
```

## 逆向同步详细流程

当检测到"有代码但无规格"时，执行以下步骤：

### 步骤R1: 扫描代码结构

```javascript
// 扫描代码目录
const scanResult = {
  directories: ['lib/', 'skills/', 'commands/'],
  modules: [],
  totalFiles: 0
};

// 识别模块
for (const dir of scanResult.directories) {
  const modules = identifyModules(dir);
  scanResult.modules.push(...modules);
}
```

### 步骤R2: 分析模块接口

对每个模块提取：
- 导出的函数/类
- 函数参数和返回类型
- JSDoc 注释
- 依赖关系

### 步骤R3: 生成规格文件

```
📝 正在生成规格文件...

⏳ 分析 lib/lifecycle/ ...
✅ 生成 specs/lifecycle.fspec.md
   - 3 个功能需求 (FR)
   - 5 个验收标准 (AC)

⏳ 分析 lib/stacks/ ...
✅ 生成 specs/stacks.fspec.md
   - 2 个功能需求 (FR)
   - 4 个验收标准 (AC)

---
✅ 逆向同步完成

生成规格: 2 个
功能需求: 5 个
验收标准: 9 个

下一步:
1. 审查生成的规格文件
2. 补充业务细节和边界条件
3. 运行 /mob-seed-sync 验证同步状态
```

### 步骤R4: 生成项目概览

生成 `CODEBASE_SPEC.md`：
```markdown
# 项目代码规格概览

## 模块结构

| 模块 | 路径 | 功能 | 规格文件 |
|------|------|------|----------|
| lifecycle | lib/lifecycle/ | 生命周期管理 | specs/lifecycle.fspec.md |
| stacks | lib/stacks/ | 技术栈支持 | specs/stacks.fspec.md |

## 依赖关系

[模块依赖图]

## 同步状态

✅ 所有代码已有对应规格
```
