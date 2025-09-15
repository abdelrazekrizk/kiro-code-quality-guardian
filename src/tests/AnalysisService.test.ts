import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../analysis/AnalysisService';
import { AnalysisRequest } from '../types';

describe('AnalysisService', () => {
  const analysisService = new AnalysisService();

  it('should analyze TypeScript code and detect violations', async () => {
    const request: AnalysisRequest = {
      filePath: 'test.ts',
      content: `var oldVariable = "test";
console.log("debug");
// TODO: fix this`,
      language: 'typescript',
      userId: 'test-user'
    };

    const result = await analysisService.analyzeCode(request);

    expect(result.analysisId).toBeDefined();
    expect(result.filePath).toBe('test.ts');
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.qualityScore).toBeLessThan(100);
    expect(result.processingTime).toBeGreaterThan(0);
    expect(result.metadata.language).toBe('typescript');
    expect(result.metadata.linesOfCode).toBe(3);

    // Check for specific violations
    const varViolation = result.violations.find(v => v.rule === 'no-var');
    const consoleViolation = result.violations.find(v => v.rule === 'no-console');
    const todoViolation = result.violations.find(v => v.rule === 'no-todo-comments');

    expect(varViolation).toBeDefined();
    expect(consoleViolation).toBeDefined();
    expect(todoViolation).toBeDefined();
  });

  it('should analyze Python code and detect violations', async () => {
    const request: AnalysisRequest = {
      filePath: 'test.py',
      content: `def test_function():
    print("debug output")
    # TODO: implement properly
    return 42`,
      language: 'python',
      userId: 'test-user'
    };

    const result = await analysisService.analyzeCode(request);

    expect(result.violations.length).toBeGreaterThan(0);
    
    const printViolation = result.violations.find(v => v.rule === 'no-print');
    const todoViolation = result.violations.find(v => v.rule === 'no-todo-comments');

    expect(printViolation).toBeDefined();
    expect(todoViolation).toBeDefined();
  });

  it('should handle long lines', async () => {
    const longLine = 'a'.repeat(150);
    const request: AnalysisRequest = {
      filePath: 'test.ts',
      content: longLine,
      language: 'typescript',
      userId: 'test-user'
    };

    const result = await analysisService.analyzeCode(request);

    const longLineViolation = result.violations.find(v => v.rule === 'max-line-length');
    expect(longLineViolation).toBeDefined();
    expect(longLineViolation?.severity).toBe('warning');
  });

  it('should calculate quality score correctly', async () => {
    const cleanCode = `function cleanFunction() {
  const message = "Hello, world!";
  return message;
}`;

    const request: AnalysisRequest = {
      filePath: 'clean.ts',
      content: cleanCode,
      language: 'typescript',
      userId: 'test-user'
    };

    const result = await analysisService.analyzeCode(request);

    expect(result.qualityScore).toBe(100);
    expect(result.violations.length).toBe(0);
  });
});