/**
 * 项目检测器 (Project Detector)
 *
 * 检测项目类型和结构，生成建议配置。
 * 支持 Node.js 项目，可扩展支持其他语言。
 *
 * @module skills/mob-seed/lib/brownfield/project-detector
 */

const fs = require('fs');
const path = require('path');

/**
 * 项目类型枚举
 */
const ProjectType = {
  NODEJS: 'Node.js',
  PYTHON: 'Python',
  GO: 'Go',
  UNKNOWN: 'unknown'
};

/**
 * 检测项目类型和结构
 * @param {string} projectPath - 项目根路径
 * @returns {Promise<Object>} 项目信息
 */
async function detectProject(projectPath) {
  const detectors = [
    detectNodeJS,
    detectPython,
    detectGo
  ];

  for (const detector of detectors) {
    const result = await detector(projectPath);
    if (result) {
      return result;
    }
  }

  // 回退：使用默认配置
  return detectUnknown(projectPath);
}

/**
 * 检测 Node.js 项目
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object|null>} 项目信息或 null
 */
async function detectNodeJS(projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // 确认是有效的 package.json
    if (!packageJson.name) {
      return null;
    }

    // 检测源码目录
    const srcDir = detectSrcDir(projectPath, ['src', 'lib', 'app', 'source']);

    // 检测测试目录
    const testDir = detectTestDir(projectPath, ['test', 'tests', '__tests__', 'spec']);

    // 获取所有源文件
    const sourceFiles = findSourceFiles(projectPath, srcDir, ['.js', '.ts', '.mjs']);

    // 检测包管理器
    const packageManager = detectPackageManager(projectPath);

    // 检测模块类型
    const moduleType = detectModuleType(packageJson);

    return {
      type: ProjectType.NODEJS,
      name: packageJson.name,
      version: packageJson.version,
      srcDir,
      testDir,
      sourceFiles,
      packageManager,
      moduleType,
      metadata: {
        main: packageJson.main,
        scripts: packageJson.scripts ? Object.keys(packageJson.scripts) : [],
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {})
      }
    };
  } catch (error) {
    return null;
  }
}

/**
 * 检测 Python 项目
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object|null>} 项目信息或 null
 */
async function detectPython(projectPath) {
  const indicators = [
    'setup.py',
    'pyproject.toml',
    'requirements.txt',
    'Pipfile'
  ];

  const hasIndicator = indicators.some(file =>
    fs.existsSync(path.join(projectPath, file))
  );

  if (!hasIndicator) {
    return null;
  }

  const srcDir = detectSrcDir(projectPath, ['src', 'lib', projectPath.split('/').pop()]);
  const testDir = detectTestDir(projectPath, ['tests', 'test', 'spec']);
  const sourceFiles = findSourceFiles(projectPath, srcDir, ['.py']);

  return {
    type: ProjectType.PYTHON,
    srcDir,
    testDir,
    sourceFiles,
    metadata: {
      hasSetupPy: fs.existsSync(path.join(projectPath, 'setup.py')),
      hasPyproject: fs.existsSync(path.join(projectPath, 'pyproject.toml'))
    }
  };
}

/**
 * 检测 Go 项目
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object|null>} 项目信息或 null
 */
async function detectGo(projectPath) {
  const goModPath = path.join(projectPath, 'go.mod');

  if (!fs.existsSync(goModPath)) {
    return null;
  }

  try {
    const goMod = fs.readFileSync(goModPath, 'utf8');
    const moduleMatch = goMod.match(/^module\s+(.+)$/m);
    const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';

    const sourceFiles = findSourceFiles(projectPath, '.', ['.go']);

    return {
      type: ProjectType.GO,
      name: moduleName,
      srcDir: '.',
      testDir: '.',
      sourceFiles: sourceFiles.filter(f => !f.endsWith('_test.go')),
      metadata: {
        module: moduleName
      }
    };
  } catch (error) {
    return null;
  }
}

