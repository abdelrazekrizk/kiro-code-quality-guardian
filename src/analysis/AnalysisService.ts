import { AnalysisRequest, AnalysisResult, RuleViolation, QualityScore } from '../types';
import { SpecDrivenParser, QualitySpec, ExecutableRule } from './SpecDrivenParser';
import { TypeScriptAnalyzer } from './TypeScriptAnalyzer';

export class AnalysisService {
  private specParser: SpecDrivenParser;
  private customRules: Map<string, ExecutableRule[]> = new Map();
  private tsAnalyzer: TypeScriptAnalyzer;

  constructor() {
    this.specParser = new SpecDrivenParser();
    this.tsAnalyzer = new TypeScriptAnalyzer();
  }
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async analyzeCode(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      let violations: RuleViolation[] = [];
      let qualityScore: number | QualityScore;
      let complexity: number | undefined;

      // Use TypeScript analyzer for TS/JS files
      if (this.isTypeScriptOrJavaScript(request.language)) {
        const astViolations = await this.tsAnalyzer.analyzeWithAST(request);
        const ast = await this.tsAnalyzer.parseCode(request.content, request.filePath);
        
        // Basic analysis for additional rules
        const basicViolations = await this.performBasicAnalysis(request.content, request.language);
        
        // Apply spec-driven rules
        const specViolations = await this.applySpecDrivenRules(request);
        
        // Combine all violations
        violations = [...astViolations, ...basicViolations, ...specViolations];
        
        // Calculate enhanced quality score
        qualityScore = this.tsAnalyzer.calculateQualityScore(violations, ast);
        complexity = ast.complexity;
      } else {
        // Fallback to basic analysis for other languages
        const basicViolations = await this.performBasicAnalysis(request.content, request.language);
        const specViolations = await this.applySpecDrivenRules(request);
        
        violations = [...basicViolations, ...specViolations];
        qualityScore = this.calculateQualityScore(violations, request.content);
      }
      
      return {
        analysisId: this.generateAnalysisId(),
        filePath: request.filePath,
        violations,
        qualityScore: typeof qualityScore === 'object' ? qualityScore.overall : qualityScore,
        processingTime: Date.now() - startTime,
        metadata: {
          language: request.language,
          linesOfCode: this.countLines(request.content),
          complexity
        }
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performBasicAnalysis(content: string, language: string): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    const lines = content.split('\n');

    // Basic rule implementations for demonstration
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Rule: Long lines (>120 characters)
      if (line.length > 120) {
        violations.push({
          id: `long-line-${lineNumber}`,
          severity: 'warning',
          message: `Line exceeds 120 characters (${line.length} characters)`,
          line: lineNumber,
          column: 121,
          rule: 'max-line-length',
          suggestion: 'Consider breaking this line into multiple lines'
        });
      }

      // Rule: TODO comments
      if (line.toLowerCase().includes('todo')) {
        violations.push({
          id: `todo-${lineNumber}`,
          severity: 'info',
          message: 'TODO comment found',
          line: lineNumber,
          column: line.toLowerCase().indexOf('todo') + 1,
          rule: 'no-todo-comments',
          suggestion: 'Consider creating a proper issue or task'
        });
      }

      // Language-specific rules
      if (language === 'typescript' || language === 'javascript') {
        this.analyzeJavaScriptLine(line, lineNumber, violations);
      } else if (language === 'python') {
        this.analyzePythonLine(line, lineNumber, violations);
      }
    });

