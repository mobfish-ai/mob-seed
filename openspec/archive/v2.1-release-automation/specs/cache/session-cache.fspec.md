# session-cache 规格

> 版本: 1.0.0
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P1

## 概述 (Overview)

会话级缓存系统，实现三层检查架构的缓存复用，避免重复检查，提升检查效率。

### 目标用户
- SEED 方法论使用者
- 频繁执行检查的开发者

### 核心价值
- 三层缓存架构（快速/增量/完整）
- 层级间结果复用
- 文件变更自动失效

## 需求 (Requirements)

### 功能需求

- [ ] FR-001: 分层缓存 - 支持 quick/incremental/full 三层缓存
- [ ] FR-002: 结果存储 - 缓存检查结果和元数据
- [ ] FR-003: 有效性检查 - 基于文件 hash 检查缓存有效性
- [ ] FR-004: 层级复用 - 高层复用低层已通过的结果
- [ ] FR-005: 自动失效 - 文件变更时自动失效相关缓存
- [ ] FR-006: TTL 管理 - 不同层级不同过期时间

### 非功能需求

- [ ] NFR-001: 缓存命中 < 10ms
- [ ] NFR-002: 内存占用 < 10MB
- [ ] NFR-003: 支持并发访问

## 约束 (Constraints)

### 技术约束
- 内存缓存（会话级）
- 基于文件 hash 的缓存键
- 使用 Node.js Map 实现

### 业务约束
- 缓存仅在当前会话有效
- 关键检查不可跳过

## 接口设计 (Interface)

### 三层缓存架构

```
Layer 1: Quick Check (秒级)      ←── pre-commit / --quick
  • staged 文件基础检查
  • 规格语法验证
  • 缓存: 基于文件 hash
  • TTL: 1 分钟

Layer 2: Incremental Check (十秒级)  ←── pre-push / 默认模式
  • 复用 Layer 1 结果
  • SEED 四字诀验证
  • Mission 对齐检查
  • 缓存: 基于 commit hash
  • TTL: 5 分钟

Layer 3: Full Check (分钟级)     ←── CI / --full
  • 复用 Layer 2 结果
  • 完整测试运行
  • AC 状态验证
  • 缓存: 基于测试结果 + 时间戳
  • TTL: 30 分钟
```

### API 接口

```javascript
// lib/cache/session-cache.js

/**
 * 缓存层级
 */
const CACHE_LAYERS = {
  QUICK: 'quick',
  INCREMENTAL: 'incremental',
  FULL: 'full'
};

/**
 * 默认 TTL（毫秒）
 */
const DEFAULT_TTL = {
  quick: 60 * 1000,        // 1 分钟
  incremental: 5 * 60 * 1000, // 5 分钟
  full: 30 * 60 * 1000     // 30 分钟
};

/**
 * 会话缓存类
 */
class SessionCache {
  /**
   * 获取缓存
   * @param {string} layer - 缓存层级
   * @param {string} key - 缓存键
   * @param {object} dependencies - 依赖检查
   * @returns {any|null}
   */
  get(layer, key, dependencies);

  /**
   * 设置缓存
   * @param {string} layer - 缓存层级
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {object} options - 选项
   */
  set(layer, key, value, options);

  /**
   * 检查缓存是否有效
   * @param {string} layer - 缓存层级
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  isValid(layer, key);

  /**
   * 失效指定层级的缓存
   * @param {string} layer - 缓存层级
   * @param {string} key - 缓存键（可选，不传则失效整层）
   */
  invalidate(layer, key);

  /**
   * 清空所有缓存
   */
  clear();
}

/**
 * 生成缓存键
 * @param {string[]} files - 文件路径列表
 * @returns {string} 缓存键
 */
function getCacheKey(files);

/**
 * 检查是否需要重新运行
 * @param {string} cacheKey - 缓存键
 * @param {any} cachedResult - 缓存结果
 * @returns {boolean}
 */
function shouldRecheck(cacheKey, cachedResult);
```

### 复用规则

| 当前层 | 复用来源 | 跳过条件 |
|--------|----------|----------|
| Layer 2 | Layer 1 | Layer 1 结果有效且文件未变更 |
| Layer 3 | Layer 2 | Layer 2 结果有效且 commit 未变更 |
| 同层重复 | 上次结果 | 缓存未过期且依赖未变更 |

## 验收标准 (Acceptance Criteria)

### AC-022: 会话级缓存
- Given: 首次执行 `/mob-seed`
- When: 再次执行 `/mob-seed`（文件未变）
- Then: 命中缓存，秒级返回

### AC-023: 文件变更失效
- Given: 缓存了检查结果
- When: 修改规格文件
- Then: 相关缓存自动失效，重新检查

### AC-024: 层级复用
- Given: Layer 1 检查通过
- When: 执行 Layer 2 检查
- Then: 复用 Layer 1 结果，只执行增量部分

## 派生产物 (Derived Outputs)

> 路径遵循 `.seed/config.json` 配置，相对于 `skills/mob-seed/` 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/cache/session-cache.js | 会话缓存 |
| 测试 | skills/mob-seed/test/cache/session-cache.test.js | 单元测试 |
| 文档 | docs/api/session-cache.md | API 文档 |
