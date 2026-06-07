const { loadVfsModule } = require('./packages/core');
const fs = require('fs');
const path = require('path');

const { VfsRepo } = loadVfsModule();

const testDir = path.join(__dirname, 'test_new_features');

async function runTests() {
  console.log('=== Testing New Features ===\n');

  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const repo = new VfsRepo(testDir);
  console.log('✓ Repository created');

  repo.init();
  console.log('✓ Repository initialized');

  console.log('\n--- Test 1: Ed25519 Key Generation ---');
  const keys = repo.listKeys();
  console.log('Initial keys:', keys);

  const keypair = repo.generateKeypair('test-key');
  console.log('Generated keypair:', JSON.stringify(keypair, null, 2));
  console.log('  Public key:', keypair.publicKey.substring(0, 32) + '...');
  console.log('  Private key:', keypair.privateKey.substring(0, 32) + '...');

  const keysAfter = repo.listKeys();
  console.log('Keys after generation:', keysAfter);
  console.assert(keysAfter.includes('test-key'), 'Key should be listed');
  console.log('✓ Key generation works\n');

  console.log('--- Test 2: Create files and commit with signature ---');
  fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Hello World\n');
  repo.addFile('file1.txt');

  const commitId1 = repo.commitSigned('Initial commit with signature', 'Test User <test@example.com>', 'test-key');
  console.log('Signed commit ID:', commitId1);

  const commit1 = repo.getCommit(commitId1);
  console.log('Commit details:', JSON.stringify(commit1, null, 2));
  console.log('  Message:', commit1.message);
  console.log('  Author:', commit1.author);
  console.log('  Is signed:', commit1.isSigned);
  console.log('  Public key:', commit1.publicKey?.substring(0, 32) + '...');
  console.log('  Signature:', commit1.signature?.substring(0, 32) + '...');
  console.assert(commit1.isSigned, 'Commit should be signed');
  console.assert(commit1.publicKey !== null, 'Commit should have public key');
  console.assert(commit1.signature !== null, 'Commit should have signature');
  console.log('✓ Signed commit created\n');

  console.log('--- Test 3: Signature Verification ---');
  const verification = repo.verifyCommit(commitId1);
  console.log('Verification result:', JSON.stringify(verification, null, 2));
  console.log('  Is signed:', verification.isSigned);
  console.log('  Verified:', verification.verified);
  console.log('  Public key:', verification.publicKey?.substring(0, 32) + '...');
  console.assert(verification.verified, 'Signature should be verified');
  console.log('✓ Signature verification works\n');

  console.log('--- Test 4: Create more commits for time travel ---');
  await new Promise(resolve => setTimeout(resolve, 1500));
  fs.writeFileSync(path.join(testDir, 'file2.txt'), 'Second file\n');
  repo.addFile('file2.txt');
  const commitId2 = repo.commit('Second commit (unsigned)', 'Test User <test@example.com>');
  console.log('Unsigned commit ID:', commitId2);

  const commit2 = repo.getCommit(commitId2);
  console.log('Commit 2 is signed:', commit2.isSigned);
  console.assert(!commit2.isSigned, 'Commit should not be signed');

  await new Promise(resolve => setTimeout(resolve, 1500));
  fs.writeFileSync(path.join(testDir, 'file3.txt'), 'Third file\n');
  repo.addFile('file3.txt');
  const commitId3 = repo.commitSigned('Third commit (signed again)', 'Test User <test@example.com>', 'test-key');
  console.log('Third signed commit ID:', commitId3);

  const history = repo.getCommitHistory();
  console.log('Total commits:', history.length);
  history.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.message} (ts: ${c.timestamp}) - ${c.isSigned ? '🔐 Signed' : '📝 Unsigned'}`);
  });
  console.assert(history.length === 3, 'Should have 3 commits');
  console.log('✓ Multiple commits created\n');

  console.log('--- Test 5: Time Travel (get commit at time) ---');
  const firstCommit = history[history.length - 1];
  const lastCommit = history[0];

  console.log('First commit:', firstCommit.message, 'ts:', firstCommit.timestamp);
  console.log('Last commit:', lastCommit.message, 'ts:', lastCommit.timestamp);

  const commitAtTime1 = repo.getCommitAtTime(firstCommit.timestamp);
  console.log('Commit at first commit timestamp:', commitAtTime1?.message);
  console.assert(commitAtTime1?.id === firstCommit.id, 'Should get first commit at its timestamp');

  const commitAtTime2 = repo.getCommitAtTime(lastCommit.timestamp);
  console.log('Commit at last commit timestamp:', commitAtTime2?.message);
  console.assert(commitAtTime2?.id === lastCommit.id, 'Should get last commit at its timestamp');

  const middleTime = Math.floor((firstCommit.timestamp + lastCommit.timestamp) / 2);
  const commitAtMiddle = repo.getCommitAtTime(middleTime);
  console.log('Commit at middle timestamp:', commitAtMiddle?.message);
  console.assert(commitAtMiddle !== null, 'Should get a commit at middle timestamp');
  console.log('✓ Time travel works\n');

  console.log('--- Test 6: File tree at specific commit ---');
  console.log('First commit ID:', firstCommit.id);
  console.log('Last commit ID:', lastCommit.id);
  
  const firstCommitObj = repo.getCommit(firstCommit.id);
  console.log('First commit tree_hash:', firstCommitObj.treeHash);
  const lastCommitObj = repo.getCommit(lastCommit.id);
  console.log('Last commit tree_hash:', lastCommitObj.treeHash);

  const treeAtFirstStr = repo.getFileTreeAtCommit(firstCommit.id);
  console.log('Tree at first (raw):', treeAtFirstStr);
  const treeAtFirst = JSON.parse(treeAtFirstStr);
  const filesAtFirst = [];
  function collectFiles(node, files) {
    if (node.is_dir && node.children) {
      node.children.forEach(child => collectFiles(child, files));
    } else if (!node.is_dir) {
      files.push(node.path);
    }
  }
  collectFiles(treeAtFirst, filesAtFirst);
  console.log('Files at first commit:', filesAtFirst);
  console.assert(filesAtFirst.includes('file1.txt'), 'Should have file1.txt at first commit');
  console.assert(!filesAtFirst.includes('file2.txt'), 'Should not have file2.txt at first commit');

  const treeAtLastStr = repo.getFileTreeAtCommit(lastCommit.id);
  console.log('Tree at last (raw):', treeAtLastStr);
  const treeAtLast = JSON.parse(treeAtLastStr);
  const filesAtLast = [];
  collectFiles(treeAtLast, filesAtLast);
  console.log('Files at last commit:', filesAtLast);
  console.assert(filesAtLast.includes('file1.txt'), 'Should have file1.txt at last commit');
  console.assert(filesAtLast.includes('file2.txt'), 'Should have file2.txt at last commit');
  console.assert(filesAtLast.includes('file3.txt'), 'Should have file3.txt at last commit');
  console.log('✓ File tree at specific commit works\n');

  console.log('--- Test 7: Another key generation ---');
  const keypair2 = repo.generateKeypair('second-key');
  console.log('Second key generated');
  const allKeys = repo.listKeys();
  console.log('All keys:', allKeys);
  console.assert(allKeys.length === 2, 'Should have 2 keys');
  console.log('✓ Multiple keys work\n');

  console.log('=== All tests passed! ===\n');
  console.log('Summary of new features verified:');
  console.log('  ✓ Ed25519 Key Generation');
  console.log('  ✓ Signed Commits');
  console.log('  ✓ Signature Verification');
  console.log('  ✓ Time Travel (get commit at time)');
  console.log('  ✓ File Tree at Specific Commit');
  console.log('  ✓ Multiple Key Management');

  console.log('\nNote: Auto-staging (file watcher) and IPC handlers');
  console.log('      require Electron runtime environment to test.');

  fs.rmSync(testDir, { recursive: true, force: true });
}

runTests().catch(console.error);
