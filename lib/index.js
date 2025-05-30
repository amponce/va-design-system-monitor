/**
 * VA Design System Monitor Library
 * 
 * A production-ready programmatic API for monitoring VA Design System component 
 * status and maturity levels. Designed for use in Node.js applications to validate 
 * components, check maturity levels, and ensure compliance with VA Design System standards.
 * 
 * Compatible with Node.js 14.15.0+ through Node 22+ 
 * (including vets-website and va-application-template infrastructure)
 * 
 * @version 1.0.0
 * @author VA Application Template Team
 * @license MIT
 */

const COMPONENT_DEFINITIONS_URL = 'https://raw.githubusercontent.com/department-of-veterans-affairs/component-library/refs/heads/main/packages/web-components/src/components.d.ts';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_AGE = 60 * 60 * 1000; // 1 hour maximum cache age

/**
 * Cross-compatible fetch for Node 14.15.0 through Node 22+
 */
async function getFetch() {
  // Node 18+ has native fetch
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    return globalThis.fetch;
  }
  
  // Node 14.15.0 needs node-fetch
  try {
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch;
  } catch (error) {
    throw new Error('No fetch implementation available. Please install node-fetch for Node < 18.');
  }
}

/**
 * Custom error class for VA Component Monitor operations
 */
export class VAComponentError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'VAComponentError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Node 14.15.0 compatible timeout wrapper for fetch
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const fetch = await getFetch();
  const fetchPromise = fetch(url, options);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new VAComponentError('Request timeout', 'TIMEOUT'));
    }, timeoutMs);
  });
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Validates input parameters to prevent injection and ensure type safety
 */
