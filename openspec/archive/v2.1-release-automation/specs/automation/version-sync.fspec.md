# version-sync 规格

> 版本: 1.0.0
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P0

## 概述 (Overview)

版本同步工具，确保项目中所有版本文件保持一致，解决 v2.0.0 发布时发现的版本不同步问题。

### 目标用户
- 项目维护者
- 发布流程执行者

### 核心价值
- 一键同步所有版本文件
- 防止版本遗漏导致的发布问题
- CI 自动检查版本一致性

## 需求 (Requirements)

### 功能需求

- [ ] FR-001: 版本读取 - 读取所有版本文件的当前版本
- [ ] FR-002: 版本验证 - 检查版本格式是否符合 semver
- [ ] FR-003: 版本比较 - 检测版本文件间的不一致
- [ ] FR-004: 版本更新 - 更新所有版本文件到指定版本
- [ ] FR-005: 变更检测 - 检测自上次发布以来的变更

### 非功能需求

- [ ] NFR-001: 同步操作 < 1 秒
- [ ] NFR-002: 支持 dry-run 模式
- [ ] NFR-003: 原子性更新（全部成功或回滚）

## 约束 (Constraints)

### 技术约束
- 版本格式遵循 semver (x.y.z)
- 支持 JSON 和 YAML 格式的版本文件
- 使用 Node.js 实现

### 业务约束
- 版本只能递增
- major/minor/patch 遵循 semver 规则

## 接口设计 (Interface)

### 版本文件清单

| 文件 | 字段 | 说明 |
|------|------|------|
| `package.json` | version | 主版本 |
| `.claude-plugin/plugin.json` | version | 插件版本 |
| `skills/mob-seed/package.json` | version | 技能版本 |

### CLI 接口

```bash
# 检查版本一致性
node scripts/bump-version.js --check

# 同步到指定版本
node scripts/bump-version.js 2.1.0

# 递增 patch 版本
node scripts/bump-version.js --patch

# 递增 minor 版本
node scripts/bump-version.js --minor

# 递增 major 版本
node scripts/bump-version.js --major

# 预览模式（不实际修改）
node scripts/bump-version.js 2.1.0 --dry-run
```

### API 接口

```javascript
// scripts/bump-version.js

/**
 * 版本文件配置
 */
const VERSION_FILES = [
  { path: 'package.json', field: 'version' },
  { path: '.claude-plugin/plugin.json', field: 'version' },
  { path: 'skills/mob-seed/package.json', field: 'version' }
];

/**
 * 读取所有版本
 * @returns {VersionInfo[]}
 */
function readAllVersions();

/**
 * 检查版本一致性
 * @returns {ConsistencyResult}
 */
function checkConsistency();

/**
 * 验证 semver 格式
 * @param {string} version - 版本字符串
 * @returns {boolean}
 */
function validateSemver(version);

/**
 * 更新所有版本文件
 * @param {string} newVersion - 新版本
 * @param {object} options - 选项
 * @returns {UpdateResult}
 */
function updateAllVersions(newVersion, options);

/**
 * 递增版本
 * @param {string} current - 当前版本
 * @param {'major'|'minor'|'patch'} type - 递增类型
 * @returns {string} 新版本
 */
function incrementVersion(current, type);
```

## 验收标准 (Acceptance Criteria)

### AC-013: release.sh 更新所有版本文件
- Given: 当前版本为 2.0.0
- When: 执行 `./scripts/release.sh v2.1.0`
- Then: 所有版本文件更新为 2.1.0

### AC-014: CI 检查版本一致性
- Given: tag 为 v2.1.0
- When: CI 运行版本检查
- Then: 验证 tag 版本 = package.json 版本 = plugin.json 版本

### AC-015: 版本不一致阻止发布
- Given: package.json 为 2.1.0，plugin.json 为 2.0.0
- When: 尝试创建发布
- Then: CI 失败并报告版本不一致

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | scripts/bump-version.js | 版本同步工具 |
| 测试 | test/scripts/bump-version.test.js | 单元测试 |
| 文档 | docs/guide/releasing.md | 发布指南 |
