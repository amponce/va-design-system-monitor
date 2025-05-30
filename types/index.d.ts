export interface ComponentProperty {
  name: string;
  type: string;
  optional: boolean;
  description: string | null;
}

export interface ComponentPropertiesData {
  component: {
    name: string;
    tagName?: string;
    status: ComponentStatus;
    maturityLevel: string;
  };
  properties: ComponentProperty[];
}

export interface VAComponent {
  name: string;
  interfaceName: string;
  tagName?: string;
  maturityCategory: string;
  maturityLevel: string;
  guidanceHref?: string | null;
  translations: string[];
  properties: ComponentProperty[];
  status: ComponentStatus;
  recommendation: string;
}

export type ComponentStatus = 
  | 'RECOMMENDED'
  | 'STABLE' 
  | 'EXPERIMENTAL'
  | 'AVAILABLE_WITH_ISSUES'
  | 'USE_WITH_CAUTION'
  | 'UNKNOWN';

export type MaturityLevel = 
  | 'best_practice'
  | 'deployed'
  | 'candidate'
  | 'available';

export type MaturityCategory = 
  | 'use'
  | 'caution';

export interface ValidationResult {
  requested: string;
  found: boolean;
  component: {
    name: string;
    tagName?: string;
    status: ComponentStatus;
    maturityCategory: string;
    maturityLevel: string;
    recommendation: string;
  } | null;
}

export interface ValidationSummary {
  total: number;
  found: number;
  notFound: number;
  recommended: number;
  caution: number;
}

export interface ComponentValidation {
  validation: ValidationResult[];
  summary: ValidationSummary;
}

export interface LintIssue {
  type: 'NOT_FOUND' | 'CAUTION' | 'EXPERIMENTAL' | 'ISSUES';
  component: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface LintResult {
  issues: LintIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  summary: ValidationSummary;
}

export interface ComponentReport {
  total: number;
  statusCounts: Record<ComponentStatus, number>;
  categoryCounts: Record<string, number>;
  lastUpdated: string;
  recommended: VAComponent[];
  caution: VAComponent[];
}

export interface VAComponentMonitorOptions {
  cacheTimeout?: number;
  definitionsUrl?: string;
}

export declare class VAComponentMonitor {
  constructor(options?: VAComponentMonitorOptions);
  
  fetchComponentDefinitions(): Promise<string>;
  parseComponentMetadata(content: string): Map<string, VAComponent>;
  determineComponentStatus(category: string, level: string): ComponentStatus;
  getRecommendation(category: string, level: string): string;
  
  getComponents(forceRefresh?: boolean): Promise<Map<string, VAComponent>>;
  getComponentByName(name: string): Promise<VAComponent | null>;
  getComponentsByStatus(status: ComponentStatus): Promise<VAComponent[]>;
  getRecommendedComponents(): Promise<VAComponent[]>;
  getCautionComponents(): Promise<VAComponent[]>;
  
  validateComponents(componentNames: string[]): Promise<ValidationResult>;
  generateReport(forceRefresh?: boolean): Promise<ComponentReport>;
  
  // Utility methods
  isProductionReady(componentName: string): Promise<boolean>;
  getSuggestedAlternatives(componentName: string, category?: string): Promise<VAComponent[]>;
  lintComponents(componentNames: string[]): Promise<LintResult>;
  getComponentProperties(componentName: string): Promise<ComponentPropertiesData | null>;
}

// Convenience functions
export function checkComponent(componentName: string, options?: VAComponentMonitorOptions): Promise<VAComponent | null>;
export function validateComponents(componentNames: string[], options?: VAComponentMonitorOptions): Promise<ComponentValidation>;
export function lintComponents(componentNames: string[], options?: VAComponentMonitorOptions): Promise<LintResult>;
export function getComponentProperties(componentName: string, options?: VAComponentMonitorOptions): Promise<ComponentPropertiesData | null>;

// Constants
export declare const ComponentStatus: {
  readonly RECOMMENDED: 'RECOMMENDED';
  readonly STABLE: 'STABLE';
  readonly EXPERIMENTAL: 'EXPERIMENTAL';
  readonly AVAILABLE_WITH_ISSUES: 'AVAILABLE_WITH_ISSUES';
  readonly USE_WITH_CAUTION: 'USE_WITH_CAUTION';
  readonly UNKNOWN: 'UNKNOWN';
};

export declare const MaturityLevel: {
  readonly BEST_PRACTICE: 'best_practice';
  readonly DEPLOYED: 'deployed';
  readonly CANDIDATE: 'candidate';
  readonly AVAILABLE: 'available';
};

export declare const MaturityCategory: {
  readonly USE: 'use';
  readonly CAUTION: 'caution';
};

export default VAComponentMonitor; 