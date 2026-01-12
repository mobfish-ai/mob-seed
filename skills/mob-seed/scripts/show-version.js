#!/usr/bin/env node
/**
 * 显示 mob-seed 运行时版本和场景
 *
 * @module scripts/show-version
 * @usage node skills/mob-seed/scripts/show-version.js
 *
 * 满足 FR-004（所有入口显示版本号和场景）的要求。
 *
 * 架构原则：使用自身位置（__dirname）定位相关模块，零冗余。
 * 脚本在 scripts/ 下，lib/runtime 在 ../lib/runtime。
 */

const path = require('path');

// ============================================================================
// 技能目录解析 - 自身相对定位（最简方案）
// ============================================================================

/**
 * 获取技能目录路径
 * 原则：脚本自身位置就是最可靠的定位方式
 */
function getSkillDir() {
  // scripts/show-version.js → skills/mob-seed/
  return path.dirname(__dirname);
}

// ============================================================================
// 版本显示
// ============================================================================

function showVersion() {
  const skillDir = getSkillDir();

  try {
    const runtime = require(path.join(skillDir, 'lib/runtime'));
    runtime.showRuntimeVersion();
  } catch (error) {
    // 降级处理：直接读取 package.json
    try {
      const pkg = require(path.join(skillDir, 'package.json'));
      console.log(`🌱 mob-seed v${pkg.version}`);
    } catch {
      console.log('🌱 mob-seed (版本未知)');
    }
  }
}

// ============================================================================
// CLI 入口
// ============================================================================

if (require.main === module) {
  showVersion();
}

module.exports = {
  getSkillDir,
  showVersion
};
