'use strict';

const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'src', 'sls.proto');
const outDir = path.join(__dirname, '..', 'dist');
const outPath = path.join(outDir, 'sls.proto');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.copyFileSync(srcPath, outPath);
