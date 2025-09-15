import { TypeScriptAnalyzer } from '../analysis/TypeScriptAnalyzer';
import { AnalysisRequest } from '../types';

/**
 * Demo showcasing the TypeScript/JavaScript analyzer capabilities
 */
export async function runTypeScriptAnalyzerDemo(): Promise<void> {
  console.log('\n=== TYPESCRIPT/JAVASCRIPT ANALYZER DEMO ===\n');

  const analyzer = new TypeScriptAnalyzer();

  // Demo 1: Good quality TypeScript code
  console.log('📋 Demo 1: Analyzing Good Quality TypeScript Code');
  console.log('─'.repeat(50));

  const goodCode = `
interface User {
  id: string;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    if (this.validateUser(user)) {
      this.users.push(user);
    }
  }

  private validateUser(user: User): boolean {
    return user.id.length > 0 && 
           user.name.length > 0 && 
           user.email.includes('@');
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }
}
  `;

  const goodRequest: AnalysisRequest = {
    filePath: 'UserService.ts',
    content: goodCode,
    language: 'typescript',
    userId: 'demo-user'
  };

  try {
    const ast = await analyzer.parseCode(goodCode, 'UserService.ts');
    const violations = await analyzer.analyzeWithAST(goodRequest);
    const qualityScore = analyzer.calculateQualityScore(violations, ast);

    console.log(`✅ Analysis completed successfully!`);
    console.log(`📊 Quality Score: ${qualityScore.overall}/100`);
    console.log(`📈 Code Metrics:`);
    console.log(`   - Lines of Code: ${ast.linesOfCode}`);
    console.log(`   - Functions: ${ast.functions.length}`);
    console.log(`   - Variables: ${ast.variables.length}`);
    console.log(`   - Cyclomatic Complexity: ${ast.complexity}`);
    console.log(`🔍 Violations Found: ${violations.length}`);
    
    if (violations.length > 0) {
      violations.forEach(v => {
        console.log(`   - ${v.severity.toUpperCase()}: ${v.message} (Line ${v.line})`);
      });
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }

  console.log('\n');

  // Demo 2: Poor quality JavaScript code with multiple issues
  console.log('📋 Demo 2: Analyzing Poor Quality JavaScript Code');
  console.log('─'.repeat(50));

  const poorCode = `
var globalCounter = 0; // Should use let/const
console.log("Starting application"); // Should use proper logging

function calculateSomethingVeryComplexWithTooManyParametersAndPoorNaming(a, b, c, d, e, f, g, h, i, j) {
  console.log("Debug: calculating with", a, b, c, d, e, f, g, h, i, j);
  
  var result = 0; // Should use let/const
  
  if (a > 100) {
    if (b > 200) {
      if (c > 300) {
        if (d > 400) {
          if (e > 500) {
            if (f > 600) {
              if (g > 700) {
                if (h > 800) {
                  if (i > 900) {
                    if (j > 1000) {
                      result = 9999; // Magic number
                      console.log("Maximum reached");
                    } else {
                      result = 8888; // Magic number
                    }
                  } else {
                    result = 7777; // Magic number
                  }
                } else {
                  result = 6666; // Magic number
                }
              } else {
                result = 5555; // Magic number
              }
            } else {
              result = 4444; // Magic number
            }
          } else {
            result = 3333; // Magic number
          }
        } else {
          result = 2222; // Magic number
        }
      } else {
        result = 1111; // Magic number
      }
    } else {
      result = 999; // Magic number
    }
  } else {
    result = 42; // Magic number
  }
  
  globalCounter++; // Modifying global state
  console.log("Final result:", result);
  
  return result;
}

var anotherGlobalVar = "This is bad practice";
console.log("Application initialized");
  `;

  const poorRequest: AnalysisRequest = {
    filePath: 'PoorCode.js',
    content: poorCode,
    language: 'javascript',
    userId: 'demo-user'
  };

  try {
    const ast = await analyzer.parseCode(poorCode, 'PoorCode.js');
    const violations = await analyzer.analyzeWithAST(poorRequest);
    const qualityScore = analyzer.calculateQualityScore(violations, ast);

    console.log(`⚠️  Analysis completed with issues!`);
    console.log(`📊 Quality Score: ${qualityScore.overall}/100`);
    console.log(`📈 Code Metrics:`);
    console.log(`   - Lines of Code: ${ast.linesOfCode}`);
    console.log(`   - Functions: ${ast.functions.length}`);
    console.log(`   - Variables: ${ast.variables.length}`);
    console.log(`   - Cyclomatic Complexity: ${ast.complexity}`);
    console.log(`🚨 Violations Found: ${violations.length}`);
    
    // Group violations by severity
    const violationsBySeverity = violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📋 Violation Summary:`);
    Object.entries(violationsBySeverity).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : 
                   severity === 'error' ? '🟠' : 
                   severity === 'warning' ? '🟡' : '🔵';
      console.log(`   ${emoji} ${severity.toUpperCase()}: ${count}`);
    });

    console.log(`\n🔍 Detailed Violations:`);
    violations.slice(0, 10).forEach((v, index) => { // Show first 10 violations
      console.log(`   ${index + 1}. [${v.severity.toUpperCase()}] Line ${v.line}: ${v.message}`);
      if (v.suggestion) {
        console.log(`      💡 Suggestion: ${v.suggestion}`);
      }
    });

    if (violations.length > 10) {
      console.log(`   ... and ${violations.length - 10} more violations`);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }

  console.log('\n');

  // Demo 3: Rule management
  console.log('📋 Demo 3: Rule Management');
  console.log('─'.repeat(50));

  console.log(`📝 Available Rules (${analyzer.getRules().length} total):`);
  analyzer.getRules().forEach(rule => {
    console.log(`   - ${rule.id}: ${rule.name} (${rule.severity})`);
  });

  // Add a custom rule
  console.log(`\n➕ Adding custom rule...`);
  analyzer.addRule({
    id: 'demo-custom-rule',
    name: 'Demo Custom Rule',
    severity: 'info',
    weight: 1,
    check: (_ast, content) => {
      const violations = [];
      if (content.includes('demo')) {
        violations.push({
          id: 'demo-found',
          severity: 'info' as const,
          message: 'Demo keyword found in code',
          line: 1,
          column: 1,
          rule: 'demo-custom-rule',
          suggestion: 'Remove demo keywords from production code'
        });
      }
      return violations;
    }
  });

  console.log(`✅ Custom rule added. Total rules: ${analyzer.getRules().length}`);

  // Remove a rule
  console.log(`\n➖ Removing 'no-console' rule...`);
  analyzer.removeRule('no-console');
  console.log(`✅ Rule removed. Total rules: ${analyzer.getRules().length}`);

  console.log('\n');

  // Demo 4: Performance test
  console.log('📋 Demo 4: Performance Test');
  console.log('─'.repeat(50));

  const largeCode = `
    // Large TypeScript file for performance testing
    ${Array(50).fill(0).map((_, i) => `
      function function${i}(param1: string, param2: number): string {
        const result = param1 + param2.toString();
        return result;
      }
    `).join('\n')}
  `;

  const performanceRequest: AnalysisRequest = {
    filePath: 'LargeFile.ts',
    content: largeCode,
    language: 'typescript',
    userId: 'demo-user'
  };

  console.log(`📏 Analyzing large file (${largeCode.split('\n').length} lines)...`);
  
  const startTime = Date.now();
  try {
    const violations = await analyzer.analyzeWithAST(performanceRequest);
    const endTime = Date.now();
    
    console.log(`⚡ Analysis completed in ${endTime - startTime}ms`);
    console.log(`🔍 Found ${violations.length} violations`);
    console.log(`📊 Performance: ${Math.round(largeCode.length / (endTime - startTime))} chars/ms`);
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }

  console.log('\n=== TYPESCRIPT ANALYZER DEMO COMPLETE ===\n');
}

// Export for use in main demo
export { TypeScriptAnalyzer };