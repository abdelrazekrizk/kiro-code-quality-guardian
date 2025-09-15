import ts from 'typescript';
import { AST } from '@typescript-eslint/typescript-estree';
import { parse } from '@typescript-eslint/typescript-estree';
import { RuleViolation, AnalysisRequest, QualityScore } from '../types';

export interface CodeAST {
  sourceFile: ts.SourceFile;
  estreeAST: AST<any>;
  linesOfCode: number;
  complexity: number;
  functions: FunctionInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
}

export interface FunctionInfo {
  name: string;
  lineNumber: number;
  parameterCount: number;
  bodyLength: number;
  complexity: number;
}

export interface VariableInfo {
  name: string;
  type: 'var' | 'let' | 'const';
  lineNumber: number;
  scope: string;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  lineNumber: number;
}

export interface QualityRule {
  id: string;
  name: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  check: (ast: CodeAST, content: string) => RuleViolation[];
  weight: number;
}

/**
 * TypeScript/JavaScript code analyzer with AST parsing capabilities
 */
export class TypeScriptAnalyzer {
  private rules: Map<string, QualityRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Parse TypeScript/JavaScript code into AST
   */
  async parseCode(content: string, filePath: string): Promise<CodeAST> {
    try {
      // Parse with TypeScript compiler API
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );

      // Parse with ESTree for additional analysis
      const estreeAST = parse(content, {
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
        useJSXTextNode: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false
      });

      // Extract code metrics
      const linesOfCode = this.countLinesOfCode(content);
      const complexity = this.calculateCyclomaticComplexity(sourceFile);
      const functions = this.extractFunctions(sourceFile);
      const variables = this.extractVariables(sourceFile);
      const imports = this.extractImports(sourceFile);

      return {
        sourceFile,
        estreeAST,
        linesOfCode,
        complexity,
        functions,
        variables,
        imports
      };
    } catch (error) {
      throw new Error(`Failed to parse code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze code quality using AST
   */
  async analyzeWithAST(request: AnalysisRequest): Promise<RuleViolation[]> {
    const ast = await this.parseCode(request.content, request.filePath);
    const violations: RuleViolation[] = [];

    // Apply all enabled rules
    for (const rule of this.rules.values()) {
      try {
        const ruleViolations = rule.check(ast, request.content);
        violations.push(...ruleViolations);
      } catch (error) {
        console.warn(`Error applying rule ${rule.id}:`, error);
      }
    }

    return violations;
  }

  /**
   * Calculate quality score based on violations and code metrics
   */
  calculateQualityScore(violations: RuleViolation[], ast: CodeAST): QualityScore {
    const baseScore = 100;
    let violationPenalty = 0;
    let complexityPenalty = 0;
    let maintainabilityBonus = 0;

    // Calculate violation penalty
    violations.forEach(violation => {
      const rule = this.rules.get(violation.rule);
      const weight = rule?.weight || 1;
      
      switch (violation.severity) {
        case 'critical':
          violationPenalty += 15 * weight;
          break;
        case 'error':
          violationPenalty += 10 * weight;
          break;
        case 'warning':
          violationPenalty += 5 * weight;
          break;
        case 'info':
          violationPenalty += 2 * weight;
          break;
      }
    });

    // Calculate complexity penalty
    const maxComplexity = Math.max(...ast.functions.map(f => f.complexity), ast.complexity);
    if (maxComplexity > 8) {
      complexityPenalty = Math.min(20, (maxComplexity - 8) * 2);
    }

    // Calculate maintainability bonus
    const avgFunctionLength = ast.functions.length > 0 
      ? ast.functions.reduce((sum, fn) => sum + fn.bodyLength, 0) / ast.functions.length 
      : 0;
    
    if (avgFunctionLength > 0 && avgFunctionLength < 20) {
      maintainabilityBonus += 5;
    }

    if (ast.functions.every(fn => fn.parameterCount <= 5)) {
      maintainabilityBonus += 3;
    }

    // Calculate final score
    const finalScore = Math.max(0, Math.min(100, 
      baseScore - violationPenalty - complexityPenalty + maintainabilityBonus
    ));

    return {
      overall: Math.round(finalScore),
      breakdown: {
        violations: violationPenalty,
        complexity: complexityPenalty,
        maintainability: maintainabilityBonus,
        codeMetrics: {
          linesOfCode: ast.linesOfCode,
          cyclomaticComplexity: ast.complexity,
          functionCount: ast.functions.length,
          averageFunctionLength: Math.round(avgFunctionLength)
        }
      }
    };
  }

  /**
   * Initialize default quality rules
   */
  private initializeDefaultRules(): void {
    // Rule: Function complexity
    this.rules.set('function-complexity', {
      id: 'function-complexity',
      name: 'Function Complexity',
      severity: 'warning',
      weight: 2,
      check: (ast: CodeAST) => {
        const violations: RuleViolation[] = [];
        
        ast.functions.forEach(fn => {
          if (fn.complexity > 8) {
            violations.push({
              id: `complexity-${fn.name}-${fn.lineNumber}`,
              severity: fn.complexity > 15 ? 'error' : 'warning',
              message: `Function '${fn.name}' has high complexity (${fn.complexity})`,
              line: fn.lineNumber,
              column: 1,
              rule: 'function-complexity',
              suggestion: 'Consider breaking this function into smaller functions'
            });
          }
        });
        
        return violations;
      }
    });

    // Rule: Function length
    this.rules.set('function-length', {
      id: 'function-length',
      name: 'Function Length',
      severity: 'warning',
      weight: 1,
      check: (ast: CodeAST) => {
        const violations: RuleViolation[] = [];
        
        ast.functions.forEach(fn => {
          if (fn.bodyLength > 50) {
            violations.push({
              id: `length-${fn.name}-${fn.lineNumber}`,
              severity: fn.bodyLength > 100 ? 'error' : 'warning',
              message: `Function '${fn.name}' is too long (${fn.bodyLength} lines)`,
              line: fn.lineNumber,
              column: 1,
              rule: 'function-length',
              suggestion: 'Consider breaking this function into smaller functions'
            });
          }
        });
        
        return violations;
      }
    });

    // Rule: Parameter count
    this.rules.set('parameter-count', {
      id: 'parameter-count',
      name: 'Parameter Count',
      severity: 'warning',
      weight: 1,
      check: (ast: CodeAST) => {
        const violations: RuleViolation[] = [];
        
        ast.functions.forEach(fn => {
          if (fn.parameterCount > 5) {
            violations.push({
              id: `params-${fn.name}-${fn.lineNumber}`,
              severity: fn.parameterCount > 8 ? 'error' : 'warning',
              message: `Function '${fn.name}' has too many parameters (${fn.parameterCount})`,
              line: fn.lineNumber,
              column: 1,
              rule: 'parameter-count',
              suggestion: 'Consider using an options object or breaking the function down'
            });
          }
        });
        
        return violations;
      }
    });

    // Rule: Variable declarations
    this.rules.set('no-var', {
      id: 'no-var',
      name: 'No Var Declarations',
      severity: 'error',
      weight: 2,
      check: (ast: CodeAST) => {
        const violations: RuleViolation[] = [];
        
        ast.variables.forEach(variable => {
          if (variable.type === 'var') {
            violations.push({
              id: `var-${variable.name}-${variable.lineNumber}`,
              severity: 'error',
              message: `Use 'let' or 'const' instead of 'var' for '${variable.name}'`,
              line: variable.lineNumber,
              column: 1,
              rule: 'no-var',
              suggestion: "Replace 'var' with 'let' or 'const'"
            });
          }
        });
        
        return violations;
      }
    });

    // Rule: Console statements
    this.rules.set('no-console', {
      id: 'no-console',
      name: 'No Console Statements',
      severity: 'warning',
      weight: 1,
      check: (_ast: CodeAST, content: string) => {
        const violations: RuleViolation[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('console.')) {
            const match = line.match(/console\.(log|warn|error|info|debug)/);
            if (match) {
              violations.push({
                id: `console-${index + 1}`,
                severity: 'warning',
                message: `Avoid using console.${match[1]} in production code`,
                line: index + 1,
                column: line.indexOf('console.') + 1,
                rule: 'no-console',
                suggestion: 'Use a proper logging library instead'
              });
            }
          }
        });
        
        return violations;
      }
    });

    // Rule: Magic numbers
    this.rules.set('no-magic-numbers', {
      id: 'no-magic-numbers',
      name: 'No Magic Numbers',
      severity: 'info',
      weight: 1,
      check: (_ast: CodeAST, content: string) => {
        const violations: RuleViolation[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Simple regex to find numeric literals (excluding 0, 1, -1)
          const magicNumbers = line.match(/\b(?!0\b|1\b|-1\b)\d{2,}\b/g);
          if (magicNumbers) {
            magicNumbers.forEach(number => {
              violations.push({
                id: `magic-${number}-${index + 1}`,
                severity: 'info',
                message: `Magic number '${number}' should be replaced with a named constant`,
                line: index + 1,
                column: line.indexOf(number) + 1,
                rule: 'no-magic-numbers',
                suggestion: 'Extract this number into a named constant'
              });
            });
          }
        });
        
        return violations;
      }
    });
  }

  /**
   * Count non-empty lines of code
   */
  private countLinesOfCode(content: string): number {
    return content
      .split('\n')
      .filter(line => line.trim().length > 0 && !line.trim().startsWith('//'))
      .length;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(sourceFile: ts.SourceFile): number {
    let complexity = 1; // Base complexity

    const visit = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const binaryExpr = node as ts.BinaryExpression;
          if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return complexity;
  }

  /**
   * Extract function information from AST
   */
  private extractFunctions(sourceFile: ts.SourceFile): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        const name = this.getFunctionName(node);
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const parameterCount = node.parameters?.length || 0;
        const bodyLength = this.getFunctionBodyLength(node, sourceFile);
        const complexity = this.calculateFunctionComplexity(node);

        functions.push({
          name,
          lineNumber,
          parameterCount,
          bodyLength,
          complexity
        });
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * Extract variable information from AST
   */
  private extractVariables(sourceFile: ts.SourceFile): VariableInfo[] {
    const variables: VariableInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.parent && ts.isVariableDeclarationList(node.parent)) {
        const name = node.name.getText();
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const declarationList = node.parent;
        
        let type: 'var' | 'let' | 'const' = 'var';
        if (declarationList.flags & ts.NodeFlags.Let) {
          type = 'let';
        } else if (declarationList.flags & ts.NodeFlags.Const) {
          type = 'const';
        }

        variables.push({
          name,
          type,
          lineNumber,
          scope: this.getVariableScope(node)
        });
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return variables;
  }

  /**
   * Extract import information from AST
   */
  private extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const source = node.moduleSpecifier.getText().replace(/['"]/g, '');
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const importNames: string[] = [];

        if (node.importClause) {
          if (node.importClause.name) {
            importNames.push(node.importClause.name.getText());
          }
          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              importNames.push(`* as ${node.importClause.namedBindings.name.getText()}`);
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach(element => {
                importNames.push(element.name.getText());
              });
            }
          }
        }

        imports.push({
          source,
          imports: importNames,
          lineNumber
        });
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Helper methods
   */
  private getFunctionName(node: ts.FunctionLikeDeclaration): string {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.getText();
    }
    if (ts.isMethodDeclaration(node) && node.name) {
      return node.name.getText();
    }
    if (ts.isArrowFunction(node)) {
      return 'anonymous';
    }
    return 'unknown';
  }

  private getFunctionBodyLength(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): number {
    if (!node.body) return 0;
    
    const start = sourceFile.getLineAndCharacterOfPosition(node.body.getStart()).line;
    const end = sourceFile.getLineAndCharacterOfPosition(node.body.getEnd()).line;
    
    return end - start + 1;
  }

  private calculateFunctionComplexity(node: ts.FunctionLikeDeclaration): number {
    let complexity = 1;

    const visit = (child: ts.Node) => {
      switch (child.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const binaryExpr = child as ts.BinaryExpression;
          if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
      }
      
      ts.forEachChild(child, visit);
    };

    if (node.body) {
      visit(node.body);
    }
    
    return complexity;
  }

  private getVariableScope(node: ts.VariableDeclaration): string {
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) {
        return 'function';
      }
      if (ts.isBlock(parent)) {
        return 'block';
      }
      if (ts.isSourceFile(parent)) {
        return 'global';
      }
      parent = parent.parent;
    }
    return 'unknown';
  }

  /**
   * Add custom rule
   */
  addRule(rule: QualityRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): QualityRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable/disable rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    if (!enabled) {
      this.rules.delete(ruleId);
    }
  }
}