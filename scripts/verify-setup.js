#!/usr/bin/env node
/**
 * ClinicQueue Workspace Setup Verification Script
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('🔍 Checking ClinicQueue Monorepo Setup...');

const requiredFiles = [
  'package.json',
  '.gitignore',
  '.env.example',
  'render.yaml',
  'vercel.json',
  'apps/web/package.json',
  'apps/web/angular.json',
  'apps/api/package.json',
  'apps/api/prisma/schema.prisma',
  'document/Project Markdowns/architecture.md',
  'document/Project Markdowns/environment-variables.md',
  'document/Project Markdowns/deployment-vercel-render.md',
  'document/Project Markdowns/database-migrations.md',
];

let allPassed = true;

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.error(`  ❌ Missing: ${file}`);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('\n❌ Verification failed with missing required files.');
  process.exit(1);
}

console.log('\n✨ ClinicQueue Monorepo Setup Verified Successfully.');
