#!/usr/bin/env node

import { VAComponentMonitor, VAComponentError, checkComponent, validateComponents, lintComponents, getComponentProperties, getComponentExamples, getOfficialExamples, ErrorCodes } from '../lib/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// Production-ready logger that respects --quiet flag
const isQuiet = process.argv.includes('--quiet') || process.argv.includes('-q');
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-vv');

const logger = {
  error: (message, code = null) => {
    const timestamp = new Date().toISOString();
    const codeStr = code ? ` [${code}]` : '';
    console.error(`[${timestamp}] ERROR${codeStr}: ${message}`);
  },
  warn: (message) => {
    if (!isQuiet) {
      console.warn(`WARN: ${message}`);
    }
  },
  info: (message) => {
    if (isVerbose) {
      console.log(`INFO: ${message}`);
    }
  },
  success: (message) => {
    if (!isQuiet) {
      console.log(`✅ ${message}`);
    }
  }
};

/**
 * Sanitize and validate CLI input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous characters and limit length
  return input
    .replace(/[<>'";&|`$(){}[\]\\]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Handle process termination gracefully
 */
function setupGracefulShutdown() {
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', 'CRITICAL');
    console.error(error.stack);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', 'CRITICAL');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    process.exit(1);
  });
}

function showHelp() {
  console.log(`
VA Design System Monitor CLI v${packageJson.version}

A production-ready tool for monitoring VA Design System component status and maturity levels.

Usage: va-components <command> [options]

Commands:
  check <component>              Check status of a specific component
  props <component>              Show properties/props for a component
  examples <component>           Generate example implementations
  validate <components...>       Validate multiple components
  lint <components...>           Lint components and show issues
  list [filter]                  List components (recommended|caution|stable|experimental)
  report                         Generate full component report
  quick <component> <cmd1> [cmd2]  Run multiple commands for a component

Options:
  --json                         Output in JSON format
  --quiet, -q                    Suppress non-essential output
  --verbose, -vv                 Show detailed logging
  --timeout <ms>                 Set request timeout (default: 10000ms)
  --help, -h                     Show this help message
  --version, -v                  Show version number

Examples:
  va-components check va-button
  va-components props va-button
  va-components examples va-button
  va-components validate va-button va-alert va-card
  va-components lint va-modal va-table
  va-components list recommended
  va-components report --json
  va-components check va-button --timeout 15000

Environment Variables:
  NODE_ENV                       Set to 'production' for production logging
  VA_MONITOR_TIMEOUT             Default timeout in milliseconds
`);
}

function formatComponent(component, jsonOutput = false) {
  if (jsonOutput) {
    return JSON.stringify(component, null, 2);
  }

  const statusIcon = {
    'RECOMMENDED': '🟢',
    'STABLE': '🟡',
    'EXPERIMENTAL': '🟠',
    'AVAILABLE_WITH_ISSUES': '🔴',
    'USE_WITH_CAUTION': '⚠️',
    'UNKNOWN': '❓'
  };

  return `${statusIcon[component.status]} ${component.name} (${component.tagName || 'N/A'})
   Status: ${component.status}
   Level: ${component.maturityLevel}
   Recommendation: ${component.recommendation}`;
}

function formatProperties(propertiesData, jsonOutput = false) {
  if (jsonOutput) {
    return JSON.stringify(propertiesData, null, 2);
  }

  const { component, properties } = propertiesData;
  
  let output = `🔧 ${component.name} (${component.tagName || 'N/A'}) Properties\n`;
  output += `   Status: ${component.status} | Level: ${component.maturityLevel}\n\n`;
  
  if (properties.length === 0) {
    output += '   No properties found\n';
    return output;
  }
  
  output += `   Found ${properties.length} property/properties:\n\n`;
  
  properties.forEach(prop => {
    const optional = prop.optional ? '?' : '';
    output += `   📋 ${prop.name}${optional}: ${prop.type}\n`;
    if (prop.description) {
      output += `      ${prop.description}\n`;
    }
    output += '\n';
  });
  
  return output;
}

function formatExamples(examplesData, jsonOutput = false) {
  if (jsonOutput) {
    return JSON.stringify(examplesData, null, 2);
  }

  const { component, examples } = examplesData;
  
  let output = `🚀 ${component.name} (${component.tagName || 'N/A'}) Examples\n`;
  output += `   Status: ${component.status} | Level: ${component.maturityLevel}\n\n`;
  
  if (examples.length === 0) {
    output += '   No examples available\n';
    return output;
  }
  
  output += `   Found ${examples.length} example${examples.length > 1 ? 's' : ''}:\n\n`;
  
  examples.forEach((example, index) => {
    output += `   ${index + 1}. ${example.title}\n`;
    output += `      ${example.description}\n`;
    output += `      Framework: ${example.framework}\n\n`;
    output += `      \`\`\`html\n`;
    output += `      ${example.code}\n`;
    output += `      \`\`\`\n\n`;
  });
  
  return output;
}

