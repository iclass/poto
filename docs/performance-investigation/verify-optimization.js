// Quick verification that TypedJSON module has optimization
const fs = require('fs');
const path = require('path');

const typedJsonPath = path.join(__dirname, 'node_modules', 'poto', 'dist', 'shared', 'TypedJSON.js');
const content = fs.readFileSync(typedJsonPath, 'utf8');

if (content.includes('SKIPPED (no refs)')) {
  console.log('✅ Optimization IS present in node_modules');
  console.log('   Found: "SKIPPED (no refs) ⚡ OPTIMIZATION"');
} else {
  console.log('❌ Optimization NOT found in node_modules!');
  console.log('   Missing: "SKIPPED (no refs)"');
}

// Check if the conditional is there
if (content.includes('if (refs.size > 0)')) {
  console.log('✅ Conditional check IS present');
} else {
  console.log('❌ Conditional check MISSING!');
}
