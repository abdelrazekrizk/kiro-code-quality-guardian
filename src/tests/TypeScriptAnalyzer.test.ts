import { describe, it, expect, beforeEach } from 'vitest';
import { TypeScriptAnalyzer } from '../analysis/TypeScriptAnalyzer';
import { AnalysisRequest } from '../types';

describe('TypeScriptAnalyzer', () => {
  let analyzer: TypeScriptAnalyzer;

  beforeEach(() => {
    analyzer = new TypeScriptAnalyzer();
  });

  describe('AST Parsing', () => {
    it('should parse TypeScript code and extract AST', async () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
        
        const message = greet("World");
        console.log(message);
      `;

      const ast = await analyzer.parseCode(code, 'test.ts');

      expect(ast).toBeDefined();
      expect(ast.sourceFile).toBeDefined();
      expect(ast.estreeAST).toBeDefined();
      expect(ast.linesOfCode).toBeGreaterThan(0);
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('greet');
      expect(ast.functions[0].parameterCount).toBe(1);
      expect(ast.variables).toHaveLength(1);
      expect(ast.variables[0].name).toBe('message');
      expect(ast.variables[0].type).toBe('const');
    });

    it('should handle JavaScript code', async () => {
      const code = `
        function calculate(a, b) {
          return a + b;
        }
        
        var result = calculate(5, 3);
      `;

      const ast = await analyzer.parseCode(code, 'test.js');

      expect(ast).toBeDefined();
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('calculate');
      expect(ast.functions[0].parameterCount).toBe(2);
      expect(ast.variables).toHaveLength(1);
      expect(ast.variables[0].type).toBe('var');
    });

    it('should calculate cyclomatic complexity', async () => {
      const complexCode = `
        function complexFunction(x: number): string {
          if (x > 10) {
            if (x > 20) {
              return "very high";
            } else {
              return "high";
            }
          } else if (x > 5) {
            return "medium";
          } else {
            return "low";
          }
        }
      `;

      const ast = await analyzer.parseCode(complexCode, 'complex.ts');

      expect(ast.complexity).toBeGreaterThan(1);
      expect(ast.functions[0].complexity).toBeGreaterThan(1);
    });
  });

  describe('Rule Engine', () => {
    it('should detect var declarations', async () => {
      const request: AnalysisRequest = {
        filePath: 'test.js',
        content: `
          var oldStyle = "should use let or const";
          let newStyle = "this is good";
          const constant = "this is also good";
        `,
        language: 'javascript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const varViolations = violations.filter(v => v.rule === 'no-var');

      expect(varViolations).toHaveLength(1);
      expect(varViolations[0].severity).toBe('error');
      expect(varViolations[0].message).toContain('oldStyle');
    });

    it('should detect console statements', async () => {
      const request: AnalysisRequest = {
        filePath: 'test.ts',
        content: `
          console.log("debug message");
          console.error("error message");
          console.warn("warning message");
          const message = "normal code";
        `,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const consoleViolations = violations.filter(v => v.rule === 'no-console');

      expect(consoleViolations).toHaveLength(3);
      expect(consoleViolations.every(v => v.severity === 'warning')).toBe(true);
    });

    it('should detect function complexity violations', async () => {
      const request: AnalysisRequest = {
        filePath: 'complex.ts',
        content: `
          function veryComplexFunction(x: number): string {
            if (x > 100) {
              if (x > 200) {
                if (x > 300) {
                  if (x > 400) {
                    if (x > 500) {
                      if (x > 600) {
                        if (x > 700) {
                          if (x > 800) {
                            if (x > 900) {
                              return "extremely high";
                            } else {
                              return "very very high";
                            }
                          } else {
                            return "very high";
                          }
                        } else {
                          return "high";
                        }
                      } else {
                        return "medium high";
                      }
                    } else {
                      return "medium";
                    }
                  } else {
                    return "low medium";
                  }
                } else {
                  return "low";
                }
              } else {
                return "very low";
              }
            } else {
              return "minimal";
            }
          }
        `,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const complexityViolations = violations.filter(v => v.rule === 'function-complexity');

      expect(complexityViolations.length).toBeGreaterThanOrEqual(1);
      if (complexityViolations.length > 0) {
        expect(['warning', 'error']).toContain(complexityViolations[0].severity);
      }
    });

    it('should detect function length violations', async () => {
      const longFunctionCode = `
        function veryLongFunction() {
          ${Array(60).fill('  console.log("line");').join('\n')}
        }
      `;

      const request: AnalysisRequest = {
        filePath: 'long.ts',
        content: longFunctionCode,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const lengthViolations = violations.filter(v => v.rule === 'function-length');

      expect(lengthViolations).toHaveLength(1);
      expect(['warning', 'error']).toContain(lengthViolations[0].severity);
    });

    it('should detect parameter count violations', async () => {
      const request: AnalysisRequest = {
        filePath: 'params.ts',
        content: `
          function tooManyParams(a: string, b: number, c: boolean, d: object, e: any, f: string, g: number) {
            return a + b + c + d + e + f + g;
          }
        `,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const paramViolations = violations.filter(v => v.rule === 'parameter-count');

      expect(paramViolations).toHaveLength(1);
      expect(paramViolations[0].severity).toBe('warning');
    });

    it('should detect magic numbers', async () => {
      const request: AnalysisRequest = {
        filePath: 'magic.ts',
        content: `
          const timeout = 5000; // Magic number
          const retries = 3; // Small number, should not trigger
          const maxSize = 1024; // Magic number
        `,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const magicViolations = violations.filter(v => v.rule === 'no-magic-numbers');

      expect(magicViolations).toHaveLength(2); // 5000 and 1024
      expect(magicViolations.every(v => v.severity === 'info')).toBe(true);
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate quality score based on violations and metrics', async () => {
      const request: AnalysisRequest = {
        filePath: 'quality.ts',
        content: `
          function goodFunction(name: string): string {
            return \`Hello, \${name}!\`;
          }
          
          const message = goodFunction("World");
        `,
        language: 'typescript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const ast = await analyzer.parseCode(request.content, request.filePath);
      const score = analyzer.calculateQualityScore(violations, ast);

      expect(score.overall).toBeGreaterThan(80); // Good code should have high score
      expect(score.breakdown).toBeDefined();
      expect(score.breakdown.codeMetrics).toBeDefined();
      expect(score.breakdown.codeMetrics!.linesOfCode).toBeGreaterThan(0);
      expect(score.breakdown.codeMetrics!.functionCount).toBe(1);
    });

    it('should penalize poor quality code', async () => {
      const request: AnalysisRequest = {
        filePath: 'poor.js',
        content: `
          var globalVar = "bad practice";
          console.log("debug statement");
          
          function veryLongFunctionNameThatViolatesNamingConventions(a, b, c, d, e, f, g, h) {
            if (a > 10) {
              if (b > 20) {
                if (c > 30) {
                  if (d > 40) {
                    if (e > 50) {
                      console.log("deeply nested");
                      return globalVar + a + b + c + d + e + f + g + h;
                    }
                  }
                }
              }
            }
            return "default";
          }
        `,
        language: 'javascript',
        userId: 'test-user'
      };

      const violations = await analyzer.analyzeWithAST(request);
      const ast = await analyzer.parseCode(request.content, request.filePath);
      const score = analyzer.calculateQualityScore(violations, ast);

      expect(score.overall).toBeLessThan(70); // Poor code should have low score
      expect(violations.length).toBeGreaterThan(3); // Should have multiple violations
    });
  });

  describe('Rule Management', () => {
    it('should allow adding custom rules', () => {
      const customRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        severity: 'warning' as const,
        weight: 1,
        check: () => []
      };

      analyzer.addRule(customRule);
      const rules = analyzer.getRules();

      expect(rules.some(r => r.id === 'custom-rule')).toBe(true);
    });

    it('should allow removing rules', () => {
      analyzer.removeRule('no-console');
      const rules = analyzer.getRules();

      expect(rules.some(r => r.id === 'no-console')).toBe(false);
    });

    it('should list all available rules', () => {
      const rules = analyzer.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.id && r.name && r.severity)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript code gracefully', async () => {
      const invalidCode = `
        function incomplete(
          // Missing closing parenthesis and body
      `;

      await expect(analyzer.parseCode(invalidCode, 'invalid.ts')).rejects.toThrow();
    });

    it('should handle empty code', async () => {
      const ast = await analyzer.parseCode('', 'empty.ts');

      expect(ast).toBeDefined();
      expect(ast.linesOfCode).toBe(0);
      expect(ast.functions).toHaveLength(0);
      expect(ast.variables).toHaveLength(0);
    });
  });
});