#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { hLog } from './colorize.js';

// Parse arguments
const { projectName, packages, version } = JSON.parse(
  Buffer.from(process.argv[2], 'hex').toString('utf8')
);
const isSilent = process.argv.includes('--silent') || process.argv.includes('-s');
if (!isSilent) {
  hLog(0, true, 'header', 'postbuild', 'Starting documentation update process...');
  hLog(2, false, 'info', 'Project:', `/#accent ${projectName} #/`);
  hLog(2, false, 'info', 'Packages:', packages.map((p) => `/#package ${p} #/`).join(', '));
  hLog(2, false, 'info', 'Version:', version);
}

// Track changes
let updateCount = 0;
let errorCount = 0;

// File paths
const files = {
  readme: 'README.md',
  index: 'docs/index.html',
  api: 'docs/API.md',
  vanilla: path.join('packages', 'vanilla', 'README.md'),
};

// Check README exists
if (!fs.existsSync(files.readme)) {
  hLog(2, true, 'error', 'error', 'README.md not found');
  process.exit(1);
}

// Store original states
const originalStates = {};
Object.entries(files).forEach(([key, path]) => {
  if (fs.existsSync(path) && key !== 'vanilla') {
    originalStates[key] = fs.readFileSync(path, 'utf-8');
  }
});

// Get package config
const { packages: packagesConfig = {} } = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

// Generic update function
function updateContent(content, updates, fileName) {
  if (!isSilent)
    hLog(0, true, 'header', `${fileName.toUpperCase()} UPDATE`, `Processing ${fileName}...`, '\n');

  let result = content;
  updates.forEach(({ regex, replacement, name }) => {
    if (regex.test(result)) {
      result = result.replace(regex, replacement);
      if (!isSilent) hLog(2, false, 'success', '✓', name);
      updateCount++;
    } else {
      hLog(2, false, 'error', '✗', `${name} not found`);
      errorCount++;
    }
  });

  return result;
}

// Generate badge URL
function getBadgeUrl(packages = [], useNN = false, singlePackage = null, color = 'black') {
  const base = 'https://badge.usal.dev/';
  const prefix = useNN ? '?nn&' : '?';

  if (singlePackage) {
    return `${base}${prefix}p=${encodeURIComponent(singlePackage)}&color=${color}`;
  }
  if (packages.length > 0) {
    return `${base}${prefix}ps=${encodeURIComponent(packages.join(','))}`;
  }
  return base;
}

// Generate framework info
function getFrameworkInfo() {
  const frameworkPackages = packages
    .filter((pkg) => pkg !== 'vanilla')
    .map((pkg) => `@${projectName}/${pkg}`);

  const examples = [
    {
      framework: 'Vanilla JS',
      setup: '',
      example: '<div data-usal="fade duration-500">Content</div>',
      pseudonyms: [],
    },
  ];

  Object.entries(packagesConfig).forEach(([framework, config]) => {
    if (config.usage && framework !== 'vanilla') {
      const name = framework.charAt(0).toUpperCase() + framework.slice(1);
      const { import: imp, start, prop, pseudonym = [] } = config.usage;

      examples.push({
        framework: name,
        setup: [imp, start].filter(Boolean).join('\n').trim(),
        example: prop ? `<div ${prop.replace('VALUES', 'fade duration-500')}>Content</div>` : '',
        pseudonyms: pseudonym,
      });
    }
  });

  return { frameworkPackages, examples };
}

