#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chokidar from 'chokidar';
import esbuild from 'esbuild';

import { hLog } from './colorize.js';

path.dirname(fileURLToPath(import.meta.url));

const isSilent = process.argv.includes('--silent') || process.argv.includes('-s');
const isWatchMode = process.argv.includes('--watch') || process.argv.includes('-w');
const withoutPostbuild = process.argv.includes('--no-post') || process.argv.includes('-np');
const skipAngular = process.argv.includes('--skip-angular') || process.argv.includes('-sa');

const timers = new Map();

function elapsed(tag, indentation = 0, onlyReturn = false) {
  if (isSilent) return;
  const now = performance.now();
  if (timers.has(tag)) {
    const startTime = timers.get(tag);
    const totalTime = ((now - startTime) / 1000).toFixed(2);
    if (!onlyReturn) hLog(indentation, true, 'yellow', 'elapsed ' + tag, totalTime + 's');
    timers.delete(tag);
    return totalTime;
  }
  timers.set(tag, now);
}

function runCommand(command, args, cwd, captureOutput = false) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: captureOutput ? 'pipe' : 'inherit',
      shell: process.platform === 'win32',
    });

    if (captureOutput) {
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    } else {
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    }

    proc.on('error', reject);
  });
}

function detectPackageManager() {
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  return 'npm';
}

let rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const PROJECT_NAME = rootPackageJson.name.split('-monorepo')[0];

if (!rootPackageJson.devDependencies) {
  rootPackageJson.devDependencies = {};
}

const buildConfig = {
  bundle: true,
  sourcemap: true,
  target: ['es2022'],
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
};

async function setupDevDependencies() {
  const packagesConfig = rootPackageJson.packages || {};
  let hasChanges = false;

  if (!isSilent)
    hLog(0, true, 'header', 'dependencies check', 'Scanning required devDependencies...');

  if (!rootPackageJson.devDependencies.esbuild) {
    rootPackageJson.devDependencies.esbuild = '^0.19.0';
    hasChanges = true;
    if (!isSilent) hLog(2, false, 'success', '+', `Added /#package esbuild #/`);
  }

  const hasAngularPackage = Object.keys(packagesConfig).some(
    (pkg) => packagesConfig[pkg].format === 'angular'
  );
  if (hasAngularPackage && !rootPackageJson.devDependencies['ng-packagr']) {
    rootPackageJson.devDependencies['ng-packagr'] = '^18.0.0';
    hasChanges = true;
    if (!isSilent)
      hLog(2, false, 'success', '+', `Added /#package ng-packagr #/ /#dim (for Angular builds) #/`);
  }

  const hasTypeScriptFiles =
    fs.existsSync('src') &&
    (fs
      .readdirSync('src', { recursive: true })
      .some((file) => typeof file === 'string' && file.endsWith('.ts')) ||
      (fs.existsSync('src/integrations') &&
        fs.readdirSync('src/integrations').some((file) => file.endsWith('.ts'))));

  if (hasTypeScriptFiles && !rootPackageJson.devDependencies.typescript) {
    rootPackageJson.devDependencies.typescript = '^5.0.0';
    hasChanges = true;
    if (!isSilent)
      hLog(2, false, 'success', '+', `Added /#package typescript #/ /#dim (detected .ts files) #/`);
  }

  if (hasAngularPackage) {
    const angularDeps = {
      '@angular/compiler': '^20.2.3',
      '@angular/compiler-cli': '^20.2.3',
    };

    for (const [dep, version] of Object.entries(angularDeps)) {
      if (!rootPackageJson.devDependencies[dep]) {
        rootPackageJson.devDependencies[dep] = version;
        hasChanges = true;
        if (!isSilent)
          hLog(
            2,
            false,
            'success',
            '+',
            `Added /#package ${dep} #/ /#dim (required for ng-packagr) #/`
          );
      }
    }
  }

  for (const [framework, config] of Object.entries(packagesConfig)) {
    if (framework === 'vanilla') continue;

    if (config.dependencies) {
      for (const [dep, depConfig] of Object.entries(config.dependencies)) {
        const version = Array.isArray(depConfig) ? depConfig[0] : depConfig;

        if (!rootPackageJson.devDependencies[dep]) {
          rootPackageJson.devDependencies[dep] = version;
          hasChanges = true;
          if (!isSilent)
            hLog(2, false, 'success', '+', `Added /#package ${dep} #/@/#info ${version} #/`);
        }
      }
    }
  }

  if (hasChanges) {
    fs.writeFileSync('package.json', JSON.stringify(rootPackageJson, null, 2));
    if (!isSilent) {
      hLog(0, true, 'success', 'success', 'Updated package.json with required devDependencies');
      hLog(0, true, 'info', 'installing', 'Installing dependencies...');
    }
    const packageManager = detectPackageManager();
    await runCommand(packageManager, ['install', '--legacy-peer-deps'], process.cwd());
    if (!isSilent) hLog(0, true, 'success', 'complete', 'Dependencies installed\n');

    rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  } else {
    if (!isSilent) hLog(0, true, 'success', 'ok', 'All required devDependencies already present');
  }
}