    return violations;
  }

  private analyzeJavaScriptLine(line: string, lineNumber: number, violations: RuleViolation[]): void {
    // Rule: console.log statements
    if (line.includes('console.log')) {
      violations.push({
        id: `console-log-${lineNumber}`,
        severity: 'warning',
        message: 'console.log statement found',
        line: lineNumber,
        column: line.indexOf('console.log') + 1,
        rule: 'no-console',
        suggestion: 'Use proper logging instead of console.log'
      });
    }

    // Rule: var declarations
    if (line.trim().startsWith('var ')) {
      violations.push({
        id: `var-declaration-${lineNumber}`,
        severity: 'error',
        message: 'Use let or const instead of var',
        line: lineNumber,
        column: line.indexOf('var') + 1,
        rule: 'no-var',
        suggestion: 'Replace var with let or const'
      });
    }
  }

  private analyzePythonLine(line: string, lineNumber: number, violations: RuleViolation[]): void {
    // Rule: print statements
    if (line.includes('print(')) {
      violations.push({
        id: `print-statement-${lineNumber}`,
        severity: 'info',
        message: 'print statement found',
        line: lineNumber,
        column: line.indexOf('print(') + 1,
        rule: 'no-print',
        suggestion: 'Consider using logging instead of print'
      });
    }
  }

  private calculateQualityScore(violations: RuleViolation[], content: string): number {
    const baseScore = 100;
    const linesOfCode = this.countLines(content);
    
    // Calculate penalty based on violations
    const violationPenalty = violations.reduce((penalty, violation) => {
      switch (violation.severity) {
        case 'critical': return penalty + 10;
        case 'error': return penalty + 5;
        case 'warning': return penalty + 2;
        case 'info': return penalty + 1;
        default: return penalty;
      }
    }, 0);

    // Normalize penalty based on code size
    const normalizedPenalty = Math.min(violationPenalty, baseScore * 0.8);
    
    return Math.max(0, Math.round(baseScore - normalizedPenalty));
  }

  private countLines(content: string): number {
    return content.split('\n').filter(line => line.trim().length > 0).length;
  }

  /**
   * Load quality standards from spec and convert to executable rules
   */
  async loadQualityStandards(teamId: string, spec: QualitySpec): Promise<void> {
    try {
      const parseResult = await this.specParser.parseQualitySpec(spec);
      
      if (parseResult.errors.length > 0) {
        console.warn(`Quality spec parsing errors for team ${teamId}:`, parseResult.errors);
      }
      
      if (parseResult.warnings.length > 0) {
        console.warn(`Quality spec parsing warnings for team ${teamId}:`, parseResult.warnings);
      }
      
      const executableRules = this.specParser.convertToExecutableRules(parseResult.rules);
      this.customRules.set(teamId, executableRules);
      
      console.log(`Loaded ${executableRules.length} quality rules for team ${teamId} (confidence: ${Math.round(parseResult.metadata.confidence * 100)}%)`);
      
    } catch (error) {
      throw new Error(`Failed to load quality standards for team ${teamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply spec-driven rules to code analysis
   */
  private async applySpecDrivenRules(request: AnalysisRequest): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    
    // Apply team-specific rules if available
    if (request.context?.teamId) {
      const teamRules = this.customRules.get(request.context.teamId);
      if (teamRules) {
        for (const rule of teamRules) {
          try {
            const matches = await rule.matcher.findMatches(request.content, request.language);
            for (const match of matches) {
              const violation = await rule.action.createViolation(match);
              violations.push(violation);
            }
          } catch (error) {
            console.warn(`Error applying rule ${rule.id}:`, error);
          }
        }
      }
    }
    
    // Apply global rules from standards array
    if (request.standards && request.standards.length > 0) {
      for (const standard of request.standards) {
        const globalRules = this.customRules.get(standard);
        if (globalRules) {
          for (const rule of globalRules) {
            try {
              const matches = await rule.matcher.findMatches(request.content, request.language);
              for (const match of matches) {
                const violation = await rule.action.createViolation(match);
                violations.push(violation);
              }
            } catch (error) {
              console.warn(`Error applying standard rule ${rule.id}:`, error);
            }
          }
        }
      }
    }
    
    return violations;
  }

  /**
   * Validate a quality specification before loading
   */
  async validateQualitySpec(spec: QualitySpec): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const parseResult = await this.specParser.parseQualitySpec(spec);
      
      return {
        isValid: parseResult.errors.length === 0 && parseResult.metadata.confidence > 0.7 && parseResult.rules.length > 0,
        errors: parseResult.errors.map(e => `Line ${e.line}: ${e.message}`),
        warnings: parseResult.warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        warnings: []
      };
    }
  }

  /**
   * Get loaded rules for a team or standard
   */
  getLoadedRules(identifier: string): ExecutableRule[] {
    return this.customRules.get(identifier) || [];
  }

  /**
   * Clear loaded rules for a team or standard
   */
  clearRules(identifier: string): void {
    this.customRules.delete(identifier);
  }

  /**
   * Get all loaded rule identifiers
   */
  getLoadedRuleIdentifiers(): string[] {
    return Array.from(this.customRules.keys());
  }

  /**
   * Check if language is TypeScript or JavaScript
   */
  private isTypeScriptOrJavaScript(language: string): boolean {
    return ['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(language.toLowerCase());
  }

  /**
   * Get TypeScript analyzer instance
   */
  getTypeScriptAnalyzer(): TypeScriptAnalyzer {
    return this.tsAnalyzer;
  }
}