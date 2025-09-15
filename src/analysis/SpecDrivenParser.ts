import { RuleViolation } from '../types';

// Types for spec-driven rule parsing
export interface QualitySpec {
  content: string;
  metadata?: {
    version?: string;
    author?: string;
    description?: string;
  };
}

export interface ParsedRule {
  id: string;
  condition: RuleCondition;
  action: RuleAction;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  suggestion?: string;
  metadata: {
    originalText: string;
    confidence: number;
    parsedAt: Date;
  };
}

export interface RuleCondition {
  type: 'pattern' | 'ast' | 'metric' | 'custom';
  pattern?: string | RegExp;
  astQuery?: string;
  metric?: {
    name: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number | string;
  };
  custom?: (content: string, language: string) => boolean;
}

export interface RuleAction {
  type: 'violation' | 'warning' | 'suggestion';
  message: string;
  suggestion?: string;
  autoFix?: string;
}

export interface SpecParseResult {
  rules: ParsedRule[];
  errors: ParseError[];
  warnings: string[];
  metadata: {
    totalRules: number;
    successfullyParsed: number;
    confidence: number;
  };
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  originalText: string;
  suggestion?: string;
}

/**
 * Spec-Driven Quality Rules Parser
 * Converts natural language quality specifications into executable rules
 */
export class SpecDrivenParser {
  private rulePatterns: Map<string, RulePattern> = new Map();
  private keywordMappings: Map<string, string> = new Map();

  constructor() {
    this.initializePatterns();
    this.initializeKeywordMappings();
  }

  /**
   * Parse a quality specification and convert to executable rules
   */
  async parseQualitySpec(spec: QualitySpec): Promise<SpecParseResult> {
    const startTime = Date.now();
    const rules: ParsedRule[] = [];
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    try {
      // Split spec into individual rule statements
      const statements = this.extractRuleStatements(spec.content);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
          const parsedRule = await this.parseRuleStatement(statement, i + 1);
          if (parsedRule) {
            rules.push(parsedRule);
          }
        } catch (error) {
          errors.push({
            line: i + 1,
            column: 1,
            message: error instanceof Error ? error.message : 'Unknown parsing error',
            originalText: statement.text,
            suggestion: this.generateSuggestion(statement.text)
          });
        }
      }

      // Validate parsed rules
      const validationResult = this.validateRules(rules);
      warnings.push(...validationResult.warnings);
      errors.push(...validationResult.errors);

      const confidence = this.calculateConfidence(rules, errors, statements.length);

