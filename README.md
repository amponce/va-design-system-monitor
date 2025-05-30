# VA Design System Monitor
[![npm version](https://badge.fury.io/js/va-design-system-monitor.svg)](https://www.npmjs.com/package/va-design-system-monitor)
[![Downloads](https://img.shields.io/npm/dm/va-design-system-monitor.svg)](https://www.npmjs.com/package/va-design-system-monitor)

> **🚨 Breaking Changes in v2.0.0**: The binary command has changed from `va-component-monitor` to `va-design-system-monitor`, and MCP server name updated. See [Migration Guide](#migration-from-v1) below.

> **🚨 Breaking Changes in v2.0.0**: The binary command has changed from `va-component-monitor` to `va-design-system-monitor`, and MCP server name updated. See [Migration Guide](#migration-from-v1) below.

A comprehensive tool for monitoring VA Design System component status, maturity levels, and generating implementation examples. **Now with real examples fetched directly from VA's official Storybook!** Available as both an **npm package** and **MCP (Model Context Protocol) service** for AI integration.

## ✨ Key Features

- 🎯 **Real Official Examples**: Fetches actual HTML examples directly from VA's Storybook repository
- 📊 **Component Status Monitoring**: Track maturity levels and usage recommendations  
- 🔧 **Smart Fallbacks**: Generates intelligent examples when official ones aren't available
- 🚀 **Multiple Interfaces**: CLI, programmatic API, and MCP service
- 🔒 **Production Ready**: Built for vets-website and va-application-template infrastructure
- 🌐 **Cross-Compatible**: Works with Node 14.15.0+ through Node 22+

## 🚀 Quick Start

### Option 1: NPM Package (Recommended)

Install globally for command-line access:

```bash
# Install globally
npm install -g va-design-system-monitor

# Get real examples from VA Storybook
va-components examples va-radio
va-components examples va-button

# Check component status and properties  
va-components check va-modal
va-components props va-accordion
va-components list recommended
```

Or install locally in your project:

```bash
# Install locally
npm install va-design-system-monitor

# Use with npx
npx va-components examples va-radio

# Or use programmatically
import { getOfficialExamples, checkComponent } from 'va-design-system-monitor';

// Get real examples from VA Storybook
const radioExamples = await getOfficialExamples('va-radio');
console.log(radioExamples.examples); // Real HTML from official stories!
```

### Option 2: Local Development

Clone and use with convenient npm scripts:

```bash
# Clone the repository
git clone <repository-url>
cd va-design-system-monitor

# Install dependencies  
npm install

# Quick setup for MCP (auto-configures Cursor & Claude Desktop)
npm run setup:npm        # For published package (recommended)
npm run setup:local      # For local development
npm run setup:manual     # Show manual config instructions
```

## 🎯 Super Easy MCP Setup

### Automatic Setup (Recommended)
```bash
# After cloning the repo, just run:
npm run setup:npm
# This auto-configures both Cursor and Claude Desktop!
```

### Manual MCP Configuration
If you prefer manual setup, add this to your MCP config:

**Cursor**:
- macOS/Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json` (location may vary by installation)

```json
{
  "servers": {
    "va-design-system-monitor": {
      "command": "npx",
      "args": ["-y", "va-design-system-monitor"],
      "env": {}
    }
  }
}
```

**Claude Desktop**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude-desktop/config.json`

macOS/Windows format:
```json
{
  "mcpServers": {
    "va-design-system-monitor": {
      "command": "npx",
      "args": ["-y", "va-design-system-monitor"],
      "env": {}
    }
  }
}
```

Linux format:
```json
{
  "mcp": {
    "servers": {
      "va-design-system-monitor": {
        "command": "npx",
        "args": ["-y", "va-design-system-monitor"],
        "env": {}
      }
    }
  }
}
```

## ⚡ Convenient NPM Scripts

### Setup & Server
```bash
npm run setup            # Auto-setup MCP (local development)
npm run setup:npm        # Auto-setup MCP (npm package)
npm run setup:manual     # Show manual setup instructions
npm run server           # Start MCP server
npm run mcp              # Alias for server
```

### Quick Commands (No arguments needed!)
```bash
npm run quick:button     # Check + examples for va-button
npm run quick:alert      # Check + examples for va-alert  
npm run quick:modal      # Check + examples for va-modal
```

### Component Checking
```bash
npm run check            # Check any component (you provide name)
npm run check:button     # Check va-button specifically
npm run check:alert      # Check va-alert specifically
npm run check:modal      # Check va-modal specifically
```

### Get Examples
```bash
npm run examples         # Examples for any component
npm run examples:button  # va-button examples
npm run examples:alert   # va-alert examples
```

### Lists & Reports
```bash
npm run list:recommended # List production-ready components
npm run list:caution     # List components needing caution
npm run report           # Full status report
```

### Development
```bash
npm run dev              # Start server with file watching
npm run dev:watch        # Alias for dev
npm run dev:cli          # CLI with file watching
```

## 📋 CLI Commands

### Component Status & Information
```bash
# Check component status and maturity
va-components check va-button

# Get all component properties/props
va-components props va-button

# Generate implementation examples
va-components examples va-button

# Validate multiple components
va-components validate va-button va-alert va-card

# Lint components for issues
va-components lint va-modal va-table
```

### Discovery & Reporting
```bash
# List components by status
va-components list recommended
va-components list caution
va-components list stable

# Generate comprehensive report
va-components report
va-components report --json
```

### JSON Output
Add `--json` to any command for programmatic use:
```bash
va-components check va-button --json
va-components examples va-alert --json
```

## 🔧 Programmatic API

### Basic Usage
```javascript
import { 
  checkComponent, 
  validateComponents, 
  getComponentProperties,
  getComponentExamples 
} from 'va-design-system-monitor';

// Check a single component
const button = await checkComponent('va-button');
console.log(button.status); // 'STABLE'

// Get component properties
const props = await getComponentProperties('va-button');
console.log(props.properties); // Array of property objects

// Generate examples
const examples = await getComponentExamples('va-button');
console.log(examples.examples); // Array of implementation examples

// Validate multiple components
const results = await validateComponents(['va-button', 'va-alert']);
console.log(results.summary); // Validation summary
```

### Advanced Usage
```javascript
import { VAComponentMonitor } from 'va-design-system-monitor';

const monitor = new VAComponentMonitor({
  cacheTimeout: 10 * 60 * 1000, // 10 minutes
  definitionsUrl: 'custom-url' // Optional custom URL
});

// Get all components
const components = await monitor.getComponents();

// Generate report
const report = await monitor.generateReport();

// Check production readiness
const isReady = await monitor.isProductionReady('va-button');
```

## 🤖 MCP Service (AI Integration)

When running as an MCP service, the following tools are available:

### Available Tools

- **`get_component_status`** - Get status and maturity for a component
- **`getComponentProperties`** - Get component properties/props
- **`getComponentExamples`** - Generate implementation examples
- **`list_recommended_components`** - List production-ready components
- **`list_caution_components`** - List components needing caution
- **`get_components_by_status`** - Filter components by status
- **`validate_components_in_code`** - Validate component lists
- **`generate_component_report`** - Comprehensive status report

### AI Usage Examples

Ask your AI assistant:
- "Show me the properties of va-button"
- "Generate examples for va-alert component" 
- "Which VA components are recommended for production?"
- "Validate these components: va-button, va-modal, va-card"

## 🎯 Example Outputs

### Component Status
```json
{
  "name": "Button",
  "tagName": "va-button", 
  "status": "STABLE",
  "maturityLevel": "deployed",
  "recommendation": "Safe for production use - actively deployed"
}
```

### Component Properties
```json
{
  "component": {
    "name": "Button",
    "tagName": "va-button",
    "status": "STABLE"
  },
  "properties": [
    {
      "name": "text",
      "type": "string",
      "optional": true,
      "description": "The text displayed on the button"
    },
    {
      "name": "disabled",
      "type": "boolean", 
      "optional": true,
      "description": "If true, the click event will not fire"
    }
  ]
}
```

### Implementation Examples
```json
{
  "component": {
    "name": "Button",
    "tagName": "va-button",
    "status": "STABLE"
  },
  "examples": [
    {
      "title": "Basic Usage",
      "description": "Simple example showing essential action functionality",
      "code": "<va-button text=\"Submit Application\"></va-button>",
      "framework": "HTML/Web Components"
    },
    {
      "title": "Accessibility Enhanced", 
      "description": "Example with enhanced screen reader support",
      "code": "<va-button text=\"Submit Application\" label=\"Submit your disability benefits application\"></va-button>",
      "framework": "HTML/Web Components"
    }
  ]
}
```

## 📦 Installation & Setup

### Global Installation
```bash
npm install -g va-design-system-monitor
```

### Local Project Installation
```bash
npm install va-design-system-monitor
```

### MCP Server Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd va-design-system-monitor
   npm install
   ```

2. **Configure MCP in Cursor**:
   - macOS/Linux: `~/.cursor/mcp.json`
   - Windows: `%USERPROFILE%\.cursor\mcp.json` (location may vary by installation)
   
   ```json
   {
     "servers": {
       "va-design-system-monitor": {
         "command": "npx",
         "args": ["-y", "va-design-system-monitor"],
         "env": {}
       }
     }
   }
   ```

3. **Configure MCP in Claude Desktop**:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/claude-desktop/config.json`

   macOS/Windows format:
   ```json
   {
     "mcpServers": {
       "va-design-system-monitor": {
         "command": "npx",
         "args": ["-y", "va-design-system-monitor"],
         "env": {}
       }
     }
   }
   ```
   
   Linux format:
   ```json
   {
     "mcp": {
       "servers": {
         "va-design-system-monitor": {
           "command": "npx",
           "args": ["-y", "va-design-system-monitor"],
           "env": {}
         }
       }
     }
   }
   ```

4. **Test the connection:**
   ```bash
   # Run the MCP server directly
   node bin/mcp-server.js
   ```

## 🔍 Component Status Levels

- **RECOMMENDED** - Best practice, production-ready
- **STABLE** - Safe for production use
- **EXPERIMENTAL** - Use in development/testing only  
- **AVAILABLE_WITH_ISSUES** - Available but may have issues
- **USE_WITH_CAUTION** - Known issues or under evaluation

## 🛠 Development

```bash
# Clone and install
git clone <repository-url>
cd va-design-system-monitor
npm install

# Run CLI locally
node bin/cli.js check va-button

# Run MCP server locally  
node bin/mcp-server.js

# Run tests
npm test
```
## 🤝 Contributing

We welcome contributions from the VA developer community! Whether you're fixing bugs, adding features, or improving documentation, your help makes this tool better for everyone.

### 🚀 Quick Start for Contributors

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/va-design-system-monitor.git
cd va-design-system-monitor
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test them
npm run test
npm run dev  # Test the CLI locally

# Commit your changes
git add .
git commit -m "feat: add your feature description"

# Push and create a pull request
git push origin feature/your-feature-name
```

### 📋 How to Contribute

**🐛 Bug Reports**
- Use the [GitHub issue tracker](https://github.com/amponce/va-design-system-monitor/issues)
- Include steps to reproduce, expected behavior, and actual behavior
- Add relevant system info (Node version, OS, etc.)

**✨ Feature Requests**
- Open an issue with the "enhancement" label
- Describe the use case and expected functionality
- Include examples of how it would be used

**🔧 Code Contributions**
- Fork the repository and create a feature branch
- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting

### 🧪 Development Workflow

```bash
# Run tests
npm test

# Start development server with file watching
npm run dev

# Test CLI commands locally
node bin/cli.js check va-button

# Test MCP server locally
node bin/mcp-server.js

# Build for production
npm run build
```

### 📝 Code Style

- Use **TypeScript** for type safety
- Follow **ESLint** configuration
- Write **clear, descriptive commit messages**
- Add **JSDoc comments** for public APIs
- Include **tests** for new features

### 🎯 Areas We Need Help With

- **Component Coverage**: Adding support for more VA components
- **Framework Integration**: React, Vue, Angular examples
- **Performance**: Caching and optimization improvements
- **Documentation**: More examples and use cases
- **Testing**: Edge cases and integration tests

### 🔒 Security

If you discover security vulnerabilities, please report them privately by emailing the maintainers rather than opening public issues.

### 📜 Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/). Please be respectful and inclusive in all interactions.

### 🏆 Recognition

Contributors will be recognized in our README and release notes. Thank you for helping improve VA development tooling!

---

**Questions?** Feel free to open an issue or reach out to the maintainers. We're here to help!
## 📝 License

MIT License - see LICENSE file for details. 
