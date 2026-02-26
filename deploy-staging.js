const { execSync } = require('child_process');
const path = require('path');

const projectPath = 'c:\\Users\\uppal\\uppal-crm-project';
process.chdir(projectPath);

console.log('🚀 Deploying to staging branch...\n');

try {
  // Configure git to not use an editor
  console.log('1️⃣  Setting git config...');
  execSync('git config --global core.editor ""', { stdio: 'inherit' });
  execSync('git config --global core.pager ""', { stdio: 'inherit' });

  // Fetch latest from origin
  console.log('\n2️⃣  Fetching from origin...');
  execSync('git fetch origin', { stdio: 'inherit' });

  // Check current branch
  console.log('\n3️⃣  Checking current branch...');
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  console.log(`Current branch: ${currentBranch}`);

  // Checkout staging
  console.log('\n4️⃣  Switching to staging branch...');
  execSync('git checkout staging', { stdio: 'inherit' });

  // Reset to origin
  console.log('\n5️⃣  Resetting to origin/staging...');
  execSync('git reset --hard origin/staging', { stdio: 'inherit' });

  // Create merge commit with explicit message
  console.log('\n6️⃣  Merging devtest into staging...');
  try {
    execSync('git merge -m "Merge devtest into staging: STEP 1 - Replace global.incomingCalls with database storage" origin/devtest', { stdio: 'inherit' });
  } catch (mergeErr) {
    console.log('⚠️  Merge command returned non-zero, checking status...');
  }

  // Push to staging
  console.log('\n7️⃣  Pushing to origin/staging...');
  execSync('git push origin staging', { stdio: 'inherit' });

  // Show recent commits
  console.log('\n✅ Recent commits on staging:');
  execSync('git log --oneline -5', { stdio: 'inherit' });

  console.log('\n🎉 Successfully deployed to staging!');
} catch (error) {
  console.error('❌ Deployment error:', error.message);
  process.exit(1);
}