if (fs.existsSync('packages')) {
  fs.rmSync('packages', { recursive: true });
}
fs.mkdirSync('packages');

function createPackageReadme(framework) {
  const packageName = framework === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${framework}`;
  const frameworkCapitalized = framework.charAt(0).toUpperCase() + framework.slice(1);
  const description =
    framework === 'vanilla'
      ? rootPackageJson.description
      : `${rootPackageJson.description} | ${frameworkCapitalized} Package`;

  return `# ${packageName}

${description}

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Documentation

Visit [${rootPackageJson.homepage}](${rootPackageJson.homepage})
`;
}

const createExportMap = (entryName, baseFileName, config) => {
  if (config.format === 'angular') {
    const isMainEntry = entryName === '.';
    return {
      types: isMainEntry ? './index.d.ts' : `./${baseFileName}/index.d.ts`,
      default: `./fesm2022/${baseFileName}.mjs`,
    };
  }
  return entryName === '.'
    ? { types: './index.d.ts', import: './index.esm.js' }
    : `./${baseFileName}.js`;
};

function createSubPackageJson(framework, config = {}) {
  const packageName = framework === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${framework}`;
  const description =
    framework === 'vanilla'
      ? rootPackageJson.description
      : `${rootPackageJson.description} | ${framework.charAt(0).toUpperCase() + framework.slice(1)} Package`;

  const packageJson = {
    name: packageName,
    version: rootPackageJson.version,
    type: 'module',
    description: description,
    homepage: rootPackageJson.homepage,
    repository: {
      ...rootPackageJson.repository,
      directory: `packages/${framework}`,
    },
    bugs: rootPackageJson.bugs,
    author: rootPackageJson.author,
    license: rootPackageJson.license,
    types: './index.d.ts',
    exports: {},
    files: ['*.js', '*.map', '*.ts', 'README.md', 'LICENSE'],
    keywords: [...rootPackageJson.keywords, framework === 'vanilla' ? null : framework].filter(
      Boolean
    ),
    sideEffects: false,
  };

  if (config.format === 'angular') {
    packageJson.module = `./fesm2022/${PROJECT_NAME}.mjs`;
    delete packageJson.main;
    packageJson.files.push('fesm2022/');
  }

  packageJson.exports['.'] = createExportMap('.', PROJECT_NAME, config);

  if (config.format === 'angular') {
    packageJson.exports['./core'] = {
      types: './core/index.d.ts',
      default: './fesm2022/core.mjs',
    };
    packageJson.exports['./package.json'] = {
      default: './package.json',
    };
    packageJson.files.push('core/');
  }

  if (config.plugins && Array.isArray(config.plugins)) {
    for (const pluginName of config.plugins) {
      packageJson.exports[`./${pluginName}`] = createExportMap(
        `./${pluginName}`,
        pluginName,
        config
      );

      if (config.format === 'angular') {
        if (!packageJson.files.includes(`${pluginName}/`)) {
          packageJson.files.push(`${pluginName}/`);
        }
      } else {
        if (!packageJson.files.includes(`${pluginName}.js`)) {
          packageJson.files.push(`${pluginName}.js`);
        }
      }
    }
  }

  if (config.dependencies) {
    const peerDeps = {};
    const peerDepsMeta = {};
    for (const [dep, depConfig] of Object.entries(config.dependencies)) {
      const [version, isOptional] = Array.isArray(depConfig) ? depConfig : [depConfig, false];
      peerDeps[dep] = version;
      peerDepsMeta[dep] = { optional: isOptional };
    }
    if (Object.keys(peerDeps).length > 0) {
      packageJson.peerDependencies = peerDeps;
      packageJson.peerDependenciesMeta = peerDepsMeta;
    }
  }

  if (framework === 'vanilla') {
    packageJson.unpkg = `./${PROJECT_NAME}.min.js`;
    packageJson.jsdelivr = `./${PROJECT_NAME}.min.js`;
    packageJson.exports['.'] = {
      types: './index.d.ts',
      import: './index.esm.js',
    };
  }

  return packageJson;
}

