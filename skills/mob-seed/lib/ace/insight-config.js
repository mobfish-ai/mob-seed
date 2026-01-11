'use strict';

/**
 * Insight Configuration Module
 *
 * Handles ACE output directory configuration with support for:
 * - Default mode: .seed/insights/
 * - External + symlink mode: configurable external directory
 *
 * Configuration priority (highest to lowest):
 * 1. Environment variable ACE_OUTPUT_DIR or INSIGHTS_OUTPUT_DIR
 * 2. .seed/config.local.json
 * 3. .seed/config.json
 * 4. Default value .seed/insights/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * ACE directory types
 */
const ACE_DIRS = ['observations', 'reflections', 'insights', 'learning'];

/**
 * Expand ~ to user home directory
 * @param {string} inputPath - Path that may contain ~
 * @returns {string} Expanded path
 */
function expandTilde(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  if (inputPath === '~') {
    return os.homedir();
  }
  return inputPath;
}

/**
 * Load JSON config file safely
 * @param {string} configPath - Path to config file
 * @returns {object|null} Parsed config or null if not found/invalid
 */
function loadConfigFile(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Silently ignore parse errors
  }
  return null;
}

/**
 * Get the output directory for a specific ACE type
 * @param {string} projectPath - Project root path
 * @param {string} dirType - Directory type: 'observations', 'reflections', 'insights', 'learning'
 * @param {object} [options] - Options
 * @param {object} [options.env] - Environment variables (defaults to process.env)
 * @returns {string} Resolved output directory path
 */
function getOutputDir(projectPath, dirType, options = {}) {
  const env = options.env || process.env;

  if (!ACE_DIRS.includes(dirType)) {
    throw new Error(`Invalid ACE directory type: ${dirType}. Must be one of: ${ACE_DIRS.join(', ')}`);
  }

  // 1. Check specific environment variable (e.g., INSIGHTS_OUTPUT_DIR)
  const specificEnvVar = `${dirType.toUpperCase()}_OUTPUT_DIR`;
  if (env[specificEnvVar]) {
    return expandTilde(env[specificEnvVar]);
  }

  // 2. Check unified environment variable ACE_OUTPUT_DIR
  if (env.ACE_OUTPUT_DIR) {
    return path.join(expandTilde(env.ACE_OUTPUT_DIR), dirType);
  }

  // 3. Check config.local.json
  const localConfigPath = path.join(projectPath, '.seed', 'config.local.json');
  const localConfig = loadConfigFile(localConfigPath);
  if (localConfig?.ace) {
    // Check specific dir config
    const specificKey = `${dirType}_dir`;
    if (localConfig.ace[specificKey]) {
      return expandTilde(localConfig.ace[specificKey]);
    }
    // Check unified output_dir
    if (localConfig.ace.output_dir) {
      return path.join(expandTilde(localConfig.ace.output_dir), dirType);
    }
  }

  // 4. Check config.json
  const configPath = path.join(projectPath, '.seed', 'config.json');
  const config = loadConfigFile(configPath);
  if (config?.ace) {
    // Check specific dir config
    const specificKey = `${dirType}_dir`;
    if (config.ace[specificKey]) {
      return expandTilde(config.ace[specificKey]);
    }
    // Check unified output_dir
    if (config.ace.output_dir) {
      return path.join(expandTilde(config.ace.output_dir), dirType);
    }
  }

  // 5. Default value
  return path.join(projectPath, '.seed', dirType);
}

/**
 * Get insights output directory
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {string} Resolved insights directory path
 */
function getInsightsDir(projectPath, options = {}) {
  return getOutputDir(projectPath, 'insights', options);
}

/**
 * Get all ACE output directories
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Object with all ACE directory paths
 */
function getAllOutputDirs(projectPath, options = {}) {
  const result = {};
  for (const dirType of ACE_DIRS) {
    result[dirType] = getOutputDir(projectPath, dirType, options);
  }
  return result;
}

/**
 * Ensure directory exists, create if not
 * @param {string} dirPath - Directory path to ensure
 * @returns {boolean} True if directory exists or was created
 */
function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Ensure insights directory exists
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Result with path and success status
 */
function ensureInsightsDir(projectPath, options = {}) {
  const insightsDir = getInsightsDir(projectPath, options);

  // Check if it's a symlink
  try {
    const stats = fs.lstatSync(insightsDir);
    if (stats.isSymbolicLink()) {
      // Verify symlink target exists
      const target = fs.readlinkSync(insightsDir);
      const absoluteTarget = path.isAbsolute(target)
        ? target
        : path.resolve(path.dirname(insightsDir), target);

      if (!fs.existsSync(absoluteTarget)) {
        return {
          path: insightsDir,
          success: false,
          error: `Symlink target does not exist: ${absoluteTarget}`,
          isSymlink: true,
          target: absoluteTarget
        };
      }
      return {
        path: insightsDir,
        success: true,
        isSymlink: true,
        target: absoluteTarget
      };
    }
  } catch (err) {
    // Directory doesn't exist yet, will create
  }

  const success = ensureDir(insightsDir);
  return {
    path: insightsDir,
    success,
    error: success ? null : `Failed to create directory: ${insightsDir}`,
    isSymlink: false
  };
}

/**
 * Get insight configuration from project
 * @param {string} projectPath - Project root path
 * @returns {object} Insight configuration
 */
function getInsightConfig(projectPath) {
  const configPath = path.join(projectPath, '.seed', 'config.json');
  const localConfigPath = path.join(projectPath, '.seed', 'config.local.json');

  // Merge configs with local taking precedence
  const config = loadConfigFile(configPath) || {};
  const localConfig = loadConfigFile(localConfigPath) || {};

  // Default insight config
  const defaultConfig = {
    enabled: true,
    source_types: ['expert_opinion', 'paper', 'blog', 'community', 'conference', 'book', 'internal'],
    auto_review_on_model_upgrade: true,
    review_interval_days: 90
  };

  // Merge: default < config.insights < localConfig.insights
  return {
    ...defaultConfig,
    ...(config.insights || {}),
    ...(localConfig.insights || {})
  };
}

/**
 * Validate insight source type
 * @param {string} sourceType - Source type to validate
 * @param {string} projectPath - Project root path
 * @returns {boolean} True if valid
 */
function isValidSourceType(sourceType, projectPath) {
  const config = getInsightConfig(projectPath);
  return config.source_types.includes(sourceType);
}

module.exports = {
  ACE_DIRS,
  expandTilde,
  loadConfigFile,
  getOutputDir,
  getInsightsDir,
  getAllOutputDirs,
  ensureDir,
  ensureInsightsDir,
  getInsightConfig,
  isValidSourceType
};
