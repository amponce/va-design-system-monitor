#!/usr/bin/env node

import { VAComponentMonitor } from '../lib/index.js';

async function testBasicFunctionality() {
  console.log('🧪 Testing VA Design System Monitor...\n');
  
  try {
    console.log('1. Creating VAComponentMonitor instance...');
    const monitor = new VAComponentMonitor();
    console.log('✅ Instance created successfully\n');
    
    console.log('2. Testing network request...');
    console.log('   Fetching VA component definitions...');
    
    // Add timeout to the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const content = await monitor.fetchComponentDefinitions();
      clearTimeout(timeoutId);
      console.log(`✅ Fetched ${content.length} characters of component definitions\n`);
      
      console.log('3. Testing parsing...');
      const components = monitor.parseComponentMetadata(content);
      console.log(`✅ Parsed ${components.size} components\n`);
      
      console.log('4. Testing component lookup...');
      const buttonComponent = await monitor.getComponentByName('va-button');
      if (buttonComponent) {
        console.log('✅ Found va-button component:');
        console.log(`   Name: ${buttonComponent.name}`);
        console.log(`   Tag: ${buttonComponent.tagName || 'N/A'}`);
        console.log(`   Status: ${buttonComponent.status}`);
        console.log(`   Level: ${buttonComponent.maturityLevel}`);
      } else {
        console.log('❌ va-button component not found');
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.log('❌ Network request timed out after 10 seconds');
        console.log('   This might be a network connectivity issue.');
      } else {
        console.log('❌ Network request failed:', fetchError.message);
      }
      return;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Also test if we can just import the module
console.log('Testing basic import...');
try {
  console.log('✅ Successfully imported VAComponentMonitor\n');
  testBasicFunctionality();
} catch (importError) {
  console.error('❌ Failed to import module:', importError.message);
} 