/**
 * SEED 工具函数
 *
 * 提供 SEED 命令所需的工具函数
 * 支持智能扫描项目结构、配置驱动
 *
 * @module seed-utils
 * @see SKILL.md
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

/**
 * SEED 配置目录和文件
 */
const SEED_DIR = '.seed';
const CONFIG_FILE = 'config.json';

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  version: '1.0.0',
  paths: {
    specs: 'specs',
    src: 'src',
    test: 'test',
    docs: 'docs',
    output: '.seed/output',
  },
  patterns: {
    spec: '*.fspec.md',
    code: '*.js',
    test: '*.test.js',
  },
  emit: {
    codeTemplate: 'skeleton',
    testTemplate: 'jest',
    docTemplate: 'markdown',
  },
  sync: {
    autoBackup: true,
    defaultDirection: 'spec',
  },
};

/**
 * 目录检测优先级
 */
const DETECT_PATTERNS = {
  specs: ['specs', 'spec', 'docs/specs', 'requirements', '.'],
  src: ['src', 'lib', 'app', 'packages', '.'],
  test: ['test', 'tests', '__tests__', 'spec'],
  docs: ['docs', 'doc', 'documentation'],
};

/**
 * 文件模式检测
 */
const FILE_PATTERNS = {
  spec: ['*.fspec.md', '*.spec.md', '*-spec.md'],
  js: ['*.js', '*.mjs'],
  ts: ['*.ts', '*.tsx'],
  go: ['*.go'],
  py: ['*.py'],
  test: {
    js: ['*.test.js', '*.spec.js'],
    ts: ['*.test.ts', '*.spec.ts'],
    go: ['*_test.go'],
    py: ['test_*.py', '*_test.py'],
  },
};

/**
 * 状态枚举
 */
const Status = {
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  MISSING: 'missing',
  EXISTS: 'exists',
  NOT_EXISTS: 'not_exists',
};

/**
 * 获取配置文件路径
 * @param {string} projectPath - 项目路径
 * @returns {string} 配置文件完整路径
 */
function getConfigPath(projectPath = '.') {
  return join(projectPath, SEED_DIR, CONFIG_FILE);
}

/**
 * 获取 SEED 目录路径
 * @param {string} projectPath - 项目路径
 * @returns {string} SEED 目录完整路径
 */
function getSeedDir(projectPath = '.') {
  return join(projectPath, SEED_DIR);
}

/**
 * 加载项目配置
 * @param {string} projectPath - 项目路径
 * @returns {Object} 配置对象
 */
