#!/usr/bin/env node

/**
 * Download NBI (National Bridge Inventory) data from FHWA.
 * Tries 2025 first, falls back to 2024.
 * Extracts the CSV from the zip archive.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data', 'raw');
const ZIP_PATH = path.join(DATA_DIR, 'nbi-all.zip');

const URLS = [
  'https://www.fhwa.dot.gov/bridge/nbi/2025/delimited/AllRecords2025.zip',
  'https://www.fhwa.dot.gov/bridge/nbi/2024/delimited/AllRecords2024.zip'
];

// Ensure data/raw directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created directory: ${DATA_DIR}`);
}

/**
 * Follow redirects and download a URL to a file, showing progress.
 */
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    console.log(`Downloading: ${url}`);

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let redirectUrl = response.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        console.log(`  Redirected to: ${redirectUrl}`);
        response.resume(); // consume response to free memory
        return downloadFile(redirectUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }

      const totalSize = parseInt(response.headers['content-length'], 10) || 0;
      let downloaded = 0;
      let lastPct = -1;

      const file = fs.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize > 0) {
          const pct = Math.floor((downloaded / totalSize) * 100);
          if (pct !== lastPct && pct % 5 === 0) {
            const mb = (downloaded / 1048576).toFixed(1);
            const totalMb = (totalSize / 1048576).toFixed(1);
            process.stdout.write(`\r  Progress: ${pct}% (${mb} MB / ${totalMb} MB)`);
            lastPct = pct;
          }
        } else {
          const mb = (downloaded / 1048576).toFixed(1);
          if (downloaded % (1024 * 512) < chunk.length) {
            process.stdout.write(`\r  Downloaded: ${mb} MB`);
          }
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`\n  Saved to: ${destPath}`);
        console.log(`  Size: ${(downloaded / 1048576).toFixed(1)} MB`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Extract zip file using system unzip command.
 */
function extractZip(zipPath, destDir) {
  console.log(`\nExtracting: ${zipPath}`);
  try {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    console.log(`Extracted to: ${destDir}`);
  } catch (err) {
    // Try with tar as fallback (macOS)
    try {
      execSync(`tar -xf "${zipPath}" -C "${destDir}"`, { stdio: 'inherit' });
      console.log(`Extracted to: ${destDir} (using tar)`);
    } catch (err2) {
      throw new Error(`Failed to extract zip: ${err.message}`);
    }
  }
}

async function main() {
  let downloaded = false;

  for (const url of URLS) {
    try {
      await downloadFile(url, ZIP_PATH);
      downloaded = true;
      break;
    } catch (err) {
      console.error(`\nFailed to download from ${url}: ${err.message}`);
      console.log('Trying next URL...\n');
    }
  }

  if (!downloaded) {
    console.error('\nERROR: Could not download NBI data from any source.');
    console.error('You may need to download manually from https://www.fhwa.dot.gov/bridge/nbi.cfm');
    process.exit(1);
  }

  // Extract the zip
  extractZip(ZIP_PATH, DATA_DIR);

  // List extracted files
  const files = fs.readdirSync(DATA_DIR);
  console.log('\nExtracted files:');
  files.forEach(f => {
    const stat = fs.statSync(path.join(DATA_DIR, f));
    console.log(`  ${f} (${(stat.size / 1048576).toFixed(1)} MB)`);
  });

  console.log('\nDone! Now run: npm run process-nbi');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
