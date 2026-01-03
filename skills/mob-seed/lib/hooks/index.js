/**
 * SEED Hooks 模块
 *
 * 提供 Git hooks 集成所需的缓存和检查功能
 *
 * @module skills/mob-seed/lib/hooks
 */

const cacheChecker = require('./cache-checker');
const quickDefender = require('./quick-defender');
const incrementalDefender = require('./incremental-defender');
const cacheUpdater = require('./cache-updater');

module.exports = {
  // 缓存检查
  cacheChecker,
  checkCache: cacheChecker.checkCache,
  isCacheValid: cacheChecker.isCacheValid,

  // 快速检查
  quickDefender,
  quickSeedCheck: quickDefender.quickSeedCheck,

  // 增量检查
  incrementalDefender,
  seedPrincipleCheck: incrementalDefender.seedPrincipleCheck,
  principleCheck: incrementalDefender.principleCheck,

  // 缓存更新
  cacheUpdater,
  updateCache: cacheUpdater.updateCache
};
