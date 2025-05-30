#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir, platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = join(__dirname, '..');
const MCP_SERVER_PATH = join(PACKAGE_ROOT, 'bin', 'mcp-server.js');

/**
 * Get the correct Cursor MCP config path for the current platform
 */
function getCursorConfigPath() {
  const home = homedir();
  
  switch (platform()) {
    case 'darwin': // macOS
      return join(home, '.cursor', 'mcp.json');
    case 'win32': // Windows
      // Note: Windows Cursor path needs verification - may vary by installation
      // Common locations: %USERPROFILE%\.cursor\mcp.json or %APPDATA%\Cursor\User\mcp.json
      return join(home, '.cursor', 'mcp.json');
    default: // Linux and others
      return join(home, '.cursor', 'mcp.json');
  }
}

/**
 * Get the correct Claude Desktop config path for the current platform
 */
function getClaudeConfigPath() {
  const home = homedir();
  
  switch (platform()) {
    case 'darwin': // macOS
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': // Windows
      return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    default: // Linux and others
      return join(home, '.config', 'claude-desktop', 'config.json');
  }
}

function setupCursorMCP(useNpm = false) {
  const cursorConfigPath = getCursorConfigPath();
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
  
  // Add VA Design System Monitor server
  if (useNpm) {
    config.servers['va-design-system-monitor'] = {
      command: 'npx',
      args: ['-y', 'va-design-system-monitor'],
      env: {}
    };
  } else {
    config.servers['va-design-system-monitor'] = {
      command: 'node',
      args: [MCP_SERVER_PATH],
      env: { NODE_ENV: 'production' },
    };
  }
  
  // Write config
  writeFileSync(cursorConfigPath, JSON.stringify(config, null, 2));
  const method = useNpm ? 'npm package' : 'local development';
  console.log(`✅ Configured Cursor MCP (${method}) at: ${cursorConfigPath}`);
}

function setupClaudeDesktopMCP(useNpm = false) {
  const claudeConfigPath = getClaudeConfigPath();
  const claudeConfigDir = dirname(claudeConfigPath);
  const currentPlatform = platform();
  
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
  
  // Handle different config formats based on platform
  if (currentPlatform === 'darwin' || currentPlatform === 'win32') {
    // macOS and Windows use mcpServers format
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add VA Design System Monitor server
    if (useNpm) {
      config.mcpServers['va-design-system-monitor'] = {
        command: 'npx',
        args: ['-y', 'va-design-system-monitor'],
        env: {}
      };
    } else {
      config.mcpServers['va-design-system-monitor'] = {
        command: 'node',
        args: [MCP_SERVER_PATH],
        env: { NODE_ENV: 'production' },
      };
    }
  } else {
    // Linux uses mcp.servers format
    if (!config.mcp) {
      config.mcp = {};
    }
    if (!config.mcp.servers) {
      config.mcp.servers = {};
    }
    
    // Add VA Design System Monitor server
    if (useNpm) {
      config.mcp.servers['va-design-system-monitor'] = {
        command: 'npx',
        args: ['-y', 'va-design-system-monitor'],
        env: {}
      };
    } else {
      config.mcp.servers['va-design-system-monitor'] = {
        command: 'node',
        args: [MCP_SERVER_PATH],
        env: { NODE_ENV: 'production' },
      };
    }
  }
  
  // Write config
  writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
  const method = useNpm ? 'npm package' : 'local development';
  console.log(`✅ Configured Claude Desktop MCP (${method}) at: ${claudeConfigPath}`);
}

function printManualInstructions() {
  const currentPlatform = platform();
  const cursorPath = getCursorConfigPath();
  const claudePath = getClaudeConfigPath();
  
  console.log('\n📋 Manual Setup Instructions:\n');
  
  // Show platform-specific paths
  console.log(`Platform detected: ${currentPlatform === 'darwin' ? 'macOS' : currentPlatform === 'win32' ? 'Windows' : 'Linux'}\n`);
  
  console.log('Option 1: NPM Package (Recommended for end users)');
  console.log(`Add this to your Cursor MCP config (${cursorPath}):`);
  console.log(JSON.stringify({
    servers: {
      "va-design-system-monitor": {
        command: "npx",
        args: ["-y", "va-design-system-monitor"],
        env: {}
      }
    }
  }, null, 2));
  
  console.log(`\nAdd this to your Claude Desktop config (${claudePath}):`);
  
  // Claude Desktop config format depends on platform
  if (currentPlatform === 'darwin' || currentPlatform === 'win32') {
    // macOS and Windows use claude_desktop_config.json format
    console.log(JSON.stringify({
      mcpServers: {
        "va-design-system-monitor": {
          command: "npx",
          args: ["-y", "va-design-system-monitor"],
          env: {}
        }
      }
    }, null, 2));
  } else {
    // Linux uses config.json format
    console.log(JSON.stringify({
      mcp: {
        servers: {
          "va-design-system-monitor": {
            command: "npx", 
            args: ["-y", "va-design-system-monitor"],
            env: {}
          }
        }
      }
    }, null, 2));
  }
  
  console.log('\n\nOption 2: Local Development');
  console.log(`Add this to your Cursor MCP config (${cursorPath}):`);
  console.log(JSON.stringify({
    servers: {
      "va-design-system-monitor": {
        command: "node",
        args: [MCP_SERVER_PATH],
        env: { NODE_ENV: 'production' }
      }
    }
  }, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const useNpm = args.includes('--npm') || args.includes('-n');
  const manualOnly = args.includes('--manual') || args.includes('-m');
  
  console.log('🚀 Setting up VA Design System Monitor MCP Server...\n');
  
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