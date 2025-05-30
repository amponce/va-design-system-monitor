# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in VA Design System Monitor, please report it responsibly:

### For Security Issues:
- **Do NOT** create a public GitHub issue
- Create a security advisory on GitHub: https://github.com/amponce/va-design-system-monitor/security
- Include detailed steps to reproduce
- Provide impact assessment

### For General Issues:
- Create a GitHub issue for non-security bugs
- Use discussions for questions

## Security Considerations

### Network Access
This tool makes HTTP requests to:
- `https://raw.githubusercontent.com/department-of-veterans-affairs/component-library/` (TypeScript definitions)
- `https://raw.githubusercontent.com/department-of-veterans-affairs/component-library/` (Storybook examples)

### Authentication
- Optional GitHub token for rate limit increases
- No other authentication required

### Data Handling
- No user data is collected or stored
- Component definitions are cached temporarily in memory
- No sensitive information is transmitted

## Dependencies

We regularly monitor and update dependencies for security vulnerabilities. Key dependencies:
- `@modelcontextprotocol/sdk` - MCP service protocol
- `node-fetch` - HTTP requests (Node 14.x compatibility)

## Best Practices

When using this tool:
1. Keep the package updated to the latest version
2. Use environment variables for GitHub tokens (never hardcode)
3. Run in secure environments for production usage
4. Review examples before implementing in production code 