#!/usr/bin/env node
/**
 * ACE 知识库设置向导
 * 
 * 自动配置 mob-seed 的 ACE 知识库符号链接
 * Usage: node scripts/setup-ace.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue 
      ? `${question} [${defaultValue}]: `
      : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function print(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
  };
  
  const prefix = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '✗'
  };
  
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

async function setupAce() {
  console.log('\n🌱 mob-seed ACE 知识库设置向导\n');
  console.log('本向导将帮助您配置 ACE 知识库的符号链接。\n');
  console.log('ACE 知识库包含您的私有洞见、观察、反思记录。');
  console.log('通过符号链接与开源项目分离，保护隐私。\n');
  
  // 检查是否在项目根目录
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    print('请在 mob-seed 项目根目录运行此脚本', 'error');
    process.exit(1);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.name !== 'mob-seed') {
    print('请在 mob-seed 项目根目录运行此脚本', 'error');
    process.exit(1);
  }
  
  const seedDir = path.join(process.cwd(), '.seed');
  const links = ['insights', 'observations', 'reflections', 'learning'];
  
  // 检查现有配置
  print('检查现有配置...', 'info');
  const existingLinks = [];
  for (const link of links) {
    const linkPath = path.join(seedDir, link);
    if (fs.existsSync(linkPath)) {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(linkPath);
        existingLinks.push({ name: link, target });
        print(`  发现现有链接: .seed/${link} -> ${target}`, 'info');
      }
    }
  }
  
  if (existingLinks.length > 0) {
    const overwrite = await ask('是否重新配置？现有链接将被更新 (y/N)', 'N');
    if (overwrite.toLowerCase() !== 'y') {
      print('保持现有配置，退出', 'info');
      rl.close();
      return;
    }
  }
  
  // 询问知识库位置
  console.log('');
  print('请指定 ACE 知识库存放路径', 'info');
  print('建议: 使用家目录下的独立文件夹，便于备份和同步', 'info');
  console.log('');
  
  const defaultPath = path.join(os.homedir(), 'ace-knowledge');
  const acePath = await ask('ACE 知识库路径', defaultPath);
  
  // 确认路径
  console.log('');
  print(`将使用路径: ${acePath}`, 'info');
  const confirm = await ask('确认继续? (Y/n)', 'Y');
  if (confirm.toLowerCase() === 'n') {
    print('已取消', 'warning');
    rl.close();
    return;
  }
  
  // 创建目录结构
  console.log('');
  print('创建目录结构...', 'info');
  
  for (const dir of links) {
    const fullPath = path.join(acePath, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      print(`  创建: ${fullPath}`, 'success');
    } else {
      print(`  已存在: ${fullPath}`, 'info');
    }
  }
  
  // 创建符号链接
  console.log('');
  print('创建符号链接...', 'info');
  
  for (const link of links) {
    const linkPath = path.join(seedDir, link);
    const targetPath = path.join(acePath, link);
    
    // 移除旧链接（如有）
    if (fs.existsSync(linkPath)) {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
        print(`  移除旧链接: .seed/${link}`, 'info');
      } else if (stats.isDirectory()) {
        // 备份现有目录
        const backupPath = `${linkPath}.backup.${Date.now()}`;
        fs.renameSync(linkPath, backupPath);
        print(`  备份现有目录: .seed/${link} -> ${path.basename(backupPath)}`, 'warning');
      }
    }
    
    // 创建新链接
    fs.symlinkSync(targetPath, linkPath, 'dir');
    print(`  链接: .seed/${link} -> ${targetPath}`, 'success');
  }
  
  // 更新 .gitignore
  console.log('');
  print('更新 .gitignore...', 'info');
  
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignore = fs.existsSync(gitignorePath) 
    ? fs.readFileSync(gitignorePath, 'utf-8') 
    : '';
  
  let updated = false;
  for (const link of links) {
    const entry = `.seed/${link}`;
    if (!gitignore.includes(entry)) {
      gitignore += gitignore.endsWith('\n') ? '' : '\n';
      gitignore += `${entry}\n`;
      updated = true;
      print(`  添加: ${entry}`, 'success');
    }
  }
  
  if (updated) {
    fs.writeFileSync(gitignorePath, gitignore);
    print('  已更新 .gitignore', 'success');
  } else {
    print('  无需更新', 'info');
  }
  
  // 完成
  console.log('');
  print('✅ ACE 知识库设置完成！', 'success');
  console.log('');
  console.log(`📁 知识库位置: ${acePath}`);
  console.log('');
  console.log('📝 使用建议:');
  console.log('   • 定期备份 ACE 知识库目录');
  console.log('   • 可在多台设备上同步该目录');
  console.log('   • 团队成员可共享同一知识库');
  console.log('');
  console.log('🔍 验证设置:');
  console.log('   ls -la .seed/');
  console.log('   /mob-seed');
  console.log('');
  
  rl.close();
}

// 运行设置
setupAce().catch((err) => {
  print(`错误: ${err.message}`, 'error');
  process.exit(1);
});