/**
 * 检测未知类型项目
 * @param {string} projectPath - 项目路径
 * @returns {Object} 默认项目信息
 */
function detectUnknown(projectPath) {
  const srcDir = detectSrcDir(projectPath, ['src', 'lib', 'app']);
  const testDir = detectTestDir(projectPath, ['test', 'tests']);

  // 尝试检测所有常见源文件
  const sourceFiles = findSourceFiles(projectPath, srcDir, [
    '.js', '.ts', '.py', '.go', '.rb', '.rs', '.java'
  ]);

  return {
    type: ProjectType.UNKNOWN,
    srcDir,
    testDir,
    sourceFiles,
    metadata: {}
  };
}

/**
 * 检测源码目录
 * @param {string} projectPath - 项目路径
 * @param {Array<string>} candidates - 候选目录名
 * @returns {string} 源码目录
 */
function detectSrcDir(projectPath, candidates) {
  for (const candidate of candidates) {
    const candidatePath = path.join(projectPath, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      return candidate;
    }
  }
  return '.';
}

/**
 * 检测测试目录
 * @param {string} projectPath - 项目路径
 * @param {Array<string>} candidates - 候选目录名
 * @returns {string} 测试目录
 */
function detectTestDir(projectPath, candidates) {
  for (const candidate of candidates) {
    const candidatePath = path.join(projectPath, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      return candidate;
    }
  }
  return 'test';
}

/**
 * 查找源文件
 * @param {string} projectPath - 项目路径
 * @param {string} srcDir - 源码目录
 * @param {Array<string>} extensions - 文件扩展名
 * @returns {Array<string>} 源文件路径列表
 */
function findSourceFiles(projectPath, srcDir, extensions) {
  const files = [];
  const excludePatterns = [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    '__pycache__',
    'vendor',
    '.next',
    '.nuxt'
  ];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      // 检查是否应该排除
      if (excludePatterns.some(pattern => relativePath.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          // 排除测试文件
          if (!isTestFile(entry.name)) {
            files.push(relativePath);
          }
        }
      }
    }
  }

  const startDir = srcDir === '.' ? projectPath : path.join(projectPath, srcDir);
  walk(startDir);

  return files;
}

/**
 * 检查是否为测试文件
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否为测试文件
 */
function isTestFile(fileName) {
  const testPatterns = [
    '.test.',
    '.spec.',
    '_test.',
    '_spec.',
    'test_',
    'spec_'
  ];
  return testPatterns.some(pattern => fileName.includes(pattern));
}

/**
 * 检测包管理器
 * @param {string} projectPath - 项目路径
 * @returns {string} 包管理器名称
 */
function detectPackageManager(projectPath) {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) {
    return 'npm';
  }
  return 'npm';
}

/**
 * 检测模块类型
 * @param {Object} packageJson - package.json 内容
 * @returns {string} 模块类型
 */
function detectModuleType(packageJson) {
  if (packageJson.type === 'module') {
    return 'esm';
  }
  return 'commonjs';
}

/**
 * 生成建议配置
 * @param {Object} projectInfo - 项目信息
 * @returns {Object} .seed/config.json 内容
 */
function generateSuggestedConfig(projectInfo) {
  return {
    version: '1.0',
    project: {
      name: projectInfo.name || 'my-project',
      type: projectInfo.type
    },
    paths: {
      src: projectInfo.srcDir,
      test: projectInfo.testDir,
      specs: 'openspec/specs',
      changes: 'openspec/changes',
      archive: 'openspec/archive'
    },
    brownfield: {
      detected: new Date().toISOString(),
      sourceFiles: projectInfo.sourceFiles.length,
      moduleType: projectInfo.moduleType || 'unknown'
    }
  };
}

// 导出
module.exports = {
  ProjectType,
  detectProject,
  detectNodeJS,
  detectPython,
  detectGo,
  detectUnknown,
  detectSrcDir,
  detectTestDir,
  findSourceFiles,
  isTestFile,
  detectPackageManager,
  detectModuleType,
  generateSuggestedConfig
};