/**
 * Map error codes to appropriate exit codes
 */
function getExitCodeForError(errorCode) {
  const exitCodes = {
    [ErrorCodes.INVALID_INPUT]: 1,
    [ErrorCodes.INVALID_OPTIONS]: 1,
    [ErrorCodes.INVALID_URL]: 1,
    [ErrorCodes.INVALID_TIMEOUT]: 1,
    [ErrorCodes.NETWORK_ERROR]: 3,
    [ErrorCodes.TIMEOUT]: 4,
    [ErrorCodes.FETCH_ERROR]: 3,
    [ErrorCodes.NO_COMPONENTS_FOUND]: 5,
    [ErrorCodes.SEARCH_ERROR]: 6,
    [ErrorCodes.FILTER_ERROR]: 6,
    [ErrorCodes.VALIDATION_ERROR]: 7,
    [ErrorCodes.LINT_ERROR]: 8,
    [ErrorCodes.PROPERTIES_ERROR]: 9,
    [ErrorCodes.EXAMPLES_ERROR]: 10
  };
  
  return exitCodes[errorCode] || 2; // Default to 2 for unknown errors
}

/**
 * Parse CLI options and return validated configuration
 */
function parseOptions(args) {
  const options = {};
  
  // Parse timeout
  const timeoutIndex = args.findIndex(arg => arg === '--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    const timeoutValue = parseInt(args[timeoutIndex + 1], 10);
    if (isNaN(timeoutValue) || timeoutValue < 1000 || timeoutValue > 300000) {
      throw new VAComponentError('Timeout must be between 1000ms and 300000ms', ErrorCodes.INVALID_TIMEOUT);
    }
    options.requestTimeout = timeoutValue;
    // Remove timeout args from the array
    args.splice(timeoutIndex, 2);
  }
  
  // Use environment variable as fallback
  if (!options.requestTimeout && process.env.VA_MONITOR_TIMEOUT) {
    const envTimeout = parseInt(process.env.VA_MONITOR_TIMEOUT, 10);
    if (!isNaN(envTimeout) && envTimeout >= 1000 && envTimeout <= 300000) {
      options.requestTimeout = envTimeout;
    }
  }
  
  return options;
}

/**
 * Main CLI execution with graceful shutdown and comprehensive error handling
 */
async function main() {
  try {
    setupGracefulShutdown();
    
    const args = process.argv.slice(2);
    
    // Handle help and version first
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
      showHelp();
      process.exit(0);
    }
    
    if (args.includes('--version') || args.includes('-v')) {
      console.log(packageJson.version);
      process.exit(0);
    }
    
    // Parse and validate options
    const options = parseOptions([...args]); // Pass a copy since parseOptions modifies the array
    
    // Filter out options from args
    const filteredArgs = args.filter(arg => 
      !arg.startsWith('--') && 
      !arg.startsWith('-') &&
      !['quiet', 'q', 'verbose', 'vv', 'json'].includes(arg)
    );
    
    const command = sanitizeInput(filteredArgs[0]);
    const jsonOutput = args.includes('--json');
    
    if (!command) {
      throw new VAComponentError('No command specified', ErrorCodes.INVALID_INPUT);
    }
    
    logger.info(`Executing command: ${command}`);
    
    // Execute commands with timeout protection
    const executionTimeout = options.requestTimeout || 30000; // 30 second default for CLI operations
    const executionPromise = executeCommand(command, filteredArgs, jsonOutput, options);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new VAComponentError(`Command execution timeout after ${executionTimeout}ms`, ErrorCodes.TIMEOUT));
      }, executionTimeout);
    });
    
    await Promise.race([executionPromise, timeoutPromise]);
    
    logger.success('Command completed successfully');
    
  } catch (error) {
    // Handle errors with appropriate logging and exit codes
    if (error instanceof VAComponentError) {
      logger.error(`${error.message}`, error.code);
      if (isVerbose && error.details) {
        console.error('Error details:', JSON.stringify(error.details, null, 2));
      }
      
      // Use specific exit codes for different error types
      const exitCode = getExitCodeForError(error.code);
      
      if (jsonOutput) {
        console.log(JSON.stringify({ 
          error: error.message,
          code: error.code,
          timestamp: error.timestamp
        }, null, 2));
      }
      
      process.exit(exitCode);
    } else {
      // Unexpected error
      logger.error(`Unexpected error: ${error.message}`, 'UNEXPECTED_ERROR');
      if (isVerbose) {
        console.error('Stack trace:', error.stack);
      }
      
      if (jsonOutput) {
        console.log(JSON.stringify({ 
          error: 'An unexpected error occurred',
          details: isVerbose ? error.message : 'Run with --verbose for details'
        }, null, 2));
      }
      
      process.exit(2);
    }
  }
}

