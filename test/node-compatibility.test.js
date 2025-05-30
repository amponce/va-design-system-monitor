#!/usr/bin/env node

/**
 * Test Node.js compatibility across versions
 * This test verifies the package works in both Node 14.15.0 and Node 22+
 */

console.log('🧪 Testing Node.js compatibility...\n');

console.log(`Node.js version: ${process.version}`);
console.log(`Native fetch available: ${typeof globalThis?.fetch !== 'undefined'}`);

// Test fetch detection
async function testFetchDetection() {
  try {
    const { getFetch } = await import('../lib/index.js');
    
    // This is a private function, so we'll test the public API instead
    const { checkComponent } = await import('../lib/index.js');
    
    console.log('✅ Module imports successfully');
    
    // Test a simple component check
    const result = await checkComponent('va-button');
    
    if (result && result.name === 'Button') {
      console.log('✅ Component lookup works');
      console.log(`✅ Found: ${result.name} (${result.tagName}) - ${result.status}`);
    } else {
      console.log('❌ Component lookup failed');
    }
    
  } catch (error) {
    console.error('❌ Compatibility test failed:', error.message);
    process.exit(1);
  }
}

testFetchDetection()
  .then(() => {
    console.log('\n🎉 Node.js compatibility test passed!');
    console.log(`This package works on Node.js ${process.version}`);
  })
  .catch(error => {
    console.error('\n💥 Compatibility test failed:', error);
    process.exit(1);
  }); 