function findEntryFile(basePath, extensions) {
  for (const ext of extensions) {
    const filePath = `${basePath}${ext}`;
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function postProcessAngularBuild(packageDir, framework) {
  if (!isSilent) hLog(2, false, 'info', '→', 'Post-processing Angular build files...');

  try {
    const fesm2022Dir = path.join(packageDir, 'fesm2022');
    if (fs.existsSync(fesm2022Dir)) {
      const files = fs.readdirSync(fesm2022Dir);

      for (const file of files) {
        if (file.includes(rootPackageJson.name)) {
          const oldPath = path.join(fesm2022Dir, file);
          const newFileName = file.replace(rootPackageJson.name, PROJECT_NAME);
          const newPath = path.join(fesm2022Dir, newFileName);

          fs.renameSync(oldPath, newPath);
          if (!isSilent) hLog(4, false, 'success', '✓', `Renamed: ${file} → ${newFileName}`);

          let content = fs.readFileSync(newPath, 'utf-8');
          if (newFileName.endsWith('.mjs')) {
            content = content.replace(
              new RegExp(`from '~/${PROJECT_NAME}'`, 'g'),
              `from '@${PROJECT_NAME}/${framework}/core'`
            );
            content = content.replace(new RegExp(rootPackageJson.name, 'g'), PROJECT_NAME);
          } else if (newFileName.endsWith('.map')) {
            content = content.replace(new RegExp(rootPackageJson.name, 'g'), PROJECT_NAME);
            const mapObj = JSON.parse(content);
            mapObj.sources = [`./${PROJECT_NAME}.mjs`, './core.mjs'];
            content = JSON.stringify(mapObj);
          }
          fs.writeFileSync(newPath, content);
        }
      }
    }

    const coreDir = path.join(packageDir, 'core');
    fs.mkdirSync(coreDir, { recursive: true });

    const vanillaTypesPath = path.join('packages', 'vanilla', 'index.d.ts');
    if (fs.existsSync(vanillaTypesPath)) {
      const typesContent = fs.readFileSync(vanillaTypesPath, 'utf-8');
      fs.writeFileSync(path.join(coreDir, 'index.d.ts'), typesContent);
      if (!isSilent) hLog(4, false, 'success', '✓', 'Created core/index.d.ts');
    }

    const vanillaEsmPath = path.join('packages', 'vanilla', 'index.esm.js');
    if (fs.existsSync(vanillaEsmPath)) {
      let esmContent = fs.readFileSync(vanillaEsmPath, 'utf-8');
      esmContent = esmContent.replace(
        new RegExp(`from '~/${PROJECT_NAME}'`, 'g'),
        `from '@${PROJECT_NAME}/${framework}/core'`
      );

      // Fix sourceMappingURL
      esmContent = esmContent.replace(
        /\/\/# sourceMappingURL=.*\.map/g,
        '//# sourceMappingURL=core.mjs.map'
      );

      fs.writeFileSync(path.join(fesm2022Dir, 'core.mjs'), esmContent);
      if (!isSilent) hLog(4, false, 'success', '✓', 'Created fesm2022/core.mjs');

      // Copy and rename the map file
      const vanillaMapPath = path.join('packages', 'vanilla', 'index.esm.js.map');
      if (fs.existsSync(vanillaMapPath)) {
        let mapContent = fs.readFileSync(vanillaMapPath, 'utf-8');

        // Update map content references
        mapContent = mapContent.replace(/index\.esm\.js/g, 'core.mjs');

        const mapObj = JSON.parse(mapContent);
        mapObj.sources = [`./core.mjs`];
        mapContent = JSON.stringify(mapObj);

        fs.writeFileSync(path.join(fesm2022Dir, 'core.mjs.map'), mapContent);
        if (!isSilent) hLog(4, false, 'success', '✓', 'Created fesm2022/core.mjs.map');
      }
    }

    const indexDtsPath = path.join(packageDir, 'index.d.ts');
    if (fs.existsSync(indexDtsPath)) {
      let content = fs.readFileSync(indexDtsPath, 'utf-8');
      content = content.replace(
        new RegExp(`from '~/${PROJECT_NAME}'`, 'g'),
        `from '@${PROJECT_NAME}/${framework}/core'`
      );
      fs.writeFileSync(indexDtsPath, content);
      if (!isSilent) hLog(4, false, 'success', '✓', 'Updated index.d.ts imports');
    }
  } catch (error) {
    hLog(4, true, 'error', 'error', `Post-processing failed: ${error.message}`);
    throw error;
  }
}

async function buildWithNgPackagr(name, config, packageDir) {
  if (!isSilent) hLog(2, false, 'accent', '◆', 'Using ng-packagr for Ivy compatibility...');

  const entryFile = config.entry || findEntryFile(`src/integrations/${name}`, ['.ts']);
  if (!entryFile) {
    throw new Error(`No entry file found for Angular package ${name}`);
  }

  const publicApiContent = `export * from './${path.relative(process.cwd(), entryFile).replace(/\\/g, '/').replace('.ts', '')}';`;
  fs.writeFileSync('public-api.ts', publicApiContent);

  const ngPackageConfig = {
    $schema: './node_modules/ng-packagr/ng-package.schema.json',
    dest: packageDir,
    lib: {
      entryFile: 'public-api.ts',
    },
  };

  fs.writeFileSync('ng-package.json', JSON.stringify(ngPackageConfig, null, 2));

  try {
    await runCommand(
      'npx',
      ['ng-packagr', '-p', 'ng-package.json', '-c', 'tsconfig.json'],
      process.cwd(),
      true
    );
    if (!isSilent)
      hLog(2, false, 'success', '✓', 'ng-packagr build complete with Ivy compatibility');

    await postProcessAngularBuild(packageDir, name);
  } finally {
    ['ng-package.json', 'public-api.ts'].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
}

async function buildFrameworkPackage(name, config = {}) {
  const packageDir = path.join('packages', name);
  fs.mkdirSync(packageDir, { recursive: true });

  const displayName = name === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${name}`;
  if (!isSilent) hLog(0, true, 'info', 'BUILDING', `/#package ${displayName} #/`, '\n');

  let entryFile = config.entry;

  if (!entryFile) {
    const basePath = `src/integrations/${name}`;
    const extensions = config.jsx === true ? ['.tsx', '.ts', '.jsx', '.js'] : ['.ts', '.js'];
    entryFile = findEntryFile(basePath, extensions);
    if (entryFile && !isSilent) {
      hLog(2, false, 'info', '→', `Found entry: /#file ${entryFile} #/`);
    }
  }

  if (!entryFile || !fs.existsSync(entryFile)) {
    hLog(2, true, 'warning', '!', `Skipping - no entry file found for /#package ${name} #/`);
    return;
  }

  if (config.format === 'angular') {
    await buildWithNgPackagr(name, config, packageDir);
  } else {
    const buildOptions = {
      ...buildConfig,
      entryPoints: [entryFile],
      external: config.dependencies ? Object.keys(config.dependencies) : [],
    };

    if (config.jsx === true) {
      buildOptions.loader = {
        '.js': 'jsx',
        '.jsx': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx',
      };
      buildOptions.jsx = 'automatic';
      if (!isSilent) hLog(2, false, 'accent', '◆', 'JSX enabled for this package');
    }

    const esmOutfile = path.join(packageDir, 'index.esm.js');
    await esbuild.build({
      ...buildOptions,
      format: 'esm',
      outfile: esmOutfile,
    });
    if (!isSilent) hLog(2, false, 'success', '✓', 'ESM build complete');

    if (name === 'vanilla') {
      await esbuild.build({
        ...buildOptions,
        format: 'esm',
        minify: true,
        sourcemap: false,
        outfile: path.join(packageDir, `${PROJECT_NAME}.min.js`),
      });
      if (!isSilent) hLog(2, false, 'success', '✓', 'ESM minified build complete');
    }

    if (config.plugins && Array.isArray(config.plugins)) {
      if (!isSilent) hLog(2, true, 'info', 'plugins', 'Copying plugins...');
      for (const pluginName of config.plugins) {
        const pluginSourcePath = path.join('src', 'plugins', `${pluginName}.js`);
        const pluginDestPath = path.join(packageDir, `${pluginName}.js`);
        if (fs.existsSync(pluginSourcePath)) {
          fs.copyFileSync(pluginSourcePath, pluginDestPath);
          if (!isSilent)
            hLog(4, false, 'success', '✓', `Copied plugin: /#file ${pluginName}.js #/`);
        } else {
          hLog(4, false, 'warning', '⚠', `Plugin not found: /#file ${pluginSourcePath} #/`);
        }
      }
    }
  }

  if (config.format !== 'angular') {
    const typeFile =
      config.types || (name === 'vanilla' ? `src/${PROJECT_NAME}.d.ts` : `src/types/${name}.d.ts`);

    if (name !== 'vanilla' && fs.existsSync(`src/${PROJECT_NAME}.d.ts`)) {
      fs.copyFileSync(`src/${PROJECT_NAME}.d.ts`, path.join(packageDir, `${PROJECT_NAME}.d.ts`));
    }

    if (fs.existsSync(typeFile)) {
      let content = fs.readFileSync(typeFile, 'utf8');
      content = content.replace(`../${PROJECT_NAME}`, `./${PROJECT_NAME}`);
      fs.writeFileSync(path.join(packageDir, 'index.d.ts'), content);
      if (!isSilent) hLog(2, false, 'success', '✓', 'TypeScript definitions copied');
    }
  }

  const packageJson = createSubPackageJson(name, config);
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  if (!isSilent) hLog(2, false, 'success', '✓', 'package.json created');

  if (name === 'vanilla' && fs.existsSync('README.md')) {
    fs.copyFileSync('README.md', path.join(packageDir, 'README.md'));
    if (!isSilent) hLog(2, false, 'success', '✓', 'README.md copied from root');
  } else {
    const readme = createPackageReadme(name);
    fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
    if (!isSilent) hLog(2, false, 'success', '✓', 'README.md created');
  }

  if (fs.existsSync('LICENSE')) {
    fs.copyFileSync('LICENSE', path.join(packageDir, 'LICENSE'));
    if (!isSilent) hLog(2, false, 'success', '✓', 'LICENSE copied');
  }

  if (!isSilent)
    hLog(2, true, 'highlight', 'done', `/#package ${displayName} #/ package complete!`);
}

async function getGlobalLinkedPackages() {
  const { stdout } = await runCommand(
    'npm',
    ['list', '-g', '--depth=0', '--json'],
    process.cwd(),
    true
  );
  const data = JSON.parse(stdout);

  const linkedPackages = new Set();

  for (const [packageName, info] of Object.entries(data.dependencies || {})) {
    if (info.resolved && info.resolved.startsWith('file:')) {
      linkedPackages.add(packageName);
    }
  }

  return linkedPackages;
}

async function isPackageLinkedLocally(packageName, projectPath) {
  try {
    const nodeModulesPath = path.join(projectPath, 'node_modules', packageName);
    if (!fs.existsSync(nodeModulesPath)) return false;

    const stats = fs.lstatSync(nodeModulesPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

async function linkPackagesToTestProjects() {
  if (!isSilent) hLog(0, true, 'header', 'npm link', 'Linking packages to test projects...', '\n');
  const testDir = path.join(process.cwd(), 'test');
  if (!fs.existsSync(testDir)) {
    hLog(2, true, 'warning', '!', 'No test directory found, skipping links');
    return;
  }

  const packagesDir = path.join(process.cwd(), 'packages');
  const packages = fs.readdirSync(packagesDir);

  const globalLinkedPackages = await getGlobalLinkedPackages();

  if (!isSilent) hLog(2, false, 'info', '→', 'Registering packages globally...', '\n');

  for (const pkg of packages) {
    const packagePath = path.join(packagesDir, pkg);
    if (fs.statSync(packagePath).isDirectory()) {
      const packageName = pkg === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${pkg}`;

      if (globalLinkedPackages.has(packageName)) {
        if (!isSilent)
          hLog(4, false, 'yellow', '❉', `Already linked globally: /#package ${packageName} #/`);
        continue;
      }

      try {
        await runCommand('npm', ['link', '--silent'], packagePath);
        if (!isSilent)
          hLog(4, false, 'success', '✓', `Linked globally: /#package ${packageName} #/`);
      } catch (error) {
        hLog(4, true, 'error', 'error', `Failed to link ${pkg}: ${error.message}`);
      }
    }
  }

  if (!isSilent) hLog(2, false, 'info', '→', 'Linking packages in test projects...', '\n');

  const testProjects = fs.readdirSync(testDir);

  for (const testProject of testProjects) {
    const testProjectPath = path.join(testDir, testProject);
    if (!fs.statSync(testProjectPath).isDirectory()) continue;
    if (!fs.existsSync(path.join(testProjectPath, 'package.json'))) continue;

    if (!isSilent) hLog(4, false, 'accent', '◆', `Test project: /#file ${testProject} #/`);
    const packagesToLink = [];

    if (packages.includes(testProject)) {
      const packageName =
        testProject === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${testProject}`;
      packagesToLink.push(packageName);
    } else {
      const packagesConfig = rootPackageJson.packages || {};

      for (const [framework, config] of Object.entries(packagesConfig)) {
        if (config.plugins && config.plugins.includes(testProject)) {
          const packageName =
            framework === 'vanilla' ? PROJECT_NAME : `@${PROJECT_NAME}/${framework}`;
          packagesToLink.push(packageName);
          break;
        }
      }
      if (packagesToLink.length === 0) {
        packagesToLink.push(PROJECT_NAME);
      }
    }

    for (const packageName of packagesToLink) {
      const alreadyLinkedLocally = await isPackageLinkedLocally(packageName, testProjectPath);

      if (alreadyLinkedLocally) {
        if (!isSilent)
          hLog(
            6,
            false,
            'yellow',
            '❉',
            `Already linked: /#package ${packageName} #/ → /#file ${testProject} #/`
          );
        continue;
      }

      try {
        await runCommand('npm', ['link', packageName, '--silent'], testProjectPath);
        if (!isSilent)
          hLog(
            6,
            false,
            'success',
            '✓',
            `Linked: /#package ${packageName} #/ → /#file ${testProject} #/`
          );
      } catch (error) {
        hLog(6, true, 'error', 'error', `Failed to link ${packageName}: ${error.message}`);
      }
    }
  }

  if (!isSilent) hLog(0, true, 'highlight', 'done', 'Package linking finished!');
}

function replaceVersionInAllFiles(directory, version) {
  const files = fs.readdirSync(directory, { recursive: true });
  let replacedCount = 0;
  const modifiedFiles = [];

  for (const file of files) {
    const filePath = path.join(directory, file);

    if (fs.statSync(filePath).isDirectory()) {
      continue;
    }

    if (
      filePath.endsWith('.map') ||
      filePath.match(/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/)
    ) {
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    content = content.replace(/{%%VERSION%%}/g, version);

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      replacedCount++;
      modifiedFiles.push(path.relative('packages', filePath));
    }
  }
  return { count: replacedCount, files: modifiedFiles };
}

async function build() {
  elapsed('total');
  if (!isSilent) {
    hLog(0, false, 'header', '\n==================================================');
    hLog(0, false, 'white', `BUILDING ${PROJECT_NAME.toUpperCase()} MONOREPO PACKAGES`);
    hLog(0, false, 'header', '==================================================');
    hLog(0, false, 'info', 'Version:', `/#accent ${rootPackageJson.version} #/`);
    hLog(0, false, 'info', 'Project:', `/#accent ${PROJECT_NAME} #/`);
    hLog(0, false, 'divider', '--------------------------------------------------\n');
  }

  await setupDevDependencies();

  elapsed('build');
  const builtPackages = [];

  elapsed('build vanilla');
  const vanillaConfig = rootPackageJson.packages?.vanilla || {};
  await buildFrameworkPackage('vanilla', {
    entry: `src/${PROJECT_NAME}.js`,
    ...vanillaConfig,
  });
  builtPackages.push('vanilla');
  elapsed('build vanilla');

  const packagesConfig = rootPackageJson.packages || {};

  for (const [frameworkName, config] of Object.entries(packagesConfig)) {
    if (frameworkName === 'vanilla') continue;
    if (skipAngular && config.format === 'angular') {
      if (!isSilent) {
        hLog(
          0,
          true,
          'yellow',
          'skip',
          `/#package @${PROJECT_NAME}/${frameworkName} #/ /#dim (--skip-angular) #/`
        );
      }
      continue;
    }
    elapsed('build ' + frameworkName);
    await buildFrameworkPackage(frameworkName, config);
    builtPackages.push(frameworkName);
    elapsed('build ' + frameworkName);
  }
  if (!isSilent) {
    hLog(0, false, 'brightGreen', '\n==================================================');
    hLog(
      0,
      true,
      'info',
      'version',
      `Replacing {%%VERSION%%} with /#accent ${rootPackageJson.version} #/...`
    );
  }
  const versionReplace = replaceVersionInAllFiles('packages', rootPackageJson.version);

  if (versionReplace.count > 0) {
    if (!isSilent)
      hLog(
        2,
        true,
        'success',
        'ok',
        `Updated ${versionReplace.count} file(s) with version /#accent ${rootPackageJson.version} #/`
      );
  } else {
    throw new Error('Version replacement failed: No placeholders found');
  }

  await linkPackagesToTestProjects();
  if (!isSilent) {
    hLog(0, true, 'success', 'success', 'All builds complete!', '\n');
    hLog(0, true, 'header', 'location', `Packages ready in /#file ./packages #/ directory`);
  }
  elapsed('build');
  if (!withoutPostbuild && fs.existsSync('./scripts/postbuild.js')) {
    if (!isSilent) {
      elapsed('postbuild');
      hLog(0, false, 'brightGreen', '==================================================');
      hLog(0, true, 'info', 'postbuild', 'Running postbuild.js...');
      hLog(0, false, 'divider', '--------------------------------------------------');
    }
    try {
      const postbuildData = {
        projectName: PROJECT_NAME,
        packages: builtPackages,
        version: rootPackageJson.version,
      };
      const jsonString = JSON.stringify(postbuildData);

      await runCommand(
        'node',
        ['./scripts/postbuild.js', Buffer.from(jsonString).toString('hex'), isSilent ? '-s' : ''],
        process.cwd()
      );
      if (!isSilent) {
        hLog(0, false, 'divider', '--------------------------------------------------');
        hLog(0, true, 'highlight', 'done', 'Postbuild script completed successfully');
      }
    } catch (error) {
      if (!isSilent) {
        hLog(0, false, 'divider', '--------------------------------------------------');
      }
      hLog(0, true, 'warning', 'warning', `Postbuild script error: ${error.message}`);
    }
    elapsed('postbuild');
  }
  if (!isSilent) {
    hLog(0, false, 'brightGreen', '==================================================');
    elapsed('total');
  }
}

async function watchMode() {
  hLog(0, false, 'header', '\n==================================================');
  hLog(
    0,
    false,
    'white',
    `WATCH MODE - /#green DEV #/${!skipAngular ? ' /#red WITH-ANGULAR #/' : ''}`
  );
  hLog(0, false, 'divider', '--------------------------------------------------\n');

  const initialTimestamp = Date.now();
  const initialVersion = `0.0.0-dev.${initialTimestamp}`;

  rootPackageJson.version = initialVersion;
  fs.writeFileSync('package.json', JSON.stringify(rootPackageJson, null, 2));

  // Build inicial
  elapsed('first build');
  await runCommand(
    'node',
    ['scripts/build.js', '--no-post', '--silent', skipAngular ? '-sa' : ''],
    process.cwd()
  );
  hLog(
    0,
    true,
    'success',
    'initial build',
    `/#version ${initialVersion} #/ complete /#[yellow  ${elapsed('first build', 0, true)}s  #/`
  );

  const watcher = chokidar.watch('src', {
    persistent: true,
    ignoreInitial: true,
  });

  hLog(0, false, 'header', '✦', '/#dim Monitoring src/ for changes... #/');

  let buildTimeout;
  let isBuilding = false;

  const rebuild = async () => {
    if (isBuilding) return;

    clearTimeout(buildTimeout);
    buildTimeout = setTimeout(async () => {
      isBuilding = true;
      const timestamp = Date.now();
      const devVersion = `0.0.0-dev.${timestamp}`;

      rootPackageJson.version = devVersion;
      fs.writeFileSync('package.json', JSON.stringify(rootPackageJson, null, 2));
      try {
        elapsed('rebuild');
        await runCommand(
          'node',
          ['scripts/build.js', '--no-post', '--silent', skipAngular ? '-sa' : ''],
          process.cwd()
        );
        hLog(
          0,
          false,
          'success',
          '✓',
          `/#dim Successfully built /#version ${devVersion} #/ /#[yellow  ${elapsed('rebuild', 0, true)}s  #/ #/`
        );
        isBuilding = false;
      } catch {
        elapsed('rebuild', 0, true);
        isBuilding = false;
      }
    }, 300);
  };

  watcher.on('change', async (filePath) => {
    hLog(0, false, 'blue', '❬❭', `/#dim File changed: /#file ${filePath} #/ #/`);
    rebuild();
  });

  watcher.on('add', async (filePath) => {
    hLog(0, false, 'white', '❭', `/#dim File added: /#file ${filePath} #/ #/`);
    rebuild();
  });

  watcher.on('unlink', async (filePath) => {
    hLog(0, false, 'red', '❬', `/#dim File removed: /#file ${filePath} #/ #/`);
    rebuild();
  });

  process.on('SIGINT', () => {
    hLog(0, true, 'info', 'exit', 'Stopping watch mode...', '\n');
    clearTimeout(buildTimeout);
    watcher.close();
    process.exit(0);
  });
}

if (isWatchMode) {
  watchMode().catch((error) => {
    hLog(0, true, 'error', 'error', `Watch mode failed: /#dim ${error} #/`, '\n');
    process.exit(1);
  });
} else {
  build().catch((error) => {
    hLog(0, true, 'error', 'error', `Build failed: /#dim ${error} #/`, '\n');
    process.exit(1);
  });
}
