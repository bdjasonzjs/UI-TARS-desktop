const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '../dist-prod');
const targetDir = path.join(distDir, 'build/Release');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

try {
  // Find libnut.node for darwin (macos)
  // Adjust grep if targeting other platforms
  const cmd = 'find ../../node_modules -name libnut.node | grep darwin | head -n 1';
  const srcPath = execSync(cmd).toString().trim();

  if (srcPath) {
    // Resolve absolute path relative to CWD (cli root)
    const absSrcPath = path.resolve(process.cwd(), srcPath);
    console.log(`Found libnut.node at ${absSrcPath}`);
    fs.copyFileSync(absSrcPath, path.join(targetDir, 'libnut.node'));
    console.log(`Copied libnut.node to ${path.join(targetDir, 'libnut.node')}`);
  } else {
    console.error('Could not find libnut.node in node_modules');
    process.exit(1);
  }

  // Find permissions.node (optional but recommended for macos)
  try {
    const cmdPerm = 'find ../../node_modules -name permissions.node | head -n 1';
    const srcPathPerm = execSync(cmdPerm).toString().trim();
    if (srcPathPerm) {
      const absSrcPathPerm = path.resolve(process.cwd(), srcPathPerm);
      console.log(`Found permissions.node at ${absSrcPathPerm}`);
      fs.copyFileSync(absSrcPathPerm, path.join(targetDir, 'permissions.node'));
      console.log(`Copied permissions.node to ${path.join(targetDir, 'permissions.node')}`);
    } else {
      console.warn('Could not find permissions.node in node_modules');
    }
  } catch (e) {
    console.warn('Error finding/copying permissions.node:', e);
  }

  // Copy package.json to dist-prod so bindings can find the root
  fs.copyFileSync(path.join(process.cwd(), 'package.json'), path.join(distDir, 'package.json'));
  console.log('Copied package.json to dist-prod');

  // Copy ffmpeg binary
  try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
      const destFfmpeg = path.join(distDir, 'ffmpeg');
      fs.copyFileSync(ffmpegPath, destFfmpeg);
      // Make executable
      fs.chmodSync(destFfmpeg, '755');
      console.log(`Copied ffmpeg binary to ${destFfmpeg}`);
    } else {
      console.warn('ffmpeg-static did not return a path');
    }
  } catch (err) {
    console.warn('Failed to copy ffmpeg binary:', err);
  }
} catch (e) {
  console.error('Error copying libnut.node:', e);
  process.exit(1);
}