      return {
        rules: rules.filter(rule => rule.metadata.confidence > 0.5), // Only include high-confidence rules
        errors,
        warnings,
        metadata: {
          totalRules: statements.length,
          successfullyParsed: rules.length,
          confidence
        }
      };

    } catch (error) {
      throw new Error(`Failed to parse quality spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert parsed rules to executable format
   */
  convertToExecutableRules(parsedRules: ParsedRule[]): ExecutableRule[] {
    return parsedRules.map(rule => ({
      id: rule.id,
      matcher: this.createMatcher(rule.condition),
      action: this.createAction(rule.action, rule.severity, rule.message),
      metadata: {
        originalRule: rule,
        compiledAt: new Date()
      }
    }));
  }

  /**
   * Validate rule consistency and completeness
   */
  validateRules(rules: ParsedRule[]): { warnings: string[]; errors: ParseError[] } {
    const warnings: string[] = [];
    const errors: ParseError[] = [];
    const ruleIds = new Map<string, number>();

    for (const rule of rules) {
      // Check for duplicate rule IDs
      const count = ruleIds.get(rule.id) || 0;
      ruleIds.set(rule.id, count + 1);
      
      if (count > 0) {
        warnings.push(`Duplicate rule ID found: ${rule.id}`);
      }

      // Validate rule completeness
      if (!rule.condition || !rule.action) {
        errors.push({
          line: 0,
          column: 0,
          message: `Incomplete rule: ${rule.id}`,
          originalText: rule.metadata.originalText,
          suggestion: 'Ensure rule has both condition and action'
        });
      }

      // Check confidence threshold
      if (rule.metadata.confidence < 0.7) {
        warnings.push(`Low confidence rule: ${rule.id} (${Math.round(rule.metadata.confidence * 100)}%)`);
      }
    }

    return { warnings, errors };
  }

  private initializePatterns(): void {
    this.rulePatterns = new Map([
      // WHEN...THEN patterns
      ['when_then', {
        pattern: /WHEN\s+(.+?)\s+THEN\s+(.+?)(?:\s+SHALL\s+(.+?))?$/i,
        confidence: 0.9,
        parser: this.parseWhenThenRule.bind(this)
      }],
      
      // IF...THEN patterns  
      ['if_then', {
        pattern: /IF\s+(.+?)\s+THEN\s+(.+?)(?:\s+SHALL\s+(.+?))?$/i,
        confidence: 0.85,
        parser: this.parseIfThenRule.bind(this)
      }],

      // Function/method patterns
      ['function_rule', {
        pattern: /(function|method)\s+(.+?)\s+(should|must|shall)\s+(.+)/i,
        confidence: 0.8,
        parser: this.parseFunctionRule.bind(this)
      }],

      // Variable/naming patterns
      ['naming_rule', {
        pattern: /(variable|constant|class|interface)\s+(.+?)\s+(should|must|shall)\s+(.+)/i,
        confidence: 0.75,
        parser: this.parseNamingRule.bind(this)
      }],

      // Code quality patterns
      ['quality_rule', {
        pattern: /code\s+(should|must|shall)\s+(.+)/i,
        confidence: 0.7,
        parser: this.parseQualityRule.bind(this)
      }]
    ]);
  }

  private initializeKeywordMappings(): void {
    this.keywordMappings = new Map([
      // Severity mappings
      ['must', 'error'],
      ['shall', 'error'], 
      ['should', 'warning'],
      ['may', 'info'],
      ['critical', 'critical'],
      ['error', 'error'],
      ['warning', 'warning'],
      ['info', 'info'],

      // Action mappings
      ['warn', 'warning'],
      ['flag', 'violation'],
      ['suggest', 'suggestion'],
      ['block', 'violation'],
      ['allow', 'suggestion']
    ]);
  }

  private extractRuleStatements(content: string): RuleStatement[] {
    const lines = content.split('\n');
    const statements: RuleStatement[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      statements.push({
        text: line,
        lineNumber: i + 1
      });
    }

    return statements;
  }

  private async parseRuleStatement(statement: RuleStatement, index: number): Promise<ParsedRule | null> {
    // Try each pattern until one matches
    for (const [patternName, pattern] of this.rulePatterns) {
      const match = statement.text.match(pattern.pattern);
      if (match) {
        try {
          const rule = await pattern.parser(match, statement, index);
          rule.metadata.confidence = pattern.confidence;
          return rule;
        } catch (error) {
          // Continue to next pattern if this one fails
          continue;
        }
      }
    }

    // If no pattern matches, try to create a generic rule
    return this.parseGenericRule(statement, index);
  }

  private async parseWhenThenRule(match: RegExpMatchArray, statement: RuleStatement, index: number): Promise<ParsedRule> {
    const condition = match[1].trim();
    const action = match[2].trim();
    const severity = match[3] ? this.mapSeverity(match[3]) : 'warning';

    return {
      id: `when_then_${index}`,
      condition: this.parseCondition(condition),
      action: this.parseAction(action),
      severity,
      message: `${condition} - ${action}`,
      metadata: {
        originalText: statement.text,
        confidence: 0.9,
        parsedAt: new Date()
      }
    };
  }

  private async parseIfThenRule(match: RegExpMatchArray, statement: RuleStatement, index: number): Promise<ParsedRule> {
    const condition = match[1].trim();
    const action = match[2].trim();
    const severity = match[3] ? this.mapSeverity(match[3]) : 'warning';

    return {
      id: `if_then_${index}`,
      condition: this.parseCondition(condition),
      action: this.parseAction(action),
      severity,
      message: `${condition} - ${action}`,
      metadata: {
        originalText: statement.text,
        confidence: 0.85,
        parsedAt: new Date()
      }
    };
  }

  private async parseFunctionRule(match: RegExpMatchArray, statement: RuleStatement, index: number): Promise<ParsedRule> {
    const target = match[2].trim();
    const severity = this.mapSeverity(match[3]);
    const requirement = match[4].trim();

    return {
      id: `function_${index}`,
      condition: {
        type: 'pattern',
        pattern: new RegExp(`function\\s+\\w*${target}\\w*`, 'i')
      },
      action: {
        type: 'violation',
        message: `Function ${target} ${requirement}`,
        suggestion: `Ensure function ${target} meets requirement: ${requirement}`
      },
      severity,
      message: `Function ${target} ${requirement}`,
      metadata: {
        originalText: statement.text,
        confidence: 0.8,
        parsedAt: new Date()
      }
    };
  }

  private async parseNamingRule(match: RegExpMatchArray, statement: RuleStatement, index: number): Promise<ParsedRule> {
    const elementType = match[1].trim();
    const target = match[2].trim();
    const severity = this.mapSeverity(match[3]);
    const requirement = match[4].trim();

    return {
      id: `naming_${index}`,
      condition: {
        type: 'pattern',
        pattern: new RegExp(`(${elementType})\\s+\\w*${target}\\w*`, 'i')
      },
      action: {
        type: 'violation',
        message: `${elementType} ${target} ${requirement}`,
        suggestion: `Ensure ${elementType} naming follows requirement: ${requirement}`
      },
      severity,
      message: `${elementType} ${target} ${requirement}`,
      metadata: {
        originalText: statement.text,
        confidence: 0.75,
        parsedAt: new Date()
      }
    };
  }

  private async parseQualityRule(match: RegExpMatchArray, statement: RuleStatement, index: number): Promise<ParsedRule> {
    const severity = this.mapSeverity(match[1]);
    const requirement = match[2].trim();

    return {
      id: `quality_${index}`,
      condition: {
        type: 'custom',
        custom: (content: string) => true // Apply to all code
      },
      action: {
        type: 'suggestion',
        message: `Code ${requirement}`,
        suggestion: requirement
      },
      severity,
      message: `Code ${requirement}`,
      metadata: {
        originalText: statement.text,
        confidence: 0.7,
        parsedAt: new Date()
      }
    };
  }

  private async parseGenericRule(statement: RuleStatement, index: number): Promise<ParsedRule | null> {
    // Try to extract basic information from unstructured text
    const text = statement.text.toLowerCase();
    
    // Look for severity indicators
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';
    if (text.includes('must') || text.includes('shall') || text.includes('critical')) {
      severity = 'error';
    } else if (text.includes('should') || text.includes('warning')) {
      severity = 'warning';
    }

    return {
      id: `generic_${index}`,
      condition: {
        type: 'custom',
        custom: () => false // Generic rules don't match by default
      },
      action: {
        type: 'suggestion',
        message: statement.text,
        suggestion: 'Review this quality requirement'
      },
      severity,
      message: statement.text,
      metadata: {
        originalText: statement.text,
        confidence: 0.3, // Low confidence for generic rules
        parsedAt: new Date()
      }
    };
  }

  private parseCondition(conditionText: string): RuleCondition {
    const text = conditionText.toLowerCase().trim();

    // Check for metric conditions (numbers, comparisons)
    const metricMatch = text.match(/(.*?)\s*(>|<|>=|<=|==|!=)\s*(\d+)/);
    if (metricMatch) {
      return {
        type: 'metric',
        metric: {
          name: metricMatch[1].trim(),
          operator: metricMatch[2] as any,
          value: parseInt(metricMatch[3])
        }
      };
    }

    // Check for specific patterns we can match
    if (text.includes('console.log')) {
      return {
        type: 'pattern',
        pattern: /console\.log/gi
      };
    }

    if (text.includes('var declaration') || text.includes('uses var')) {
      return {
        type: 'pattern',
        pattern: /\bvar\s+\w+/gi
      };
    }

    if (text.includes('function') && text.includes('more than')) {
      const numberMatch = text.match(/more than (\d+)/);
      if (numberMatch) {
        return {
          type: 'metric',
          metric: {
            name: 'function lines',
            operator: '>',
            value: parseInt(numberMatch[1])
          }
        };
      }
    }

    // Check for pattern conditions
    if (text.includes('contains') || text.includes('includes') || text.includes('has')) {
      const pattern = text.replace(/(.*?)(contains|includes|has)\s+/, '');
      return {
        type: 'pattern',
        pattern: new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      };
    }

    // Default to pattern matching for the whole condition
    return {
      type: 'pattern',
      pattern: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    };
  }

  private parseAction(actionText: string): RuleAction {
    const text = actionText.toLowerCase().trim();

    if (text.includes('warn') || text.includes('warning')) {
      return {
        type: 'warning',
        message: actionText,
        suggestion: `Consider addressing: ${actionText}`
      };
    }

    if (text.includes('suggest') || text.includes('recommend')) {
      return {
        type: 'suggestion',
        message: actionText,
        suggestion: actionText
      };
    }

    return {
      type: 'violation',
      message: actionText,
      suggestion: `Fix: ${actionText}`
    };
  }

  private mapSeverity(severityText: string): 'info' | 'warning' | 'error' | 'critical' {
    const text = severityText.toLowerCase();
    return this.keywordMappings.get(text) as any || 'warning';
  }

  private generateSuggestion(originalText: string): string {
    return `Try using patterns like "WHEN [condition] THEN [action]" or "IF [condition] THEN [action]". Example: "WHEN function has more than 20 lines THEN warn about complexity"`;
  }

  private calculateConfidence(rules: ParsedRule[], errors: ParseError[], totalStatements: number): number {
    if (totalStatements === 0) return 0;
    
    const successRate = (totalStatements - errors.length) / totalStatements;
    const avgRuleConfidence = rules.length > 0 
      ? rules.reduce((sum, rule) => sum + rule.metadata.confidence, 0) / rules.length 
      : 0;
    
    return (successRate + avgRuleConfidence) / 2;
  }

  private createMatcher(condition: RuleCondition): RuleMatcher {
    return {
      findMatches: async (content: string, language: string) => {
        const matches: RuleMatch[] = [];
        
        switch (condition.type) {
          case 'pattern':
            if (condition.pattern) {
              const regex = condition.pattern instanceof RegExp 
                ? condition.pattern 
                : new RegExp(condition.pattern, 'gi');
              
              const lines = content.split('\n');
              lines.forEach((line, index) => {
                const match = line.match(regex);
                if (match) {
                  matches.push({
                    line: index + 1,
                    column: match.index || 0,
                    text: match[0],
                    context: line
                  });
                }
              });
            }
            break;
            
          case 'metric':
            if (condition.metric) {
              const value = this.calculateMetric(content, condition.metric.name);
              if (this.compareMetric(value, condition.metric.operator, condition.metric.value)) {
                matches.push({
                  line: 1,
                  column: 1,
                  text: `${condition.metric.name}: ${value}`,
                  context: 'File-level metric'
                });
              }
            }
            break;
            
          case 'custom':
            if (condition.custom && condition.custom(content, language)) {
              matches.push({
                line: 1,
                column: 1,
                text: 'Custom condition matched',
                context: 'File-level check'
              });
            }
            break;
        }
        
        return matches;
      }
    };
  }

  private createAction(action: RuleAction, severity: string, message: string): RuleActionExecutor {
    return {
      createViolation: async (match: RuleMatch) => {
        return {
          id: `spec_rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          severity: severity as any,
          message: action.message || message,
          line: match.line,
          column: match.column,
          rule: 'spec-driven-rule',
          suggestion: action.suggestion
        };
      }
    };
  }

  private calculateMetric(content: string, metricName: string): number {
    switch (metricName.toLowerCase()) {
      case 'lines':
      case 'line count':
        return content.split('\n').length;
      case 'characters':
      case 'character count':
        return content.length;
      case 'functions':
        return (content.match(/function\s+\w+/g) || []).length;
      default:
        return 0;
    }
  }

  private compareMetric(value: number, operator: string, threshold: number | string): boolean {
    const numThreshold = typeof threshold === 'string' ? parseFloat(threshold) : threshold;
    
    switch (operator) {
      case '>': return value > numThreshold;
      case '<': return value < numThreshold;
      case '>=': return value >= numThreshold;
      case '<=': return value <= numThreshold;
      case '==': return value === numThreshold;
      case '!=': return value !== numThreshold;
      default: return false;
    }
  }
}

// Supporting interfaces
interface RulePattern {
  pattern: RegExp;
  confidence: number;
  parser: (match: RegExpMatchArray, statement: RuleStatement, index: number) => Promise<ParsedRule>;
}

interface RuleStatement {
  text: string;
  lineNumber: number;
}

export interface ExecutableRule {
  id: string;
  matcher: RuleMatcher;
  action: RuleActionExecutor;
  metadata: {
    originalRule: ParsedRule;
    compiledAt: Date;
  };
}

interface RuleMatcher {
  findMatches(content: string, language: string): Promise<RuleMatch[]>;
}

interface RuleMatch {
  line: number;
  column: number;
  text: string;
  context: string;
}

interface RuleActionExecutor {
  createViolation(match: RuleMatch): Promise<RuleViolation>;
}