export function loadConfig(projectPath = '.') {
  const configPath = getConfigPath(projectPath);

  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    const loaded = JSON.parse(content);
    // 深度合并默认配置
    return deepMerge(DEFAULT_CONFIG, loaded);
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * 保存项目配置
 * @param {string} projectPath - 项目路径
 * @param {Object} config - 配置对象
 */
export function saveConfig(projectPath, config) {
  const seedDir = getSeedDir(projectPath);
  const configPath = getConfigPath(projectPath);

  // 确保 .seed 目录存在
  if (!existsSync(seedDir)) {
    mkdirSync(seedDir, { recursive: true });
  }

  // 添加更新时间
  config.updated = new Date().toISOString();

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 检查是否已初始化 SEED 结构
 * @param {string} projectPath - 项目路径
 * @returns {boolean}
 */
export function isInitialized(projectPath = '.') {
  return existsSync(getConfigPath(projectPath));
}

/**
 * 检测目录是否存在
 * @param {string} projectPath - 项目路径
 * @param {string} dir - 目录名
 * @returns {boolean}
 */
function dirExists(projectPath, dir) {
  const fullPath = join(projectPath, dir);
  return existsSync(fullPath) && statSync(fullPath).isDirectory();
}

/**
 * 检测文件模式是否存在
 * @param {string} projectPath - 项目路径
 * @param {string} pattern - glob 模式
 * @returns {boolean}
 */
function hasFilesMatching(projectPath, pattern) {
  // 简单实现：检查目录中是否有匹配的文件
  const ext = extname(pattern).slice(1); // 去掉点
  const prefix = pattern.replace(`*.${ext}`, '');

  try {
    const files = readdirSync(projectPath);
    return files.some((f) => {
      if (prefix && !f.startsWith(prefix.replace('*', ''))) return false;
      return f.endsWith(`.${ext}`);
    });
  } catch {
    return false;
  }
}

/**
 * 智能扫描项目结构
 * @param {string} projectPath - 项目路径
 * @returns {Object} 扫描结果
 */
export function scanProjectStructure(projectPath = '.') {
  const result = {
    detected: {
      specs: null,
      src: null,
      test: null,
      docs: null,
    },
    status: {
      specs: Status.NOT_EXISTS,
      src: Status.NOT_EXISTS,
      test: Status.NOT_EXISTS,
      docs: Status.NOT_EXISTS,
    },
    projectType: 'unknown',
    patterns: {
      code: '*.js',
      test: '*.test.js',
    },
  };

  // 检测规格目录
  for (const dir of DETECT_PATTERNS.specs) {
    if (dir === '.') {
      // 检查根目录是否有规格文件
      if (hasFilesMatching(projectPath, '*.fspec.md')) {
        result.detected.specs = '.';
        result.status.specs = Status.EXISTS;
        break;
      }
    } else if (dirExists(projectPath, dir)) {
      result.detected.specs = dir;
      result.status.specs = Status.EXISTS;
      break;
    }
  }

  // 如果没找到，使用默认值
  if (!result.detected.specs) {
    result.detected.specs = 'specs';
  }

  // 检测源码目录
  for (const dir of DETECT_PATTERNS.src) {
    if (dir === '.') continue; // 跳过根目录
    if (dirExists(projectPath, dir)) {
      result.detected.src = dir;
      result.status.src = Status.EXISTS;
      break;
    }
  }
  if (!result.detected.src) {
    result.detected.src = 'src';
  }

  // 检测测试目录
  for (const dir of DETECT_PATTERNS.test) {
    if (dirExists(projectPath, dir)) {
      result.detected.test = dir;
      result.status.test = Status.EXISTS;
      break;
    }
  }
  if (!result.detected.test) {
    result.detected.test = 'test';
  }

  // 检测文档目录
  for (const dir of DETECT_PATTERNS.docs) {
    if (dirExists(projectPath, dir)) {
      result.detected.docs = dir;
      result.status.docs = Status.EXISTS;
      break;
    }
  }
  if (!result.detected.docs) {
    result.detected.docs = 'docs';
  }

  // 检测项目类型
  if (existsSync(join(projectPath, 'package.json'))) {
    result.projectType = 'node';

    // 检查是否是 TypeScript
    if (
      existsSync(join(projectPath, 'tsconfig.json')) ||
      hasFilesMatching(join(projectPath, result.detected.src), '*.ts')
    ) {
      result.projectType = 'typescript';
      result.patterns.code = '*.ts';
      result.patterns.test = '*.test.ts';
    } else {
      result.patterns.code = '*.js';
      result.patterns.test = '*.test.js';
    }
  } else if (existsSync(join(projectPath, 'go.mod'))) {
    result.projectType = 'go';
    result.patterns.code = '*.go';
    result.patterns.test = '*_test.go';
  } else if (existsSync(join(projectPath, 'requirements.txt')) || existsSync(join(projectPath, 'pyproject.toml'))) {
    result.projectType = 'python';
    result.patterns.code = '*.py';
    result.patterns.test = 'test_*.py';
  }

  return result;
}

/**
 * 初始化 SEED 项目结构（智能扫描版）
 * @param {string} projectPath - 项目路径
 * @param {Object} options - 选项
 * @returns {Object} 初始化结果
 */
export function initProject(projectPath = '.', options = {}) {
  const { force = false, manual = false, customPaths = null } = options;

  // 检查是否已初始化
  if (isInitialized(projectPath) && !force) {
    const existingConfig = loadConfig(projectPath);
    return {
      success: false,
      alreadyInitialized: true,
      config: existingConfig,
      message: '项目已初始化，使用 --force 强制重新初始化',
    };
  }

  // 备份现有配置
  if (force && isInitialized(projectPath)) {
    const configPath = getConfigPath(projectPath);
    const backupPath = configPath + '.backup';
    if (existsSync(configPath)) {
      writeFileSync(backupPath, readFileSync(configPath, 'utf-8'));
    }
  }

  // 智能扫描或使用自定义路径
  let paths, patterns;

  if (customPaths) {
    paths = { ...DEFAULT_CONFIG.paths, ...customPaths };
    patterns = DEFAULT_CONFIG.patterns;
  } else if (manual) {
    paths = DEFAULT_CONFIG.paths;
    patterns = DEFAULT_CONFIG.patterns;
  } else {
    const scan = scanProjectStructure(projectPath);
    paths = {
      specs: scan.detected.specs,
      src: scan.detected.src,
      test: scan.detected.test,
      docs: scan.detected.docs,
      output: '.seed/output',
    };
    patterns = {
      spec: '*.fspec.md',
      code: scan.patterns.code,
      test: scan.patterns.test,
    };
  }

  // 创建配置
  const config = {
    version: '1.0.0',
    created: new Date().toISOString(),
    paths,
    patterns,
    emit: DEFAULT_CONFIG.emit,
    sync: DEFAULT_CONFIG.sync,
  };

  // 保存配置（会自动创建 .seed 目录）
  saveConfig(projectPath, config);

  // 创建 output 目录
  const outputDir = join(projectPath, paths.output);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  return {
    success: true,
    config,
    scan: manual || customPaths ? null : scanProjectStructure(projectPath),
    created: [SEED_DIR, `${SEED_DIR}/${CONFIG_FILE}`, paths.output],
  };
}

/**
 * 扫描规格文件
 * @param {string} projectPath - 项目路径
 * @returns {Array} 规格文件列表
 */
export function scanSpecs(projectPath = '.') {
  const config = loadConfig(projectPath);
  const specsDir = join(projectPath, config.paths.specs);

  if (!existsSync(specsDir)) {
    return [];
  }

  try {
    const files = readdirSync(specsDir);
    return files
      .filter((f) => f.endsWith('.fspec.md') || f.endsWith('.spec.md'))
      .map((f) => ({
        name: basename(f).replace(/\.(f)?spec\.md$/, ''),
        path: join(specsDir, f),
        filename: f,
      }));
  } catch {
    return [];
  }
}

/**
 * 获取规格状态
 * @param {string} specPath - 规格文件路径
 * @param {string} projectPath - 项目路径
 * @returns {Object} 状态信息
 */
export function getSpecStatus(specPath, projectPath = '.') {
  const config = loadConfig(projectPath);
  const specName = basename(specPath).replace(/\.(f)?spec\.md$/, '');

  const status = {
    name: specName,
    spec: existsSync(specPath) ? Status.OK : Status.MISSING,
    manifest: Status.MISSING,
    code: Status.MISSING,
    test: Status.MISSING,
    docs: Status.MISSING,
    synced: false,
  };

  // 检查清单
  const manifestPath = join(projectPath, config.paths.output, specName, 'seed-manifest.json');
  if (existsSync(manifestPath)) {
    status.manifest = Status.OK;

    // 读取清单检查派生状态
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      for (const output of manifest.outputs || []) {
        if (output.type === 'code' && existsSync(join(projectPath, output.path))) {
          status.code = Status.OK;
        }
        if (output.type === 'test' && existsSync(join(projectPath, output.path))) {
          status.test = Status.OK;
        }
        if (output.type === 'docs' && existsSync(join(projectPath, output.path))) {
          status.docs = Status.OK;
        }
      }
    } catch {
      // 清单解析失败
      status.manifest = Status.ERROR;
    }
  }

  // 判断同步状态
  status.synced = status.manifest === Status.OK && status.code === Status.OK && status.test === Status.OK;

  return status;
}

/**
 * 获取项目整体状态
 * @param {string} projectPath - 项目路径
 * @returns {Object} 项目状态
 */
export function getProjectStatus(projectPath = '.') {
  const initialized = isInitialized(projectPath);

  if (!initialized) {
    return {
      initialized: false,
      config: null,
      summary: null,
      specs: [],
    };
  }

  const config = loadConfig(projectPath);
  const specs = scanSpecs(projectPath);
  const statuses = specs.map((spec) => getSpecStatus(spec.path, projectPath));

  const summary = {
    total: specs.length,
    emitted: statuses.filter((s) => s.manifest === Status.OK).length,
    synced: statuses.filter((s) => s.synced).length,
    needsAttention: statuses.filter((s) => !s.synced && s.manifest === Status.OK).length,
  };

  return {
    initialized: true,
    config,
    summary,
    specs: statuses,
  };
}

/**
 * 比较规格与代码的差异
 * @param {string} specPath - 规格文件路径
 * @param {string} projectPath - 项目路径
 * @returns {Object} 差异信息
 */
export function diffSpec(specPath, projectPath = '.') {
  const config = loadConfig(projectPath);
  const specName = basename(specPath).replace(/\.(f)?spec\.md$/, '');

  if (!existsSync(specPath)) {
    return {
      success: false,
      message: `规格文件不存在: ${specPath}`,
    };
  }

  // 解析规格
  const specContent = readFileSync(specPath, 'utf-8');

  // 提取 FR 列表
  const frList = [];
  const frMatches = specContent.matchAll(/- \[[ x]\] (FR-\d{3}):\s*(.+)/g);
  for (const match of frMatches) {
    frList.push({ id: match[1], description: match[2].trim() });
  }

  // 提取 AC 列表
  const acList = [];
  const acMatches = specContent.matchAll(/### (AC-\d{3}):\s*(.+)/g);
  for (const match of acMatches) {
    acList.push({ id: match[1], title: match[2].trim() });
  }

  const diff = {
    spec: specName,
    fr: { defined: frList, implemented: [], missing: [], extra: [] },
    ac: { defined: acList, tested: [], missing: [], extra: [] },
    syncRate: 0,
  };

  // 检查清单和代码
  const manifestPath = join(projectPath, config.paths.output, specName, 'seed-manifest.json');

  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // 检查代码实现
      const codeOutput = manifest.outputs?.find((o) => o.type === 'code');
      if (codeOutput && existsSync(join(projectPath, codeOutput.path))) {
        const codeContent = readFileSync(join(projectPath, codeOutput.path), 'utf-8');

        for (const fr of frList) {
          if (codeContent.includes(`@see ${fr.id}`) || codeContent.includes(fr.id)) {
            diff.fr.implemented.push(fr);
          } else {
            diff.fr.missing.push(fr);
          }
        }
      } else {
        diff.fr.missing = [...frList];
      }

      // 检查测试覆盖
      const testOutput = manifest.outputs?.find((o) => o.type === 'test');
      if (testOutput && existsSync(join(projectPath, testOutput.path))) {
        const testContent = readFileSync(join(projectPath, testOutput.path), 'utf-8');

        for (const ac of acList) {
          if (testContent.includes(ac.id)) {
            diff.ac.tested.push(ac);
          } else {
            diff.ac.missing.push(ac);
          }
        }
      } else {
        diff.ac.missing = [...acList];
      }
    } catch {
      diff.fr.missing = [...frList];
      diff.ac.missing = [...acList];
    }
  } else {
    diff.fr.missing = [...frList];
    diff.ac.missing = [...acList];
  }

  // 计算同步率
  const totalItems = frList.length + acList.length;
  const syncedItems = diff.fr.implemented.length + diff.ac.tested.length;
  diff.syncRate = totalItems > 0 ? Math.round((syncedItems / totalItems) * 100) : 0;

  return {
    success: true,
    diff,
  };
}

