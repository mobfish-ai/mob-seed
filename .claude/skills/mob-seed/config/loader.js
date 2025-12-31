/**
 * SEED 配置加载器
 *
 * 负责加载和验证 seed.config.json 配置文件
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  version: '1.0.0',
  spec: {
    format: 'fspec',
    extension: '.fspec.md',
    directory: 'specs',
    required_sections: ['overview', 'requirements', 'constraints', 'acceptance']
  },
  emit: {
    engine: 'internal',
    targets: {
      code: { enabled: true, path: 'src/', overwrite: false },
      test: { enabled: true, path: 'test/', overwrite: false },
      docs: { enabled: true, path: 'docs/', overwrite: true }
    }
  },
  execute: {
    ci_trigger: 'manual',
    auto_commit: false,
    auto_pr: false
  },
  defend: {
    enabled: true,
    check_on_commit: true,
    forbidden_patterns: ['手动复制', 'TODO: sync', 'FIXME: update']
  },
  output: {
    directory: 'output/mob-seed',
    report_file: 'seed-report.md',
    manifest_file: 'seed-manifest.json',
    log_file: 'seed-log.txt'
  }
};

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} - 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * 查找配置文件路径
 * @param {string} startDir - 起始目录
 * @returns {string|null} - 配置文件路径或 null
 */
function findConfigPath(startDir = process.cwd()) {
  // 优先级1: 项目级配置
  const projectConfig = join(startDir, '.claude/skills/mob-seed/config/seed.config.json');
  if (existsSync(projectConfig)) {
    return projectConfig;
  }

  // 优先级2: 用户级配置
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    const userConfig = join(homeDir, '.claude/skills/mob-seed/config/seed.config.json');
    if (existsSync(userConfig)) {
      return userConfig;
    }
  }

  // 优先级3: 模块内配置
  const moduleConfig = join(__dirname, 'seed.config.json');
  if (existsSync(moduleConfig)) {
    return moduleConfig;
  }

  return null;
}

/**
 * 加载配置文件
 * @param {Object} options - 选项
 * @param {string} options.configPath - 指定配置文件路径
 * @param {Object} options.overrides - 覆盖配置
 * @returns {Object} - 配置对象
 */
export function loadConfig(options = {}) {
  const { configPath, overrides = {} } = options;

  // 查找配置文件
  const resolvedPath = configPath || findConfigPath();

  let fileConfig = {};

  if (resolvedPath && existsSync(resolvedPath)) {
    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      fileConfig = JSON.parse(content);

      // 移除注释字段
      delete fileConfig.$schema;
      delete fileConfig._comment;
      for (const key in fileConfig) {
        if (fileConfig[key] && typeof fileConfig[key] === 'object') {
          delete fileConfig[key]._comment;
        }
      }
    } catch (error) {
      console.warn(`警告: 无法解析配置文件 ${resolvedPath}: ${error.message}`);
    }
  }

  // 合并配置: 默认 < 文件 < 覆盖
  const config = deepMerge(deepMerge(DEFAULT_CONFIG, fileConfig), overrides);

  // 添加元数据
  config._meta = {
    configPath: resolvedPath,
    loadedAt: new Date().toISOString()
  };

  return config;
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];

  // 验证 spec 配置
  if (!config.spec) {
    errors.push('缺少 spec 配置');
  } else {
    if (!config.spec.extension) {
      errors.push('spec.extension 是必需的');
    }
    if (!config.spec.directory) {
      errors.push('spec.directory 是必需的');
    }
  }

  // 验证 emit 配置
  if (!config.emit) {
    errors.push('缺少 emit 配置');
  } else {
    if (!config.emit.targets) {
      errors.push('emit.targets 是必需的');
    }
  }

  // 验证 defend 配置
  if (config.defend && config.defend.enabled) {
    if (!Array.isArray(config.defend.forbidden_patterns)) {
      errors.push('defend.forbidden_patterns 必须是数组');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取特定阶段的配置
 * @param {Object} config - 完整配置
 * @param {string} stage - 阶段名称 (spec|emit|execute|defend)
 * @returns {Object} - 阶段配置
 */
export function getStageConfig(config, stage) {
  const stageMap = {
    'spec': 'spec',
    's': 'spec',
    'single-source': 'spec',
    'emit': 'emit',
    'e': 'emit',
    'execute': 'execute',
    'exec': 'execute',
    'defend': 'defend',
    'd': 'defend'
  };

  const normalizedStage = stageMap[stage.toLowerCase()];

  if (!normalizedStage) {
    throw new Error(`未知阶段: ${stage}`);
  }

  return config[normalizedStage] || {};
}

/**
 * 获取输出路径
 * @param {Object} config - 配置
 * @param {string} type - 类型 (report|manifest|log)
 * @returns {string} - 完整路径
 */
export function getOutputPath(config, type) {
  const output = config.output || DEFAULT_CONFIG.output;
  const dir = output.directory;

  const fileMap = {
    'report': output.report_file,
    'manifest': output.manifest_file,
    'log': output.log_file
  };

  const file = fileMap[type];
  if (!file) {
    throw new Error(`未知输出类型: ${type}`);
  }

  return join(dir, file);
}

// 导出默认配置供测试使用
export { DEFAULT_CONFIG };
