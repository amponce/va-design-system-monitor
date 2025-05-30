#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { VAComponentMonitor, getOfficialExamples } from '../lib/index.js';

/**
 * VA Design System Monitor MCP Service
 * 
 * This service monitors the VA Design System component library to:
 * - Track component maturity levels and categories
 * - Identify deprecated or problematic components
 * - Provide recommendations for component usage
 * - Alert about component status changes
 * - Fetch real examples from official VA Storybook
 */

// Initialize the VA Design System Monitor
const monitor = new VAComponentMonitor();

const server = new Server(
  {
    name: 'va-design-system-monitor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  {
    name: 'get_component_status',
    description: 'Get the status and maturity information for a specific VA component',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'Component name, tag name (e.g., va-button), or interface name (e.g., VaButton)',
        },
      },
      required: ['component'],
    },
  },
  {
    name: 'list_recommended_components',
    description: 'List all VA components with best_practice maturity level (recommended for production)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_caution_components',
    description: 'List all VA components that should be used with caution (experimental, candidate, or caution category)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_components_by_status',
    description: 'Get all components with a specific status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['RECOMMENDED', 'STABLE', 'EXPERIMENTAL', 'AVAILABLE_WITH_ISSUES', 'USE_WITH_CAUTION', 'UNKNOWN'],
          description: 'The component status to filter by',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'generate_component_report',
    description: 'Generate a comprehensive report of all VA components and their maturity status',
    inputSchema: {
      type: 'object',
      properties: {
        forceRefresh: {
          type: 'boolean',
          description: 'Force refresh of component data from remote source',
          default: false,
        },
      },
    },
  },
  {
    name: 'validate_components_in_code',
    description: 'Validate a list of component names against current VA component library status',
    inputSchema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of component names to validate',
        },
      },
      required: ['components'],
    },
  },
  {
    name: 'lintComponents',
    description: 'Lint a list of component names',
    inputSchema: {
      type: 'object',
      properties: {
        componentNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of component names to lint',
        },
      },
      required: ['componentNames'],
    },
  },
  {
    name: 'getComponentProperties',
    description: 'Get the properties of a specific VA component',
    inputSchema: {
      type: 'object',
      properties: {
        componentName: {
          type: 'string',
          description: 'The name of the component',
        },
      },
      required: ['componentName'],
    },
  },
  {
    name: 'getComponentExamples',
    description: 'Generate example implementations for a specific VA component',
    inputSchema: {
      type: 'object',
      properties: {
        componentName: {
          type: 'string',
          description: 'The name of the component to generate examples for',
        },
      },
      required: ['componentName'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_component_status': {
        const component = await monitor.getComponentByName(args.component);
        if (!component) {
          return {
            content: [
              {
                type: 'text',
                text: `Component "${args.component}" not found in VA Design System.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                name: component.name,
                tagName: component.tagName,
                status: component.status,
                maturityCategory: component.maturityCategory,
                maturityLevel: component.maturityLevel,
                recommendation: component.recommendation,
                guidanceHref: component.guidanceHref,
                translations: component.translations,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_recommended_components': {
        const recommended = await monitor.getRecommendedComponents();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: recommended.length,
                components: recommended.map(c => ({
                  name: c.name,
                  tagName: c.tagName,
                  recommendation: c.recommendation,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'list_caution_components': {
        const caution = await monitor.getCautionComponents();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: caution.length,
                components: caution.map(c => ({
                  name: c.name,
                  tagName: c.tagName,
                  status: c.status,
                  maturityCategory: c.maturityCategory,
                  maturityLevel: c.maturityLevel,
                  recommendation: c.recommendation,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_components_by_status': {
        const components = await monitor.getComponentsByStatus(args.status);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: args.status,
                count: components.length,
                components: components.map(c => ({
                  name: c.name,
                  tagName: c.tagName,
                  maturityLevel: c.maturityLevel,
                  recommendation: c.recommendation,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'generate_component_report': {
        const report = await monitor.generateReport();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case 'validate_components_in_code': {
        const results = [];
        for (const componentName of args.components) {
          const component = await monitor.getComponentByName(componentName);
          results.push({
            requested: componentName,
            found: !!component,
            component: component ? {
              name: component.name,
              tagName: component.tagName,
              status: component.status,
              recommendation: component.recommendation,
            } : null,
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                validation: results,
                summary: {
                  total: results.length,
                  found: results.filter(r => r.found).length,
                  notFound: results.filter(r => !r.found).length,
                  recommended: results.filter(r => r.component?.status === 'RECOMMENDED').length,
                  caution: results.filter(r => r.component && ['USE_WITH_CAUTION', 'EXPERIMENTAL', 'AVAILABLE_WITH_ISSUES'].includes(r.component.status)).length,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'lintComponents': {
        const lintResults = await monitor.lintComponents(args.componentNames);
        return { content: [{ type: "text", text: JSON.stringify(lintResults, null, 2) }] };
      }

      case 'getComponentProperties': {
        const propsData = await monitor.getComponentProperties(args.componentName);
        if (!propsData) {
          return { content: [{ type: "text", text: `Component "${args.componentName}" not found` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(propsData, null, 2) }] };
      }

      case 'getComponentExamples': {
        // Try to get official examples from Storybook first
        let examplesData = await getOfficialExamples(args.componentName);
        
        // Fallback to generated examples if no official ones found
        if (!examplesData || !examplesData.examples || examplesData.examples.length === 0) {
          examplesData = await monitor.getComponentExamples(args.componentName);
        }
        
        if (!examplesData) {
          return { content: [{ type: "text", text: `Component "${args.componentName}" not found` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(examplesData, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('VA Design System Monitor MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 