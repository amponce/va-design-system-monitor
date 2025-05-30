#!/usr/bin/env node

import { VAComponentMonitor } from '../lib/index.js';

async function debugParsing() {
  console.log('🔍 Debugging parsing issue...\n');
  
  try {
    const monitor = new VAComponentMonitor();
    
    console.log('Fetching content...');
    const content = await monitor.fetchComponentDefinitions();
    console.log(`✅ Fetched ${content.length} characters\n`);
    
    // Test if we can find any components with a simpler approach first
    console.log('Testing simple component detection...');
    const simpleMatches = content.match(/interface\s+Va\w+/g);
    console.log(`Found ${simpleMatches ? simpleMatches.length : 0} Va interfaces\n`);
    
    if (simpleMatches) {
      console.log('First few interfaces:', simpleMatches.slice(0, 5));
    }
    
    // Test the componentName pattern specifically
    console.log('\nTesting @componentName detection...');
    const componentNameMatches = content.match(/@componentName\s+([^\n\r]+)/g);
    console.log(`Found ${componentNameMatches ? componentNameMatches.length : 0} @componentName annotations\n`);
    
    if (componentNameMatches) {
      console.log('First few component names:', componentNameMatches.slice(0, 5));
    }
    
    // Now try the full parsing but with timeout
    console.log('Testing full parsing with timeout...');
    const parseStart = Date.now();
    
    setTimeout(() => {
      console.log('⚠️ Parsing is taking longer than 5 seconds, likely hanging...');
      process.exit(1);
    }, 5000);
    
    const components = monitor.parseComponentMetadata(content);
    const parseTime = Date.now() - parseStart;
    
    console.log(`✅ Parsed ${components.size} components in ${parseTime}ms`);
    
    // Show first few components
    const componentArray = Array.from(components.values()).slice(0, 3);
    componentArray.forEach(comp => {
      console.log(`- ${comp.name} (${comp.tagName || 'no tag'}) - ${comp.status}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugParsing(); 