// Get all updates for a file
function getUpdates(fileType, info) {
  const { frameworkPackages, examples } = info;
  const updates = [];

  // Common updates
  const frameworks = packages.map((p) =>
    p === 'vanilla' ? 'Vanilla JS' : p.charAt(0).toUpperCase() + p.slice(1)
  );
  const sorted = [
    ...frameworks.filter((f) => f !== 'Vanilla JS'),
    ...(frameworks.includes('Vanilla JS') ? ['Vanilla JS'] : []),
  ];
  const worksWithText = `Works with ${sorted.join(', ')} and more`;

  if (fileType === 'readme') {
    // Update "Works with" section
    updates.push({
      regex: /\*\*Works with[^*]+\*\*/g,
      replacement: `**${worksWithText}**`,
      name: 'Works with section',
    });

    // NPM installation section
    const installCmds = [`npm install ${projectName}`];
    const frameworkInstalls = frameworkPackages.map((p) => {
      const framework = p.split('/')[1];
      const displayName = framework.charAt(0).toUpperCase() + framework.slice(1);
      const pseudonyms = packagesConfig[framework]?.usage?.pseudonym || [];
      const label = pseudonyms.length > 0 ? `${displayName}/${pseudonyms.join('/')}` : displayName;
      return `npm install ${p}   # For ${label}`;
    });

    if (frameworkInstalls.length > 0) {
      installCmds.push('', '# Framework-specific packages', ...frameworkInstalls);
    }

    updates.push({
      regex: /(### NPM\n\n```bash\n)([\s\S]*?)(```)/,
      replacement: `$1${installCmds.join('\n')}\n$3`,
      name: 'NPM installation',
    });

    // Framework Setup section - Update individual framework sections
    examples
      .filter((e) => e.setup && e.framework !== 'Vanilla JS')
      .forEach(({ framework, setup, pseudonyms }) => {
        const frameworkName = framework;
        const pseudonymText = pseudonyms.length > 0 ? ` \\(${pseudonyms.join('/')}\\)` : '';

        updates.push({
          regex: new RegExp(
            `(### [\\u{1F7E0}-\\u{1F7EB}\\u{2B1B}\\u{2B1C}] ${frameworkName}${pseudonymText}\n\n\`\`\`jsx?\n)([\\s\\S]*?)(\`\`\`)`,
            'iu'
          ),
          replacement: `$1${setup}\n$3`,
          name: `${frameworkName} setup`,
        });
      });

    // Package table in Packages Overview section
    let pkgTable = '| Package | Version |\n|---------|---------|\n';
    pkgTable += `| \`${projectName}\` | ![npm](${getBadgeUrl(frameworkPackages, true)}) |\n`;

    packages
      .filter((p) => p !== 'vanilla')
      .forEach((pkg) => {
        const name = `@${projectName}/${pkg}`;
        const color = packagesConfig[pkg]?.usage?.color || 'grey';
        pkgTable += `| \`${name}\` | ![npm](${getBadgeUrl([], true, name, color)}) |\n`;
      });

    updates.push({
      regex: /(## 📊 Packages Overview\n\n)([\s\S]*?)(\n\n## )/,
      replacement: `$1${pkgTable}$3`,
      name: 'Package overview table',
    });
  }

  if (fileType === 'api' && fs.existsSync(files.api)) {
    // Framework Usage section in API.md
    const usageExamples = examples
      .map(({ framework, example, pseudonyms }) => {
        if (!example) return '';
        const label = pseudonyms.length > 0 ? `${framework}/${pseudonyms.join('/')}` : framework;
        return `<!-- ${label} -->\n${example}`;
      })
      .filter(Boolean)
      .join('\n\n');

    updates.push({
      regex: /(### Framework Usage\n\n```html\n)([\s\S]*?)(```)/,
      replacement: `$1${usageExamples}\n$3`,
      name: 'Framework usage examples',
    });
  }

  if (fileType === 'index' && fs.existsSync(files.index)) {
    // Installation commands
    const installCmds = [`# Install\nnpm install ${projectName}`];
    if (frameworkPackages.length > 0) {
      installCmds.push(
        '\n# Framework-specific packages:',
        ...frameworkPackages.map((p) => `npm install ${p}`)
      );
    }

    updates.push({
      regex: /(<code class="bash"># Install[\s\S]*?)<\/code><\/pre>/,
      replacement: `<code class="bash">${installCmds.join('\n')}</code></pre>`,
      name: 'Installation section',
    });

    // Usage examples HTML
    const htmlExamples = examples
      .map(({ framework, example, pseudonyms }) => {
        if (!example) return '';
        const label = pseudonyms.length > 0 ? `${framework}/${pseudonyms.join('/')}` : framework;
        const escapedExample = example.replace(
          /[<>"'&]/g,
          (m) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' })[m]
        );
        return `&lt;!-- ${label} --&gt;\n${escapedExample}`;
      })
      .filter(Boolean)
      .join('\n\n');

    updates.push({
      regex:
        /(<div class="animation-desc">Main animation attribute<\/div>\s*<pre><code class="html">)([\s\S]*?)(<\/code><\/pre>)/,
      replacement: `$1${htmlExamples}\n$3`,
      name: 'Usage examples',
    });

    // JavaScript API
    const setupExamples = examples
      .filter((e) => e.setup && e.framework !== 'Vanilla JS')
      .map(({ framework, setup, pseudonyms }) => {
        const label = framework + (pseudonyms.length ? ` (${pseudonyms.join(', ')})` : '');
        return `// ${label}\n${setup}`;
      })
      .join('\n\n');

    updates.push({
      regex:
        /(Installed via CDN, initializes automatically, instance in window\.USAL\n)[\s\S]*?(<\/code><\/pre>)/,
      replacement: `$1\n${setupExamples.replace(
        /[<>"'&]/g,
        (m) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' })[m]
      )}$2`,
      name: 'JavaScript API',
    });

    // Badges
    updates.push({
      regex: /(<div class="sidebar-version">)([\s\S]*?)(<\/div>)/,
      replacement: `$1\n  <img src="${getBadgeUrl(frameworkPackages)}" alt="${projectName} npm package">\n$3`,
      name: 'Main badge',
    });

    const badges = packages
      .filter((p) => p !== 'vanilla')
      .map((pkg) => {
        const name = `@${projectName}/${pkg}`;
        const color = packagesConfig[pkg]?.usage?.color || 'black';
        return `  <img src="${getBadgeUrl([], false, name, color)}" alt="${name} npm package">`;
      })
      .join('\n');

    updates.push({
      regex: /(<div class="badges">)[\s\S]*?(<\/div>)/,
      replacement: `$1\n${badges}\n$2`,
      name: 'Package badges',
    });
  }

  return updates;
}

// Process files
const info = getFrameworkInfo();
const processed = {};

Object.entries(originalStates).forEach(([key, content]) => {
  const updates = getUpdates(key, info);
  processed[key] = updateContent(content, updates, files[key]);
});

if (!isSilent) hLog(0, true, 'highlight', 'finishing', 'Latest processing...', '\n');
// Save files
Object.entries(processed).forEach(([key, content]) => {
  fs.writeFileSync(files[key], content);
  if (!isSilent) hLog(2, true, 'info', 'saved', files[key]);
});

// Copy README to vanilla
if (processed.readme && fs.existsSync(path.dirname(files.vanilla))) {
  fs.writeFileSync(files.vanilla, processed.readme);
  if (!isSilent) hLog(2, true, 'info', 'copied', 'README to vanilla package');
}

// Format documents
if (!isSilent) hLog(0, true, 'header', 'format', 'Running format...', '\n');
try {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execSync('npm run format', { stdio: 'pipe' });
  if (!isSilent) hLog(2, true, 'success', 'success', 'Formatted');
} catch {
  hLog(2, true, 'warning', 'warning', 'Format failed');
}

// Check changes
if (!isSilent) hLog(0, true, 'header', 'comparison', 'Checking changes...', '\n');
const changes = [];

Object.entries(originalStates).forEach(([key, original]) => {
  const current = fs.readFileSync(files[key], 'utf-8');
  const status = current !== original ? 'CHANGED' : 'NO CHANGE';
  const color = current !== original ? 'success' : 'yellow';

  if (!isSilent) hLog(2, true, color, status, files[key]);
  if (current !== original) changes.push(files[key]);
});

if (changes.length === 0 && !isSilent) {
  hLog(0, true, 'header', 'postbuild complete', 'All files up to date!', '\n');
} else if (errorCount > 0) {
  hLog(0, true, 'warning', 'postbuild complete with warnings');
  hLog(2, false, 'success', 'Updated:', changes.join(', '));
  hLog(2, false, 'error', 'Errors:', errorCount.toString());
} else if (!isSilent) {
  hLog(0, true, 'highlight', 'postbuild success');
  hLog(2, false, 'success', 'Updated:', changes.join(', '));
  hLog(2, false, 'success', 'Processed:', `${updateCount} sections`);
}

process.exit(errorCount > 2 ? 1 : 0);