/**
 * 生成代码提示模板
 *
 * ⚠️ 注意：这只是生成提示模板，用于引导 Claude 生成完整实现。
 * Claude 应该根据 prompts/emit-code.md 生成完整可运行的代码，
 * 而不是直接使用这个骨架。
 *
 * @param {string} frId - FR ID
 * @param {string} description - 功能描述
 * @param {Object} implementation - 可选的实现内容
 * @returns {string} 代码模板
 */
export function generateCodeSkeleton(frId, description, implementation = null) {
  const funcName = frId.toLowerCase().replace(/-/g, '_');

  if (implementation) {
    return `/**
 * ${description}
 * @see ${frId}
 */
export async function ${funcName}(${implementation.params || ''}) {
${implementation.body}
}
`;
  }

  // 返回提示模板（Claude 应该填充完整实现）
  return `/**
 * ${description}
 * @see ${frId}
 *
 * ⚠️ Claude 应该根据规格实现此函数
 */
export async function ${funcName}(/* 根据规格添加参数 */) {
  // Claude 应该根据 ${frId} 规格生成完整实现
  // 参考: prompts/emit-code.md
}
`;
}

/**
 * 生成测试提示模板
 *
 * ⚠️ 注意：这只是生成提示模板，用于引导 Claude 生成完整测试。
 * Claude 应该根据 prompts/emit-test.md 生成完整可运行的测试，
 * 而不是直接使用这个骨架。
 *
 * @param {string} acId - AC ID
 * @param {string} title - 测试标题
 * @param {Object} implementation - 可选的实现内容
 * @returns {string} 测试模板
 */
export function generateTestSkeleton(acId, title, implementation = null) {
  if (implementation) {
    return `describe('${acId}: ${title}', () => {
  it('should pass acceptance criteria', async () => {
    // Given: ${implementation.given || '初始状态'}
${implementation.givenCode || ''}

    // When: ${implementation.when || '执行操作'}
${implementation.whenCode || ''}

    // Then: ${implementation.then || '验证结果'}
${implementation.thenCode || ''}
  });
});
`;
  }

  // 返回提示模板（Claude 应该填充完整测试）
  return `describe('${acId}: ${title}', () => {
  /**
   * ⚠️ Claude 应该根据 AC 实现完整测试
   * 参考: prompts/emit-test.md
   */
  it('should pass acceptance criteria', async () => {
    // Claude 应该根据 ${acId} 实现 Given/When/Then
  });
});
`;
}

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// 导出配置和常量
export { DEFAULT_CONFIG, SEED_DIR, CONFIG_FILE, Status, DETECT_PATTERNS };
