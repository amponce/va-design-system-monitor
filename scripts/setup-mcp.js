#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = join(__dirname, '..');
const MCP_SERVER_PATH = join(PACKAGE_ROOT, 'bin', 'mcp-server.js');

function setupCursorMCP(useNpm = false) {
  const cursorConfigPath = join(homedir(), '.cursor', 'mcp.json');
  const cursorConfigDir = dirname(cursorConfigPath);
  
  // Ensure .cursor directory exists
  if (!existsSync(cursorConfigDir)) {
    mkdirSync(cursorConfigDir, { recursive: true });
  }
  
  let config = {};
  
  // Read existing config if it exists
  if (existsSync(cursorConfigPath)) {
    try {
      const existingConfig = readFileSync(cursorConfigPath, 'utf8');
      config = JSON.parse(existingConfig);
    } catch (error) {
      console.warn('Warning: Could not parse existing Cursor MCP config, creating new one');
    }
  }
  
  // Ensure servers object exists
  if (!config.servers) {
    config.servers = {};
  }
  
  // Add VA Component Monitor server
  if (useNpm) {
    config.servers['va-component-monitor'] = {
      command: 'npx',
      args: ['-y', '@va-application-template/component-monitor'],
      env: {}
    };
  } else {
    config.servers['va-component-monitor'] = {
      command: 'node',
      args: [MCP_SERVER_PATH],
      env: {}
    };
  }
  
  // Write config
  writeFileSync(cursorConfigPath, JSON.stringify(config, null, 2));
  const method = useNpm ? 'npm package' : 'local development';
  console.log(`✅ Configured Cursor MCP (${method}) at: ${cursorConfigPath}`);
}

function setupClaudeDesktopMCP(useNpm = false) {
  const claudeConfigPath = join(homedir(), '.config', 'claude-desktop', 'config.json');
  const claudeConfigDir = dirname(claudeConfigPath);
  
  // Ensure claude-desktop directory exists
  if (!existsSync(claudeConfigDir)) {
    mkdirSync(claudeConfigDir, { recursive: true });
  }
  
  let config = {};
  
  // Read existing config if it exists
  if (existsSync(claudeConfigPath)) {
    try {
      const existingConfig = readFileSync(claudeConfigPath, 'utf8');
      config = JSON.parse(existingConfig);
    } catch (error) {
      console.warn('Warning: Could not parse existing Claude Desktop config, creating new one');
    }
  }
  
  // Ensure mcp.servers object exists
  if (!config.mcp) {
    config.mcp = {};
  }
  if (!config.mcp.servers) {
    config.mcp.servers = {};
  }
  
  // Add VA Component Monitor server
  if (useNpm) {
    config.mcp.servers['va-component-monitor'] = {
      command: 'npx',
      args: ['-y', '@va-application-template/component-monitor'],
      env: {}
    };
  } else {
    config.mcp.servers['va-component-monitor'] = {
      command: 'node',
      args: [MCP_SERVER_PATH],
      env: {}
    };
  }
  
  // Write config
  writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
  const method = useNpm ? 'npm package' : 'local development';
  console.log(`✅ Configured Claude Desktop MCP (${method}) at: ${claudeConfigPath}`);
}

function printManualInstructions() {
  console.log('\n📋 Manual Setup Instructions:\n');
  
  console.log('Option 1: NPM Package (Recommended for end users)');
  console.log('Add this to your ~/.cursor/mcp.json:');
  console.log(JSON.stringify({
    servers: {
      "va-component-monitor": {
        command: "npx",
        args: ["-y", "@va-application-template/component-monitor"],
        env: {}
      }
    }
  }, null, 2));
  
  console.log('\nAdd this to your ~/.config/claude-desktop/config.json:');
  console.log(JSON.stringify({
    mcp: {
      servers: {
        "va-component-monitor": {
          command: "npx", 
          args: ["-y", "@va-application-template/component-monitor"],
          env: {}
        }
      }
    }
  }, null, 2));
  
  console.log('\n\nOption 2: Local Development');
  console.log('Add this to your ~/.cursor/mcp.json:');
  console.log(JSON.stringify({
    servers: {
      "va-component-monitor": {
        command: "node",
        args: [MCP_SERVER_PATH],
        env: {}
      }
    }
  }, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const useNpm = args.includes('--npm') || args.includes('-n');
  const manualOnly = args.includes('--manual') || args.includes('-m');
  
  console.log('🚀 Setting up VA Component Monitor MCP Server...\n');
  
  if (manualOnly) {
    printManualInstructions();
    return;
  }
  
  if (useNpm) {
    console.log('📦 Using npm package configuration\n');
  } else {
    console.log(`📍 Using local development configuration`);
    console.log(`📁 MCP Server Path: ${MCP_SERVER_PATH}\n`);
  }
  
  try {
    setupCursorMCP(useNpm);
    setupClaudeDesktopMCP(useNpm);
    
    console.log('\n🎉 MCP Server setup complete!');
    console.log('\nNext steps:');
    console.log('1. Restart Cursor or Claude Desktop');
    console.log('2. Test the connection by asking: "Show me the status of va-button"');
    console.log('3. Use commands like: "Generate examples for va-alert"');
    
    if (useNpm) {
      console.log('\n💡 Using npm package - will always use latest published version');
    } else {
      console.log('\n💡 Using local development - changes to code will be reflected immediately');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Try manual setup with: npm run setup -- --manual');
    process.exit(1);
  }
}

main(); 