/**
 * Execute the actual command logic
 */
async function executeCommand(command, filteredArgs, jsonOutput, options) {
  switch (command) {
    case 'check': {
      if (filteredArgs.length < 2) {
        throw new VAComponentError('Component name required for check command', ErrorCodes.INVALID_INPUT);
      }
      
      const componentName = sanitizeInput(filteredArgs[1]);
      if (!componentName) {
        throw new VAComponentError('Invalid component name provided', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Checking component: ${componentName}`);
      const component = await checkComponent(componentName, options);
      
      if (!component) {
        throw new VAComponentError(`Component "${componentName}" not found`, ErrorCodes.SEARCH_ERROR);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(component, null, 2));
      } else {
        console.log(formatComponent(component));
      }
      break;
    }
    
    case 'props': {
      if (filteredArgs.length < 2) {
        throw new VAComponentError('Component name required for props command', ErrorCodes.INVALID_INPUT);
      }
      
      const componentName = sanitizeInput(filteredArgs[1]);
      if (!componentName) {
        throw new VAComponentError('Invalid component name provided', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Getting properties for: ${componentName}`);
      const propertiesData = await getComponentProperties(componentName, options);
      
      if (!propertiesData) {
        throw new VAComponentError(`Component "${componentName}" not found`, ErrorCodes.SEARCH_ERROR);
      }
      
      if (jsonOutput) {
        console.log(JSON.stringify(propertiesData, null, 2));
      } else {
        console.log(formatProperties(propertiesData));
      }
      break;
    }
    
    case 'examples': {
      if (filteredArgs.length < 2) {
        throw new VAComponentError('Component name required for examples command', ErrorCodes.INVALID_INPUT);
      }
      
      const componentName = sanitizeInput(filteredArgs[1]);
      if (!componentName) {
        throw new VAComponentError('Invalid component name provided', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Getting examples for: ${componentName}`);
      
      // Try to get official examples from Storybook first
      let examplesData = await getOfficialExamples(componentName, options);
      
      // Fallback to generated examples if no official ones found
      if (!examplesData || !examplesData.examples || examplesData.examples.length === 0) {
        logger.info('No official examples found, generating smart examples...');
        examplesData = await getComponentExamples(componentName, options);
      }
      
      if (!examplesData) {
        throw new VAComponentError(`Component "${componentName}" not found`, ErrorCodes.SEARCH_ERROR);
      }
      
      if (jsonOutput) {
        console.log(JSON.stringify(examplesData, null, 2));
      } else {
        console.log(formatExamples(examplesData));
      }
      break;
    }
    
    case 'validate': {
      if (filteredArgs.length < 2) {
        throw new VAComponentError('At least one component name required for validate command', ErrorCodes.INVALID_INPUT);
      }
      
      const componentNames = filteredArgs.slice(1).map(name => sanitizeInput(name)).filter(Boolean);
      if (componentNames.length === 0) {
        throw new VAComponentError('No valid component names provided', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Validating ${componentNames.length} components`);
      const result = await validateComponents(componentNames, options);
      
      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nValidation Results (${result.summary.found}/${result.summary.total} found):\n`);
        
        result.validation.forEach(item => {
          if (item.found) {
            console.log(`✅ ${item.requested}: ${formatComponent(item.component).split('\n')[0]}`);
          } else {
            console.log(`❌ ${item.requested}: Not found`);
          }
        });
        
        console.log(`\nSummary:`);
        console.log(`  Recommended: ${result.summary.recommended}`);
        console.log(`  Caution: ${result.summary.caution}`);
        console.log(`  Not found: ${result.summary.notFound}`);
      }
      break;
    }
    
    case 'lint': {
      if (filteredArgs.length < 2) {
        throw new VAComponentError('At least one component name required for lint command', ErrorCodes.INVALID_INPUT);
      }
      
      const componentNames = filteredArgs.slice(1).map(name => sanitizeInput(name)).filter(Boolean);
      if (componentNames.length === 0) {
        throw new VAComponentError('No valid component names provided', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Linting ${componentNames.length} components`);
      const result = await lintComponents(componentNames, options);
      
      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.issues.length === 0) {
          console.log('✅ No issues found!');
        } else {
          console.log(`\nFound ${result.issues.length} issue(s):\n`);
          
          result.issues.forEach(issue => {
            const icon = {
              'error': '❌',
              'warning': '⚠️',
              'info': 'ℹ️'
            };
            
            console.log(`${icon[issue.severity]} ${issue.component}: ${issue.message}`);
          });
        }
        
        if (result.hasErrors) {
          throw new VAComponentError('Linting found errors', ErrorCodes.LINT_ERROR);
        }
      }
      break;
    }
    
    case 'list': {
      const monitor = new VAComponentMonitor(options);
      const filter = filteredArgs[1] ? sanitizeInput(filteredArgs[1]) : null;
      let components;
      
      if (filter) {
        const statusMap = {
          'recommended': 'RECOMMENDED',
          'stable': 'STABLE', 
          'experimental': 'EXPERIMENTAL',
          'caution': 'USE_WITH_CAUTION',
          'issues': 'AVAILABLE_WITH_ISSUES'
        };
        
        if (filter === 'caution') {
          components = await monitor.getCautionComponents();
        } else if (statusMap[filter]) {
          components = await monitor.getComponentsByStatus(statusMap[filter]);
        } else {
          throw new VAComponentError(`Unknown filter: ${filter}. Available: recommended, stable, experimental, caution, issues`, ErrorCodes.INVALID_INPUT);
        }
      } else {
        const allComponents = await monitor.getComponents();
        components = Array.from(allComponents.values());
      }
      
      if (jsonOutput) {
        console.log(JSON.stringify(components, null, 2));
      } else {
        console.log(`\nFound ${components.length} component(s):\n`);
        components.forEach(component => {
          console.log(formatComponent(component));
          console.log('');
        });
      }
      break;
    }
    
    case 'report': {
      const monitor = new VAComponentMonitor(options);
      logger.info('Generating component report');
      const report = await monitor.generateReport();
      
      if (jsonOutput) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`\nVA Component Library Report`);
        console.log(`Generated: ${report.lastUpdated}\n`);
        
        console.log(`Total Components: ${report.total}\n`);
        
        console.log('Status Distribution:');
        Object.entries(report.statusCounts).forEach(([status, count]) => {
          const percentage = ((count / report.total) * 100).toFixed(1);
          console.log(`  ${status}: ${count} (${percentage}%)`);
        });
        
        console.log('\nCategory Distribution:');
        Object.entries(report.categoryCounts).forEach(([category, count]) => {
          const percentage = ((count / report.total) * 100).toFixed(1);
          console.log(`  ${category}: ${count} (${percentage}%)`);
        });
        
        console.log(`\nRecommended Components: ${report.recommended.length}`);
        console.log(`Components needing caution: ${report.caution.length}`);
      }
      break;
    }
    
    case 'quick': {
      if (filteredArgs.length < 3) {
        throw new VAComponentError('Quick command requires: quick <component> <cmd1> [cmd2] ...', ErrorCodes.INVALID_INPUT);
      }
      
      const componentName = sanitizeInput(filteredArgs[1]);
      const commands = filteredArgs.slice(2).map(cmd => sanitizeInput(cmd)).filter(Boolean);
      
      if (!componentName || commands.length === 0) {
        throw new VAComponentError('Invalid quick command format', ErrorCodes.INVALID_INPUT);
      }
      
      logger.info(`Running quick commands for ${componentName}: ${commands.join(', ')}`);
      
      // Run each command in sequence
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 Running: ${cmd} ${componentName} (${i + 1}/${commands.length})`);
        console.log(`${'='.repeat(50)}\n`);
        
        // Create a new args array for this sub-command
        const subArgs = [cmd, componentName];
        await executeCommand(cmd, subArgs, jsonOutput, options);
        
        // Add spacing between commands (except for the last one)
        if (i < commands.length - 1) {
          console.log('\n');
        }
      }
      
      break;
    }
    
    default:
      throw new VAComponentError(`Unknown command: ${command}`, ErrorCodes.INVALID_INPUT);
  }
}

// Initialize and run
main().catch(error => {
  // Final catch-all error handler
  console.error('Fatal error:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});