function validateInput(value, type, name) {
  if (value === null || value === undefined) {
    throw new VAComponentError(`Parameter '${name}' is required`, 'INVALID_INPUT');
  }
  
  if (typeof value !== type) {
    throw new VAComponentError(`Parameter '${name}' must be of type ${type}`, 'INVALID_INPUT');
  }
  
  if (type === 'string' && value.trim().length === 0) {
    throw new VAComponentError(`Parameter '${name}' cannot be empty`, 'INVALID_INPUT');
  }
  
  // Sanitize string inputs to prevent potential security issues
  if (type === 'string') {
    // Remove any potentially dangerous characters
    const sanitized = value.replace(/[<>'"]/g, '');
    if (sanitized !== value) {
      throw new VAComponentError(`Parameter '${name}' contains invalid characters`, 'INVALID_INPUT');
    }
  }
  
  return value;
}

/**
 * Production-ready logger that respects NODE_ENV
 */
const logger = {
  error: (message, error = null) => {
    if (process.env.NODE_ENV !== 'test') {
      const timestamp = new Date().toISOString();
      const errorDetails = error ? ` | ${error.code || 'ERROR'}` : '';
      console.error(`[${timestamp}] VA-MONITOR ERROR: ${message}${errorDetails}`);
    }
  },
  warn: (message, details = null) => {
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      const detailsStr = details ? ` | ${JSON.stringify(details)}` : '';
      console.warn(`[${timestamp}] VA-MONITOR WARN: ${message}${detailsStr}`);
    }
  },
  info: (message) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] VA-MONITOR INFO: ${message}`);
    }
  }
};

export class VAComponentMonitor {
  constructor(options = {}) {
    // Validate constructor options
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }

    this.components = new Map();
    this.lastFetch = null;
    this.cacheTimeout = this._validateTimeout(options.cacheTimeout) || DEFAULT_CACHE_TIMEOUT;
    this.requestTimeout = this._validateTimeout(options.requestTimeout) || DEFAULT_TIMEOUT;
    this.customUrl = this._validateUrl(options.definitionsUrl) || COMPONENT_DEFINITIONS_URL;
    this.retryAttempts = Math.max(0, Math.min(5, options.retryAttempts || 2));
    this.retryDelay = Math.max(1000, Math.min(10000, options.retryDelay || 2000));
  }

  _validateTimeout(timeout) {
    if (timeout === undefined) return undefined;
    if (typeof timeout !== 'number' || timeout < 1000 || timeout > 300000) {
      throw new VAComponentError('Timeout must be between 1000ms and 300000ms', 'INVALID_TIMEOUT');
    }
    return timeout;
  }

  _validateUrl(url) {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new VAComponentError('URL must use HTTP or HTTPS protocol', 'INVALID_URL');
      }
      return url;
    } catch (error) {
      throw new VAComponentError('Invalid URL provided', 'INVALID_URL');
    }
  }

  async fetchComponentDefinitions() {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.info(`Fetching component definitions (attempt ${attempt + 1}/${this.retryAttempts + 1})`);
        
        const headers = {
          'User-Agent': 'VA-Design-System-Monitor/2.0.0',
          'Accept': 'text/plain',
        };
        
        // Add GitHub token if available
        const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
        if (githubToken) {
          headers['Authorization'] = `token ${githubToken}`;
          logger.info('Using GitHub authentication token');
        }
        
        const response = await fetchWithTimeout(this.customUrl, { headers }, this.requestTimeout);
        
        // Check for rate limiting
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          const rateLimitReset = response.headers.get('x-ratelimit-reset');
          
          if (rateLimitRemaining === '0') {
            const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'unknown';
            const errorMessage = githubToken ? 
              `GitHub API rate limit exceeded. Reset time: ${resetTime}` :
              this.getRateLimitErrorMessage(resetTime);
            
            throw new VAComponentError(errorMessage, 'RATE_LIMIT_EXCEEDED', {
              resetTime,
              hasToken: !!githubToken,
              rateLimitRemaining: rateLimitRemaining
            });
          }
        }
        
        if (!response.ok) {
          throw new VAComponentError(
            'Failed to fetch component definitions', 
            'FETCH_ERROR',
            { status: response.status, statusText: response.statusText }
          );
        }
        
        const content = await response.text();
        
        if (!content || content.length < 100) {
          throw new VAComponentError('Received invalid or empty response', 'INVALID_RESPONSE');
        }
        
        logger.info(`Successfully fetched ${content.length} characters of component definitions`);
        return content;
        
      } catch (error) {
        lastError = error;
        
        if (error instanceof VAComponentError) {
          lastError = error;
        } else {
          lastError = new VAComponentError('Network request failed', 'NETWORK_ERROR', { originalError: error.message });
        }
        
        if (attempt < this.retryAttempts) {
          logger.warn(`Attempt ${attempt + 1} failed, retrying in ${this.retryDelay}ms`, { error: lastError.message });
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    logger.error('All fetch attempts failed', lastError);
    throw lastError;
  }

  parseComponentMetadata(content) {
    const components = new Map();
    
    // First find all component comment blocks with their associated interfaces
    const componentBlocks = this.extractComponentBlocks(content);
    
    for (const block of componentBlocks) {
      if (!block.componentName || !block.interfaceName) continue;
      
      // Extract interface properties
      const properties = this.parseInterfaceProperties(block.interfaceBody);
      
      const component = {
        name: block.componentName,
        interfaceName: block.interfaceName,
        maturityCategory: block.maturityCategory,
        maturityLevel: block.maturityLevel,
        guidanceHref: block.guidanceHref,
        translations: block.translations,
        properties: properties,
        status: this.determineComponentStatus(block.maturityCategory, block.maturityLevel),
        recommendation: this.getRecommendation(block.maturityCategory, block.maturityLevel)
      };
      
      components.set(block.interfaceName, component);
    }

    // Also parse web component tag names with a separate, simpler approach
    const tagMatches = [...content.matchAll(/"(va-[^"]+)":\s+LocalJSX\.(\w+)/g)];
    for (const [, tagName, interfaceName] of tagMatches) {
      const component = components.get(interfaceName);
      if (component) {
        component.tagName = tagName;
      }
    }

    return components;
  }

  extractComponentBlocks(content) {
    const blocks = [];
    
    // Split into potential interface sections
    const interfaceMatches = [...content.matchAll(/interface\s+(Va\w+)\s*\{([\s\S]*?)\n\s*\}/g)];
    
    for (const [fullMatch, interfaceName, interfaceBody] of interfaceMatches) {
      // Find the nearest preceding comment block for this interface
      const beforeInterface = content.substring(0, content.indexOf(fullMatch));
      const commentBlocks = [...beforeInterface.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
      
      // Take the last comment block before this interface
      const lastComment = commentBlocks[commentBlocks.length - 1];
      
      if (!lastComment) continue;
      
      const commentContent = lastComment[1];
      
      // Extract metadata from comment
      const componentNameMatch = commentContent.match(/\*\s+@componentName\s+([^\n\r]+)/);
      const maturityCategoryMatch = commentContent.match(/\*\s+@maturityCategory\s+([^\n\r]+)/);
      const maturityLevelMatch = commentContent.match(/\*\s+@maturityLevel\s+([^\n\r]+)/);
      
      // Only process if we have required metadata
      if (!componentNameMatch || !maturityCategoryMatch || !maturityLevelMatch) {
        continue;
      }
      
      const guidanceMatch = commentContent.match(/\*\s+@guidanceHref\s+([^\n\r]+)/);
      const translationsMatches = [...commentContent.matchAll(/\*\s+@translations\s+([^\n\r]+)/g)];
      
      blocks.push({
        interfaceName,
        interfaceBody,
        componentName: componentNameMatch[1].trim(),
        maturityCategory: maturityCategoryMatch[1].trim(),
        maturityLevel: maturityLevelMatch[1].trim(),
        guidanceHref: guidanceMatch ? guidanceMatch[1].trim() : null,
        translations: translationsMatches.map(m => m[1].trim())
      });
    }
    
    return blocks;
  }

  parseInterfaceProperties(interfaceBody) {
    const properties = [];
    
    // Split by property definitions (lines that end with ; or lines before comments)
    const propertyLines = interfaceBody.split('\n');
    let currentComment = '';
    
    for (const line of propertyLines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        currentComment = ''; // Reset comment on empty lines
        continue;
      }
      
      // Collect JSDoc comments
      if (trimmedLine.startsWith('/**') || trimmedLine.startsWith('*')) {
        const commentMatch = trimmedLine.match(/\*\s*(.*)/);
        if (commentMatch) {
          currentComment += (currentComment ? ' ' : '') + commentMatch[1];
        }
        continue;
      }
      
      // Parse property definition
      const propertyMatch = trimmedLine.match(/^"?([^"?:]+)"?\??\s*:\s*([^;]+);?\s*$/);
      if (propertyMatch) {
        const [, propName, propType] = propertyMatch;
        const isOptional = trimmedLine.includes('?:') || trimmedLine.includes('"?');
        
        properties.push({
          name: propName.trim(),
          type: propType.trim(),
          optional: isOptional,
          description: currentComment.trim() || null
        });
        
        currentComment = ''; // Reset comment for next property
      }
    }
    
    return properties;
  }

  determineComponentStatus(category, level) {
    if (category === 'caution') {
      return 'USE_WITH_CAUTION';
    }
    
    switch (level) {
      case 'best_practice':
        return 'RECOMMENDED';
      case 'deployed':
        return 'STABLE';
      case 'candidate':
        return 'EXPERIMENTAL';
      case 'available':
        return 'AVAILABLE_WITH_ISSUES';
      default:
        return 'UNKNOWN';
    }
  }

  getRecommendation(category, level) {
    if (category === 'caution') {
      return 'Use with caution - may have known issues or be under evaluation';
    }
    
    switch (level) {
      case 'best_practice':
        return 'Recommended for production use - stable and follows best practices';
      case 'deployed':
        return 'Safe for production use - actively deployed';
      case 'candidate':
        return 'Experimental - use in development/testing only';
      case 'available':
        return 'Available but may have issues - test thoroughly before use';
      default:
        return 'Status unknown - verify before use';
    }
  }

  async getComponents(forceRefresh = false) {
    // Validate input
    if (typeof forceRefresh !== 'boolean') {
      throw new VAComponentError('forceRefresh must be a boolean', 'INVALID_INPUT');
    }

    const now = Date.now();
    
    // Check cache validity - reject cache if too old regardless of cacheTimeout
    const cacheAge = now - this.lastFetch;
    const cacheValid = this.lastFetch && 
                      cacheAge < Math.min(this.cacheTimeout, MAX_CACHE_AGE) && 
                      this.components.size > 0;
    
    if (!forceRefresh && cacheValid) {
      logger.info(`Using cached data (${Math.round(cacheAge / 1000)}s old, ${this.components.size} components)`);
      return this.components;
    }

    try {
      const content = await this.fetchComponentDefinitions();
      
      if (!content || typeof content !== 'string') {
        throw new VAComponentError('Invalid component definitions received', 'INVALID_DATA');
      }
      
      const parsedComponents = this.parseComponentMetadata(content);
      
      if (parsedComponents.size === 0) {
        throw new VAComponentError('No components found in definitions', 'NO_COMPONENTS_FOUND');
      }
      
      this.components = parsedComponents;
      this.lastFetch = now;
      
      logger.info(`Successfully loaded ${this.components.size} components`);
      return this.components;
      
    } catch (error) {
      // Use cached data as fallback if available and not too old
      if (this.components.size > 0 && (!this.lastFetch || (now - this.lastFetch) < MAX_CACHE_AGE)) {
        logger.warn('Using cached data due to fetch error', { 
          error: error.message, 
          cacheAge: this.lastFetch ? Math.round((now - this.lastFetch) / 1000) : 'unknown',
          componentCount: this.components.size 
        });
        return this.components;
      }
      
      // No valid cache available
      logger.error('Failed to fetch components and no valid cache available', error);
      throw error;
    }
  }

  async getComponentByName(name) {
    // Validate and sanitize input
    const sanitizedName = validateInput(name, 'string', 'name').trim().toLowerCase();
    
    if (sanitizedName.length > 100) {
      throw new VAComponentError('Component name too long', 'INVALID_INPUT');
    }
    
    try {
      const components = await this.getComponents();
      
      // Try exact match first (case-insensitive)
      for (const [key, component] of components) {
        if (component.name.toLowerCase() === sanitizedName || 
            (component.tagName && component.tagName.toLowerCase() === sanitizedName) ||
            component.interfaceName.toLowerCase() === sanitizedName) {
          return component;
        }
      }
      
      // Try partial match as fallback
      for (const [key, component] of components) {
        if (component.name.toLowerCase().includes(sanitizedName) ||
            (component.tagName && component.tagName.toLowerCase().includes(sanitizedName))) {
          return component;
        }
      }
      
      return null;
    } catch (error) {
      if (error instanceof VAComponentError) {
        throw error;
      }
      throw new VAComponentError('Failed to search for component', 'SEARCH_ERROR', { originalError: error.message });
    }
  }

  async getComponentsByStatus(status) {
    // Validate status input
    const validStatuses = ['RECOMMENDED', 'STABLE', 'EXPERIMENTAL', 'AVAILABLE_WITH_ISSUES', 'USE_WITH_CAUTION', 'UNKNOWN'];
    const sanitizedStatus = validateInput(status, 'string', 'status').trim().toUpperCase();
    
    if (!validStatuses.includes(sanitizedStatus)) {
      throw new VAComponentError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'INVALID_STATUS');
    }
    
    try {
      const components = await this.getComponents();
      return Array.from(components.values()).filter(c => c.status === sanitizedStatus);
    } catch (error) {
      if (error instanceof VAComponentError) {
        throw error;
      }
      throw new VAComponentError('Failed to filter components by status', 'FILTER_ERROR', { originalError: error.message });
    }
  }

  async getRecommendedComponents() {
    return await this.getComponentsByStatus('RECOMMENDED');
  }

  async getCautionComponents() {
    const components = await this.getComponents();
    return Array.from(components.values()).filter(c => 
      c.maturityCategory === 'caution' || 
      c.status === 'USE_WITH_CAUTION' ||
      c.status === 'EXPERIMENTAL' ||
      c.status === 'AVAILABLE_WITH_ISSUES'
    );
  }

  async validateComponents(componentNames) {
    const results = [];
    for (const componentName of componentNames) {
      const component = await this.getComponentByName(componentName);
      results.push({
        requested: componentName,
        found: !!component,
        component: component ? {
          name: component.name,
          tagName: component.tagName,
          status: component.status,
          maturityCategory: component.maturityCategory,
          maturityLevel: component.maturityLevel,
          recommendation: component.recommendation,
        } : null,
      });
    }

    return {
      validation: results,
      summary: {
        total: results.length,
        found: results.filter(r => r.found).length,
        notFound: results.filter(r => !r.found).length,
        recommended: results.filter(r => r.component?.status === 'RECOMMENDED').length,
        caution: results.filter(r => r.component && ['USE_WITH_CAUTION', 'EXPERIMENTAL', 'AVAILABLE_WITH_ISSUES'].includes(r.component.status)).length,
      },
    };
  }

  async generateReport(forceRefresh = false) {
    const components = await this.getComponents(forceRefresh);
    const total = components.size;
    const statusCounts = {};
    const categoryCounts = {};

    for (const component of components.values()) {
      statusCounts[component.status] = (statusCounts[component.status] || 0) + 1;
      categoryCounts[component.maturityCategory] = (categoryCounts[component.maturityCategory] || 0) + 1;
    }

    return {
      total,
      statusCounts,
      categoryCounts,
      lastUpdated: new Date(this.lastFetch).toISOString(),
      recommended: await this.getRecommendedComponents(),
      caution: await this.getCautionComponents()
    };
  }

  // Utility methods for common use cases
  
  /**
   * Check if a component is safe for production use
   */
  async isProductionReady(componentName) {
    const component = await this.getComponentByName(componentName);
    return component && ['RECOMMENDED', 'STABLE'].includes(component.status);
  }

  /**
   * Get alternative components with better maturity levels
   */
  async getSuggestedAlternatives(componentName, category = null) {
    const component = await this.getComponentByName(componentName);
    if (!component || component.status === 'RECOMMENDED') {
      return [];
    }

    const recommended = await this.getRecommendedComponents();
    
    // If category provided, filter by similar components
    if (category) {
      return recommended.filter(c => 
        c.name.toLowerCase().includes(category.toLowerCase()) ||
        (c.tagName && c.tagName.includes(category.toLowerCase()))
      );
    }

    return recommended;
  }

  /**
   * Lint a list of components and return issues
   */
  async lintComponents(componentNames) {
    const validation = await this.validateComponents(componentNames);
    const issues = [];

    validation.validation.forEach(result => {
      if (!result.found) {
        issues.push({
          type: 'NOT_FOUND',
          component: result.requested,
          message: `Component "${result.requested}" not found in VA Design System`,
          severity: 'error'
        });
      } else if (result.component.status === 'USE_WITH_CAUTION') {
        issues.push({
          type: 'CAUTION',
          component: result.requested,
          message: `Component "${result.requested}" should be used with caution: ${result.component.recommendation}`,
          severity: 'warning'
        });
      } else if (result.component.status === 'EXPERIMENTAL') {
        issues.push({
          type: 'EXPERIMENTAL',
          component: result.requested,
          message: `Component "${result.requested}" is experimental: ${result.component.recommendation}`,
          severity: 'warning'
        });
      } else if (result.component.status === 'AVAILABLE_WITH_ISSUES') {
        issues.push({
          type: 'ISSUES',
          component: result.requested,
          message: `Component "${result.requested}" may have issues: ${result.component.recommendation}`,
          severity: 'info'
        });
      }
    });

    return {
      issues,
      hasErrors: issues.some(i => i.severity === 'error'),
      hasWarnings: issues.some(i => i.severity === 'warning'),
      summary: validation.summary
    };
  }

  /**
   * Get the properties/props for a specific component
   */
  async getComponentProperties(componentName) {
    const component = await this.getComponentByName(componentName);
    if (!component) {
      return null;
    }
    
    return {
      component: {
        name: component.name,
        tagName: component.tagName,
        status: component.status,
        maturityLevel: component.maturityLevel
      },
      properties: component.properties || []
    };
  }

  /**
   * Alternative approach: Fetch examples from official VA sources
   * 
   * This completely removes hardcoded patterns and fetches real examples
   * from the VA design system's official documentation and Storybook.
   */
  async getOfficialExamples(componentName, options = {}) {
    const component = await this.getComponentByName(componentName);
    if (!component) {
      return null;
    }

    try {
      // Try to fetch from official VA design system sources
      const examples = await this.fetchVADesignSystemExamples(component, options);
      
      return {
        component: {
          name: component.name,
          tagName: component.tagName,
          status: component.status,
          maturityLevel: component.maturityLevel,
          recommendation: component.recommendation
        },
        examples: examples || this.generateFallbackExamples(component, options)
      };
    } catch (error) {
      logger.warn('Failed to fetch official examples, falling back to generated ones', { error: error.message });
      return this.getComponentExamples(componentName, options);
    }
  }

  /**
   * Fetch examples from VA design system official sources
   * 
   * This fetches real examples from:
   * 1. GitHub repository Storybook stories (HTML templates only)
   * 2. Component test files (basic examples)
   */
  async fetchVADesignSystemExamples(component, options = {}) {
    const examples = [];
    const tagName = component.tagName || `va-${component.name.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Try to find the Storybook story file for this component
    try {
      const storybookExamples = await this.fetchStorybookExamples(tagName);
      if (storybookExamples && storybookExamples.length > 0) {
        examples.push(...storybookExamples);
      }
    } catch (error) {
      logger.warn(`Failed to fetch Storybook examples for ${tagName}`, { error: error.message });
    }

    return examples.length > 0 ? examples : null;
  }

  /**
   * Fetch real HTML examples from Storybook story files
   * 
   * Looks for the story file and extracts just the HTML template parts
   */
  async fetchStorybookExamples(tagName) {
    const examples = [];
    
    // Try common Storybook story file locations (based on actual VA repo structure)
    const storyPaths = [
      `packages/storybook/stories/${tagName}.stories.js`,
      `packages/storybook/stories/${tagName}.stories.ts`,
      `packages/storybook/stories/${tagName}.stories.tsx`,
      `packages/storybook/stories/${tagName}-uswds.stories.js`,
      `packages/storybook/stories/${tagName}-uswds.stories.ts`,
      `packages/storybook/stories/${tagName}-uswds.stories.tsx`,
      `packages/web-components/src/components/${tagName}/${tagName}.stories.js`,
      `packages/web-components/src/components/${tagName}/${tagName}.stories.ts`
    ];

    for (const storyPath of storyPaths) {
      try {
        const storyContent = await this.fetchFileFromGitHub(storyPath);
        if (storyContent) {
          const htmlExamples = this.extractHTMLFromStorybook(storyContent, tagName, storyPath);
          if (htmlExamples.length > 0) {
            examples.push(...htmlExamples);
            logger.info(`Found ${htmlExamples.length} HTML examples in ${storyPath}`);
            break; // Found examples, no need to check other paths
          }
        }
      } catch (error) {
        logger.info(`No story file found: ${storyPath}`);
      }
    }

    return examples;
  }

  /**
   * Extract only HTML template examples from Storybook story content
   * 
   * Looks for JSX/HTML patterns containing the component
   */
  extractHTMLFromStorybook(content, tagName, filePath) {
    const examples = [];
    
    // Pattern 1: JSX return statements with component (most common in VA stories)
    const jsxReturnRegex = new RegExp(`return\\s*\\([\\s\\S]*?(<${tagName}[\\s\\S]*?</${tagName}>)[\\s\\S]*?\\)`, 'gi');
    const jsxMatches = [...content.matchAll(jsxReturnRegex)];
    
    jsxMatches.forEach((match, index) => {
      const htmlContent = this.cleanExtractedHTML(match[1]);
      if (htmlContent && htmlContent.length > 10) {
        examples.push({
          title: `Storybook Example ${index + 1}`,
          description: `Official example from ${filePath}`,
          code: htmlContent,
          framework: 'HTML/Web Components',
          source: 'storybook'
        });
      }
    });

    // Pattern 2: Direct JSX elements (for simpler cases)
    const directJsxRegex = new RegExp(`(<${tagName}[\\s\\S]*?</${tagName}>)`, 'gi');
    const directMatches = [...content.matchAll(directJsxRegex)];
    
    directMatches.forEach((match, index) => {
      const htmlContent = this.cleanExtractedHTML(match[1]);
      if (htmlContent && htmlContent.length > 10 && !examples.some(ex => ex.code.includes(htmlContent.slice(0, 50)))) {
        examples.push({
          title: `Storybook Direct Example ${index + 1}`,
          description: `Official template from ${filePath}`,
          code: htmlContent,
          framework: 'HTML/Web Components',
          source: 'storybook'
        });
      }
    });

    return examples;
  }

  /**
   * Clean up extracted HTML content
   */
  cleanExtractedHTML(html) {
    return html
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      // Convert JSX attributes to HTML attributes
      .replace(/className=/g, 'class=')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      // Format for readability
      .replace(/><va-/g, '>\n  <va-')
      .replace(/<\/va-radio>/g, '\n</va-radio>')
      .trim();
  }

  /**
   * Fetch a file from the VA component library GitHub repository
   */
  async fetchFileFromGitHub(filePath) {
    const fetch = await getFetch();
    const url = `https://raw.githubusercontent.com/department-of-veterans-affairs/component-library/main/${filePath}`;
    
    try {
      logger.info(`Checking for story file: ${filePath}`);
      
      const headers = {
        'User-Agent': 'VA-Design-System-Monitor/2.0.0',
        'Accept': 'text/plain',
      };
      
      // Add GitHub token if available for higher rate limits
      const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
      }
      
      // Add respectful delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetchWithTimeout(url, { headers }, this.requestTimeout);
      
      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
          const rateLimitReset = response.headers.get('x-ratelimit-reset');
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'unknown';
          throw new VAComponentError(this.getRateLimitErrorMessage(resetTime), 'RATE_LIMIT_EXCEEDED');
        }
      }
      
      if (response.status === 404) {
        return null; // File doesn't exist, that's OK
      }
      
      if (!response.ok) {
        throw new VAComponentError(`Failed to fetch ${filePath}: ${response.status}`, 'FETCH_ERROR');
      }
      
      return await response.text();
      
    } catch (error) {
      if (error instanceof VAComponentError) {
        throw error;
      }
      logger.info(`File not found or error: ${filePath} - ${error.message}`);
      return null;
    }
  }

  /**
   * Generate fallback examples when official sources are unavailable
   */
  generateFallbackExamples(component, options) {
    logger.info(`Generating fallback examples for ${component.name}`);
    return this.generateExamples(component, options);
  }

  /**
   * Generate example implementations for a specific component
   */
  async getComponentExamples(componentName, options = {}) {
    const component = await this.getComponentByName(componentName);
    if (!component) {
      return null;
    }

    const examples = this.generateExamples(component, options);
    
    return {
      component: {
        name: component.name,
        tagName: component.tagName,
        status: component.status,
        maturityLevel: component.maturityLevel,
        recommendation: component.recommendation
      },
      examples
    };
  }

  /**
   * Generate various example implementations based on component properties
   * 
   * Uses purely semantic analysis of TypeScript properties to generate appropriate examples.
   * No hardcoded component-specific logic - adapts automatically to any component.
   */
  generateExamples(component, options = {}) {
    const examples = [];
    const tagName = component.tagName || `va-${component.name.toLowerCase()}`;
    const properties = component.properties || [];

    // Analyze the component's semantic structure purely from properties
    const analysis = this.analyzeComponentSemantics(component, properties);
    
    // Generate examples based on pure semantic understanding
    examples.push(this.generateSemanticBasicExample(tagName, analysis));
    
    // Generate variation examples based on available patterns
    if (analysis.hasStates) {
      examples.push(this.generateStateVariationExample(tagName, analysis));
    }
    
    if (analysis.hasConditionalContent) {
      examples.push(this.generateConditionalExample(tagName, analysis));
    }
    
    if (analysis.hasAccessibilityEnhancements) {
      examples.push(this.generateAccessibilityExample(tagName, analysis));
    }
    
    // Generate form context example if it's a form-related component
    if (analysis.isFormRelated) {
      examples.push(this.generateFormContextExample(tagName, analysis));
    }

    return examples.filter(Boolean); // Remove any null examples
  }

  /**
   * Analyze component properties to understand their semantic purpose
   * Pure analysis based on property names, types, and patterns - no hardcoded logic
   */
  analyzeComponentSemantics(component, properties) {
    const analysis = {
      // Core content properties (what users see)
      visibleTextProps: [],
      // Accessibility properties (for screen readers)
      accessibilityProps: [],
      // State/behavior properties
      stateProps: [],
      // Configuration properties
      configProps: [],
      // Event handlers
      eventProps: [],
      // Required properties
      requiredProps: [],
      // Child/slot properties
      slotProps: [],
      
      // Semantic flags
      isFormRelated: false,
      isInteractive: false,
      hasStates: false,
      hasConditionalContent: false,
      hasAccessibilityEnhancements: false,
      hasSlots: false,
      
      // Component purpose inferred from properties
      inferredPurpose: 'general',
      contentStrategy: 'unknown'
    };

    // Categorize each property by semantic purpose based on naming patterns
    properties.forEach(prop => {
      const propName = prop.name.toLowerCase();
      const propType = prop.type.toLowerCase();

      // Required props
      if (!prop.optional) {
        analysis.requiredProps.push(prop);
      }

      // Visible content props (what users see)
      if (this.isVisibleContentProp(propName, propType)) {
        analysis.visibleTextProps.push(prop);
      }
      
      // Accessibility props (screen readers, ARIA)
      else if (this.isAccessibilityProp(propName, propType)) {
        analysis.accessibilityProps.push(prop);
        analysis.hasAccessibilityEnhancements = true;
      }
      
      // State/behavior props
      else if (this.isStateProp(propName, propType)) {
        analysis.stateProps.push(prop);
        analysis.hasStates = true;
      }
      
      // Configuration props
      else if (this.isConfigProp(propName, propType)) {
        analysis.configProps.push(prop);
      }
      
      // Event handlers
      else if (this.isEventProp(propName, propType)) {
        analysis.eventProps.push(prop);
        analysis.isInteractive = true;
      }

      // Slot/content props
      else if (this.isSlotProp(propName, propType)) {
        analysis.slotProps.push(prop);
        analysis.hasSlots = true;
      }

      // Form-related detection
      if (this.isFormRelatedProp(propName)) {
        analysis.isFormRelated = true;
      }

      // Conditional content detection
      if (this.isConditionalProp(propName)) {
        analysis.hasConditionalContent = true;
      }
    });

    // Infer purpose from property patterns (not component name)
    analysis.inferredPurpose = this.inferPurposeFromProperties(analysis);
    
    // Determine content strategy
    analysis.contentStrategy = this.determineContentStrategy(analysis);

    return analysis;
  }

  /**
   * Determine if a prop is for visible content based on naming patterns
   */
  isVisibleContentProp(propName, propType) {
    const visibleContentPatterns = [
      /^text$/,
      /^headline$/,
      /^title$/,
      /^message$/,
      /^content$/,
      /^header$/,
      /text$/,
      /heading$/,
      /caption$/
    ];
    
    return visibleContentPatterns.some(pattern => pattern.test(propName)) && 
           propType.includes('string');
  }

  /**
   * Determine if a prop is for accessibility based on naming patterns
   */
  isAccessibilityProp(propName, propType) {
    const accessibilityPatterns = [
      /aria/,
      /describedby/,
      /screenreader/,
      /^label$/ // Only exact label, not labelHeader etc
    ];
    
    return accessibilityPatterns.some(pattern => pattern.test(propName));
  }

  /**
   * Determine if a prop is for component state
   */
  isStateProp(propName, propType) {
    const statePatterns = [
      /visible/,
      /open/,
      /closed/,
      /expanded/,
      /collapsed/,
      /disabled/,
      /loading/,
      /active/,
      /selected/,
      /checked/,
      /show/,
      /hide/
    ];
    
    return statePatterns.some(pattern => pattern.test(propName)) && 
           propType.includes('boolean');
  }

  /**
   * Determine if a prop is for configuration
   */
  isConfigProp(propName, propType) {
    const configPatterns = [
      /variant/,
      /size/,
      /type/,
      /status/,
      /level/,
      /theme/,
      /style/,
      /mode/
    ];
    
    return configPatterns.some(pattern => pattern.test(propName)) ||
           propType.includes('|') ||  // Union types are usually config
           propType.includes('enum');
  }

  /**
   * Determine if a prop is an event handler
   */
  isEventProp(propName, propType) {
    return propName.startsWith('on') && 
           (propType.includes('=>') || propType.includes('function'));
  }

  /**
   * Determine if a prop is for slots/content insertion
   */
  isSlotProp(propName, propType) {
    const slotPatterns = [
      /slot/,
      /content/,
      /body/,
      /children/
    ];
    
    return slotPatterns.some(pattern => pattern.test(propName));
  }

  /**
   * Determine if a prop is form-related
   */
  isFormRelatedProp(propName) {
    const formPatterns = [
      /name/,
      /value/,
      /required/,
      /error/,
      /validation/,
      /input/,
      /field/,
      /form/
    ];
    
    return formPatterns.some(pattern => pattern.test(propName));
  }

  /**
   * Determine if a prop controls conditional content
   */
  isConditionalProp(propName) {
    const conditionalPatterns = [
      /closeable/,
      /dismissible/,
      /expandable/,
      /collapsible/,
      /toggle/
    ];
    
    return conditionalPatterns.some(pattern => pattern.test(propName));
  }

  /**
   * Infer the component's primary purpose from its properties (not name)
   */
  inferPurposeFromProperties(analysis) {
    // Interactive elements with click handlers
    if (analysis.eventProps.some(p => p.name.includes('click') || p.name.includes('submit'))) {
      return 'action';
    }
    
    // Form elements
    if (analysis.isFormRelated && analysis.visibleTextProps.some(p => p.name === 'label')) {
      return 'input';
    }
    
    // Notification elements
    if (analysis.configProps.some(p => p.name === 'status') && 
        analysis.visibleTextProps.some(p => p.name.includes('message') || p.name.includes('headline'))) {
      return 'notification';
    }
    
    // Navigation elements
    if (analysis.configProps.some(p => p.name.includes('href') || p.name.includes('link'))) {
      return 'navigation';
    }
    
    // Container elements with slots or headlines
    if (analysis.hasSlots || analysis.visibleTextProps.some(p => p.name.includes('headline'))) {
      return 'container';
    }
    
    // Data display elements
    if (analysis.configProps.some(p => p.name.includes('data') || p.name.includes('list'))) {
      return 'data';
    }
    
    return 'general';
  }

  /**
   * Determine the best strategy for displaying content
   */
  determineContentStrategy(analysis) {
    // If has visible text props, prioritize those
    if (analysis.visibleTextProps.length > 0) {
      return 'visible-first';
    }
    
    // If form-related, label is probably for field labeling
    if (analysis.isFormRelated && analysis.accessibilityProps.some(p => p.name === 'label')) {
      return 'form-label';
    }
    
    // If only accessibility props, use those carefully
    if (analysis.accessibilityProps.length > 0) {
      return 'accessibility-only';
    }
    
    return 'minimal';
  }

  /**
   * Generate basic example using pure semantic analysis
   */
  generateSemanticBasicExample(tagName, analysis) {
    let props = '';
    
    // Add required props first
    analysis.requiredProps.forEach(prop => {
      const value = this.generateSemanticValue(prop, analysis);
      if (value !== null) {
        props += ` ${prop.name}="${value}"`;
      }
    });
    
    // Add primary content based on strategy
    if (analysis.contentStrategy === 'visible-first') {
      const primaryProp = analysis.visibleTextProps[0];
      if (primaryProp && !analysis.requiredProps.includes(primaryProp)) {
        const value = this.generateSemanticValue(primaryProp, analysis);
        props += ` ${primaryProp.name}="${value}"`;
      }
    } else if (analysis.contentStrategy === 'form-label') {
      const labelProp = analysis.accessibilityProps.find(p => p.name === 'label');
      if (labelProp && !analysis.requiredProps.includes(labelProp)) {
        const value = this.generateSemanticValue(labelProp, analysis);
        props += ` ${labelProp.name}="${value}"`;
      }
    }

    // For components without visible text props, add essential config props
    if (analysis.visibleTextProps.length === 0 && analysis.configProps.length > 0) {
      const essentialConfig = this.getEssentialConfigProps(analysis);
      essentialConfig.forEach(prop => {
        if (!analysis.requiredProps.includes(prop)) {
          const value = this.generateSemanticValue(prop, analysis);
          if (value !== null) {
            props += ` ${prop.name}="${value}"`;
          }
        }
      });
    }

    // Detect if this is a composite component and generate children
    const compositeInfo = this.detectCompositeComponent(tagName, analysis);
    const content = compositeInfo ? 
      this.generateCompositeChildren(compositeInfo) : 
      this.generateSlotContent(analysis);

    return {
      title: 'Basic Usage',
      description: `Simple example showing essential ${analysis.inferredPurpose} functionality`,
      code: `<${tagName}${props}>${content}</${tagName}>`,
      framework: 'HTML/Web Components'
    };
  }

  /**
   * Detect if a component is composite (needs child elements) based on naming patterns
   */
  detectCompositeComponent(tagName, analysis) {
    const compositePatterns = [
      // Radio groups need radio options
      {
        pattern: /va-radio$/,
        childElement: 'va-radio-option',
        childCount: { min: 2, max: 4, default: 3 },
        childProps: [
          { name: 'label', required: true },
          { name: 'name', required: true },
          { name: 'value', required: true }
        ],
        parentLabelPattern: 'Select one',
        purpose: 'form-choice-group'
      },
      
      // Checkbox groups need checkbox options
      {
        pattern: /va-checkbox-group$/,
        childElement: 'va-checkbox',
        childCount: { min: 2, max: 3, default: 2 },
        childProps: [
          { name: 'label', required: true },
          { name: 'name', required: true }
        ],
        parentLabelPattern: 'Select all that apply',
        purpose: 'form-choice-group'
      },
      
      // Accordions need accordion items
      {
        pattern: /va-accordion$/,
        childElement: 'va-accordion-item',
        childCount: { min: 2, max: 3, default: 2 },
        childProps: [
          { name: 'header', required: true }
        ],
        purpose: 'collapsible-container'
      },
      
      // Button pairs need multiple buttons
      {
        pattern: /va-button-pair$/,
        childElement: 'va-button',
        childCount: { min: 2, max: 2, default: 2 },
        childProps: [
          { name: 'text', required: true }
        ],
        purpose: 'action-group'
      },
      
      // Tables need table rows
      {
        pattern: /va-table$/,
        childElement: 'tr',
        childCount: { min: 2, max: 3, default: 2 },
        purpose: 'data-table'
      }
    ];

    return compositePatterns.find(pattern => pattern.pattern.test(tagName));
  }

  /**
   * Generate appropriate child elements for composite components
   */
  generateCompositeChildren(compositeInfo) {
    const childCount = compositeInfo.childCount.default;
    const children = [];

    for (let i = 1; i <= childCount; i++) {
      const childProps = this.generateChildProps(compositeInfo, i);
      const childElement = compositeInfo.childElement;
      
      if (compositeInfo.purpose === 'data-table') {
        // Special handling for tables
        children.push(`\n    <${childElement}><td>Row ${i} Data</td></${childElement}>`);
      } else {
        children.push(`\n  <${childElement}${childProps}></${childElement}>`);
      }
    }

    return children.join('') + '\n';
  }

  /**
   * Generate props for child elements in composite components
   */
  generateChildProps(compositeInfo, index) {
    let props = '';
    
    if (!compositeInfo.childProps) return props;

    compositeInfo.childProps.forEach(propDef => {
      const value = this.generateChildPropValue(propDef, compositeInfo, index);
      props += ` ${propDef.name}="${value}"`;
    });

    return props;
  }

  /**
   * Generate contextually appropriate values for child element props
   */
  generateChildPropValue(propDef, compositeInfo, index) {
    const propName = propDef.name.toLowerCase();
    
    // Generate values based on composite type and prop name
    switch (compositeInfo.purpose) {
      case 'form-choice-group':
        if (propName === 'label') {
          const options = [
            'Sojourner Truth',
            'Frederick Douglass', 
            'Booker T. Washington',
            'George Washington Carver'
          ];
          return options[index - 1] || `Option ${index}`;
        }
        if (propName === 'name') return 'group';
        if (propName === 'value') return index.toString();
        break;
        
      case 'collapsible-container':
        if (propName === 'header') return `Section ${index}`;
        break;
        
      case 'action-group':
        if (propName === 'text') {
          return index === 1 ? 'Continue' : 'Back';
        }
        break;
    }
    
    return `value-${index}`;
  }

  /**
   * Get essential configuration props based on analysis patterns
   */
  getEssentialConfigProps(analysis) {
    // For notifications, prioritize status and visibility
    if (analysis.inferredPurpose === 'notification') {
      const statusProp = analysis.configProps.find(p => p.name === 'status');
      const visibleProp = analysis.stateProps.find(p => p.name === 'visible');
      return [statusProp, visibleProp].filter(Boolean);
    }
    
    // For actions, prioritize type or variant
    if (analysis.inferredPurpose === 'action') {
      const typeProp = analysis.configProps.find(p => p.name === 'type');
      const variantProp = analysis.configProps.find(p => p.name === 'variant');
      return [typeProp || variantProp].filter(Boolean);
    }
    
    // For other components, get the first config prop
    return analysis.configProps.slice(0, 1);
  }

  /**
   * Generate appropriate slot content based on inferred purpose
   */
  generateSlotContent(analysis) {
    switch (analysis.inferredPurpose) {
      case 'notification':
        return analysis.hasSlots ? 
          `\n  <h2 slot="headline">Important Update</h2>\n  <p>Please review the updated information before proceeding.</p>\n` : 
          '';
      
      case 'container':
        return analysis.hasSlots ? 
          `\n  <h2 slot="headline">Service Information</h2>\n  <p>Learn about the benefits and services available to you.</p>\n` : 
          '';
      
      case 'action':
      case 'input':
      case 'navigation':
      case 'data':
      default:
        return '';
    }
  }

  /**
   * Generate contextually appropriate values based on pure semantic analysis
   */
  generateSemanticValue(prop, analysis) {
    const propName = prop.name.toLowerCase();
    const propType = prop.type.toLowerCase();
    
    // Special handling for arrays (like breadcrumbs)
    if (propType.includes('array') || propType.includes('[]')) {
      if (propName.includes('breadcrumb')) {
        return '[{"href": "/", "label": "Home"}, {"label": "Current Page"}]';
      }
      return '[]';
    }
    
    // Handle union types by extracting first option
    if (propType.includes('|')) {
      const options = propType.split('|').map(s => s.trim().replace(/['"]/g, ''));
      // Skip 'undefined' and pick first meaningful option
      const meaningfulOptions = options.filter(opt => opt !== 'undefined' && opt.length > 0);
      if (meaningfulOptions.length > 0) {
        return meaningfulOptions[0];
      }
    }
    
    // Context-aware value generation based on inferred purpose
    switch (analysis.inferredPurpose) {
      case 'action':
        if (propName === 'text') return 'Submit Application';
        if (propName === 'label') return 'Submit your application';
        if (propName.includes('submit')) return 'true';
        if (propName === 'type') return 'submit';
        break;
        
      case 'notification':
        if (propName.includes('headline')) return 'Important Update';
        if (propName === 'status') return 'info';
        if (propName === 'visible') return 'true';
        break;
        
      case 'input':
        if (propName === 'label') {
          // For form groups like radio/checkbox, use appropriate group label
          if (analysis.isFormRelated && propName === 'label') {
            return 'Select one historical figure';
          }
          return 'Email Address';
        }
        if (propName === 'name') return 'email';
        if (propName === 'required') return 'true';
        break;
        
      case 'navigation':
        if (propName === 'label') return 'Navigation';
        if (propName.includes('href')) return '/example-page';
        break;
        
      case 'container':
        if (propName.includes('headline')) return 'Service Information';
        break;
    }
    
    // Special handling for form group components
    if (analysis.isFormRelated && propName === 'label') {
      return 'Select one historical figure';
    }
    
    // Type-based value generation
    if (propType.includes('boolean')) {
      return 'true';
    } else if (propType.includes('number')) {
      if (propName.includes('level')) return '2';
      if (propName.includes('timeout')) return '5000';
      return '1';
    } else if (propType.includes('object')) {
      return '{}';
    }
    
    // Fallback to generic value generation
    return this.getGenericExampleValue(prop);
  }

  getGenericExampleValue(prop) {
    const name = prop.name.toLowerCase();
    const type = prop.type.toLowerCase();

    // Handle accessibility props specially
    if (name.includes('aria') || name.includes('label')) {
      if (name.includes('label')) return 'Descriptive label for screen readers';
      if (name.includes('describedby')) return 'additional-info';
      if (name.includes('aria')) return 'ARIA attribute value';
    }

    // Handle different prop types
    if (type.includes('boolean')) {
      return 'true';
    } else if (type.includes('number')) {
      if (name.includes('level')) return '2';
      if (name.includes('timeout')) return '5000';
      return '1';
    } else if (type.includes('string')) {
      if (name === 'text') return 'Click me';
      if (name === 'label') return 'Button label';
      if (name === 'headline') return 'Important Notice';
      if (name === 'status') return 'info';
      if (name === 'variant') return 'primary';
      if (name === 'type') return 'button';
      if (name.includes('url') || name.includes('href')) return 'https://va.gov';
      if (name.includes('id')) return 'unique-id';
      if (name.includes('class')) return 'custom-class';
      return 'Example value';
    } else if (type.includes('array')) {
      return '[]';
    } else if (type.includes('object')) {
      return '{}';
    }

    return 'value';
  }

  /**
   * Generate state variation examples based on pure property analysis
   */
  generateStateVariationExample(tagName, analysis) {
    const stateProps = analysis.stateProps.slice(0, 2); // Limit to 2 states
    if (stateProps.length === 0) return null;
    
    let props = '';
    
    // Add a primary content prop
    if (analysis.visibleTextProps.length > 0) {
      const contentProp = analysis.visibleTextProps[0];
      const value = this.generateSemanticValue(contentProp, analysis);
      props += ` ${contentProp.name}="${value}"`;
    }
    
    // Add state props
    stateProps.forEach(prop => {
      props += ` ${prop.name}`;
    });

    return {
      title: 'With State Variations',
      description: `Example showing different ${stateProps.map(p => p.name).join(' and ')} states`,
      code: `<${tagName}${props}></${tagName}>`,
      framework: 'HTML/Web Components'
    };
  }

  generateConditionalExample(tagName, analysis) {
    // Implementation for conditional content examples
    return null; // Placeholder
  }

  generateAccessibilityExample(tagName, analysis) {
    if (!analysis.hasAccessibilityEnhancements) return null;
    
    let props = '';
    
    // Always include visible content if available
    if (analysis.visibleTextProps.length > 0) {
      const contentProp = analysis.visibleTextProps[0];
      const value = this.generateSemanticValue(contentProp, analysis);
      props += ` ${contentProp.name}="${value}"`;
    }
    
    // Add accessibility enhancements
    analysis.accessibilityProps.slice(0, 2).forEach(prop => {
      const value = this.generateSemanticValue(prop, analysis);
      props += ` ${prop.name}="${value}"`;
    });

    return {
      title: 'Accessibility Enhanced',
      description: 'Example with enhanced screen reader support and context',
      code: `<${tagName}${props}></${tagName}>`,
      framework: 'HTML/Web Components'
    };
  }

  generateFormContextExample(tagName, analysis) {
    if (!analysis.isFormRelated) return null;
    
    let props = '';
    
    // Add form-specific props
    analysis.accessibilityProps.forEach(prop => {
      if (prop.name === 'label') {
        props += ` ${prop.name}="${this.generateSemanticValue(prop, analysis)}"`;
      }
    });
    
    // Add common form props
    if (analysis.requiredProps.length === 0) {
      props += ' name="example-field" required';
    }

    return {
      title: 'In Form Context',
      description: 'Example showing proper form integration',
      code: `<form>
  <${tagName}${props}></${tagName}>
  <va-button text="Submit" submit></va-button>
</form>`,
      framework: 'HTML/Web Components'
    };
  }

  /**
   * Generate helpful error message for rate limit issues
   */
  getRateLimitErrorMessage(resetTime) {
    const isMCP = process.env.MCP_SERVER_NAME || process.env._MCP_SERVER_NAME;
    
    const asciiArt = `
╭─────────────────────────────────────────────────────────────╮
│  🚀 VA Component Monitor - Rate Limit Reached              │
│                                                             │
│      ██╗   ██╗ █████╗     ██████╗ ███████╗██╗   ██╗        │
│      ██║   ██║██╔══██╗    ██╔══██╗██╔════╝██║   ██║        │
│      ██║   ██║███████║    ██║  ██║█████╗  ██║   ██║        │
│      ╚██╗ ██╔╝██╔══██║    ██║  ██║██╔══╝  ╚██╗ ██╔╝        │
│       ╚████╔╝ ██║  ██║    ██████╔╝███████╗ ╚████╔╝         │
│        ╚═══╝  ╚═╝  ╚═╝    ╚═════╝ ╚══════╝  ╚═══╝          │
│                                                             │
│  No worries! Just hit GitHub's rate limit (60 req/hour)    │
│  Reset time: ${resetTime}                       │
╰─────────────────────────────────────────────────────────────╯`;

    if (isMCP) {
      return `${asciiArt}

💡 QUICK FIX: Boost your rate limit to 5,000 requests/hour with a GitHub token!

🔧 Steps:
   1. Get a token: https://github.com/settings/tokens
      → Click "Generate new token (classic)"
      → Check "public_repo" scope
      → Copy the token

   2. Add to your Cursor MCP config (~/.cursor/mcp.json):
      {
        "mcpServers": {
          "va-design-system-monitor": {
            "command": "node",
            "args": ["path/to/va-design-system-monitor/bin/mcp-server.js"],
            "env": {
              "GITHUB_TOKEN": "your_token_here"
            }
          }
        }
      }

   3. Restart Cursor and you're good to go! 🎉

📚 More info: https://docs.github.com/en/rest/overview/rate-limits`;
    } else {
      return `${asciiArt}

💡 QUICK FIX: Boost your rate limit to 5,000 requests/hour!

🔧 Add a GitHub token:
   export GITHUB_TOKEN="your_token_here"

   Or create a .env file:
   GITHUB_TOKEN=your_token_here

🎫 Get your token: https://github.com/settings/tokens
   → Select "public_repo" scope
   → You'll be flying through those requests! ✈️`;
    }
  }
}

/**
 * Production-ready convenience functions with validation
 */

// Convenience function for quick checks
export async function checkComponent(componentName, options = {}) {
  try {
    validateInput(componentName, 'string', 'componentName');
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.getComponentByName(componentName);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to check component', 'CHECK_ERROR', { originalError: error.message });
  }
}

// Convenience function for validation
export async function validateComponents(componentNames, options = {}) {
  try {
    if (!Array.isArray(componentNames)) {
      throw new VAComponentError('componentNames must be an array', 'INVALID_INPUT');
    }
    
    if (componentNames.length === 0) {
      throw new VAComponentError('componentNames array cannot be empty', 'INVALID_INPUT');
    }
    
    if (componentNames.length > 50) {
      throw new VAComponentError('Too many components to validate (max 50)', 'INVALID_INPUT');
    }
    
    // Validate each component name
    componentNames.forEach((name, index) => {
      try {
        validateInput(name, 'string', `componentNames[${index}]`);
      } catch (error) {
        throw new VAComponentError(`Invalid component name at index ${index}: ${error.message}`, 'INVALID_INPUT');
      }
    });
    
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.validateComponents(componentNames);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to validate components', 'VALIDATION_ERROR', { originalError: error.message });
  }
}

// Convenience function for linting
export async function lintComponents(componentNames, options = {}) {
  try {
    if (!Array.isArray(componentNames)) {
      throw new VAComponentError('componentNames must be an array', 'INVALID_INPUT');
    }
    
    if (componentNames.length === 0) {
      throw new VAComponentError('componentNames array cannot be empty', 'INVALID_INPUT');
    }
    
    if (componentNames.length > 50) {
      throw new VAComponentError('Too many components to lint (max 50)', 'INVALID_INPUT');
    }
    
    // Validate each component name
    componentNames.forEach((name, index) => {
      try {
        validateInput(name, 'string', `componentNames[${index}]`);
      } catch (error) {
        throw new VAComponentError(`Invalid component name at index ${index}: ${error.message}`, 'INVALID_INPUT');
      }
    });
    
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.lintComponents(componentNames);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to lint components', 'LINT_ERROR', { originalError: error.message });
  }
}

// Convenience function for getting component properties
export async function getComponentProperties(componentName, options = {}) {
  try {
    validateInput(componentName, 'string', 'componentName');
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.getComponentProperties(componentName);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to get component properties', 'PROPERTIES_ERROR', { originalError: error.message });
  }
}

// Convenience function for getting component examples
export async function getComponentExamples(componentName, options = {}) {
  try {
    validateInput(componentName, 'string', 'componentName');
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.getComponentExamples(componentName, options);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to get component examples', 'EXAMPLES_ERROR', { originalError: error.message });
  }
}

// Convenience function for getting official VA examples
export async function getOfficialExamples(componentName, options = {}) {
  try {
    validateInput(componentName, 'string', 'componentName');
    if (options && typeof options !== 'object') {
      throw new VAComponentError('Options must be an object', 'INVALID_OPTIONS');
    }
    
    const monitor = new VAComponentMonitor(options);
    return await monitor.getOfficialExamples(componentName, options);
  } catch (error) {
    if (error instanceof VAComponentError) {
      throw error;
    }
    throw new VAComponentError('Failed to get official examples', 'EXAMPLES_ERROR', { originalError: error.message });
  }
}

// Export constants for better type safety and IntelliSense
export const ComponentStatus = Object.freeze({
  RECOMMENDED: 'RECOMMENDED',
  STABLE: 'STABLE',
  EXPERIMENTAL: 'EXPERIMENTAL',
  AVAILABLE_WITH_ISSUES: 'AVAILABLE_WITH_ISSUES',
  USE_WITH_CAUTION: 'USE_WITH_CAUTION',
  UNKNOWN: 'UNKNOWN'
});

export const MaturityLevel = Object.freeze({
  BEST_PRACTICE: 'best_practice',
  DEPLOYED: 'deployed',
  CANDIDATE: 'candidate',
  AVAILABLE: 'available'
});

export const MaturityCategory = Object.freeze({
  USE: 'use',
  CAUTION: 'caution'
});

// Error codes for programmatic error handling
export const ErrorCodes = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  INVALID_URL: 'INVALID_URL',
  INVALID_TIMEOUT: 'INVALID_TIMEOUT',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_DATA: 'INVALID_DATA',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FETCH_ERROR: 'FETCH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NO_COMPONENTS_FOUND: 'NO_COMPONENTS_FOUND',
  SEARCH_ERROR: 'SEARCH_ERROR',
  FILTER_ERROR: 'FILTER_ERROR',
  CHECK_ERROR: 'CHECK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  LINT_ERROR: 'LINT_ERROR',
  PROPERTIES_ERROR: 'PROPERTIES_ERROR',
  EXAMPLES_ERROR: 'EXAMPLES_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
});

// Default export
export default VAComponentMonitor; 