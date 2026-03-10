const fs = require('fs');
const path = require('path');
const glob = require('glob');

const replacements = [
  { from: '@tarko/agent', to: '@ui-tars-test/tarko-agent' },
  { from: '@tarko/agent-interface', to: '@ui-tars-test/tarko-agent-interface' }
];

const rootDir = path.join(__dirname, 'multimodal');

// 1. Update package.json files
const packageJsonFiles = glob.sync('**/package.json', { 
  cwd: rootDir, 
  absolute: true, 
  ignore: ['**/node_modules/**', '**/dist/**'] 
});

packageJsonFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const pkg = JSON.parse(content);
    let changed = false;

    // Don't update the package definition itself if it's the package being renamed
    // (We already renamed the packages themselves in previous steps, checking name to be safe)
    
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(type => {
      if (pkg[type]) {
        replacements.forEach(({ from, to }) => {
          if (pkg[type][from]) {
            console.log(`[package.json] Updating ${pkg.name}: ${from} -> ${to}`);
            pkg[type][to] = pkg[type][from];
            delete pkg[type][from];
            changed = true;
          }
        });
      }
    });

    if (changed) {
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    }
  } catch (e) {
    console.error(`Error processing ${file}:`, e.message);
  }
});

// 2. Update imports in source files
const sourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,md,mdx}', { 
  cwd: rootDir, 
  absolute: true, 
  ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'] 
});

sourceFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    replacements.forEach(({ from, to }) => {
      // Replace import statements and require calls
      // Also handle "from '@tarko/agent'"
      const regex = new RegExp(`(['"])${from}(['"/])`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `$1${to}$2`);
        changed = true;
        console.log(`[source] Updating ${path.relative(rootDir, file)}: ${from} -> ${to}`);
      }
    });

    if (changed) {
      fs.writeFileSync(file, content);
    }
  } catch (e) {
    console.error(`Error processing ${file}:`, e.message);
  }
});
