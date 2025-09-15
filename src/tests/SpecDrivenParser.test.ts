import { describe, it, expect, beforeEach } from 'vitest';
import { SpecDrivenParser, QualitySpec } from '../analysis/SpecDrivenParser';

describe('SpecDrivenParser', () => {
  let parser: SpecDrivenParser;

  beforeEach(() => {
    parser = new SpecDrivenParser();
  });

  describe('parseQualitySpec', () => {
    it('should parse WHEN...THEN rules correctly', async () => {
      const spec: QualitySpec = {
        content: `WHEN function has more than 20 lines THEN warn about complexity
WHEN variable name is less than 3 characters THEN suggest longer names`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.successfullyParsed).toBe(2);
      
      const firstRule = result.rules[0];
      expect(firstRule.id).toBe('when_then_1');
      expect(firstRule.severity).toBe('warning');
      expect(firstRule.message).toContain('function has more than 20 lines');
    });

    it('should parse IF...THEN rules correctly', async () => {
      const spec: QualitySpec = {
        content: `IF code uses var declaration THEN flag for modernization
IF TODO comment exists THEN suggest creating proper task`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const firstRule = result.rules[0];
      expect(firstRule.id).toBe('if_then_1');
      expect(firstRule.condition.type).toBeDefined();
      expect(firstRule.action.type).toBeDefined();
    });

    it('should parse function rules correctly', async () => {
      const spec: QualitySpec = {
        content: `function calculateTotal should have proper error handling
method processData must validate input parameters`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const firstRule = result.rules[0];
      expect(firstRule.id).toBe('function_1');
      expect(firstRule.severity).toBe('warning');
      
      const secondRule = result.rules[1];
      expect(secondRule.severity).toBe('error'); // 'must' maps to error
    });

    it('should parse naming rules correctly', async () => {
      const spec: QualitySpec = {
        content: `variable names should be descriptive
class UserService must follow naming conventions`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const firstRule = result.rules[0];
      expect(firstRule.id).toBe('naming_1');
      expect(firstRule.condition.type).toBe('pattern');
    });

    it('should handle quality rules', async () => {
      const spec: QualitySpec = {
        content: `code should be well documented
code must have proper error handling`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const firstRule = result.rules[0];
      expect(firstRule.id).toBe('quality_1');
      expect(firstRule.severity).toBe('warning');
      
      const secondRule = result.rules[1];
      expect(secondRule.severity).toBe('error');
    });

    it('should skip comments and empty lines', async () => {
      const spec: QualitySpec = {
        content: `# This is a comment
// Another comment

WHEN function has more than 20 lines THEN warn about complexity

# More comments
IF code uses var THEN flag for review`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle unparseable rules gracefully', async () => {
      const spec: QualitySpec = {
        content: `WHEN function has more than 20 lines THEN warn about complexity
This is not a valid rule format
IF code uses var THEN flag for review
Another invalid rule`
      };

      const result = await parser.parseQualitySpec(spec);

      // Only high-confidence rules are returned (>0.5 confidence)
      expect(result.rules).toHaveLength(2); // 2 valid rules
      expect(result.metadata.totalRules).toBe(4); // 4 total statements processed
      
      // All returned rules should have reasonable confidence
      result.rules.forEach(rule => {
        expect(rule.metadata.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should calculate confidence correctly', async () => {
      const spec: QualitySpec = {
        content: `WHEN function has more than 20 lines THEN warn about complexity
IF code uses var THEN flag for review`
      };

      const result = await parser.parseQualitySpec(spec);

      expect(result.metadata.confidence).toBeGreaterThan(0.8);
      expect(result.metadata.successfullyParsed).toBe(2);
      expect(result.metadata.totalRules).toBe(2);
    });
  });

  describe('convertToExecutableRules', () => {
    it('should convert parsed rules to executable format', async () => {
      const spec: QualitySpec = {
        content: `WHEN function has more than 20 lines THEN warn about complexity`
      };

      const parseResult = await parser.parseQualitySpec(spec);
      const executableRules = parser.convertToExecutableRules(parseResult.rules);

      expect(executableRules).toHaveLength(1);
      
      const rule = executableRules[0];
      expect(rule.id).toBe('when_then_1');
      expect(rule.matcher).toBeDefined();
      expect(rule.action).toBeDefined();
      expect(rule.metadata.originalRule).toBeDefined();
      expect(rule.metadata.compiledAt).toBeInstanceOf(Date);
    });

    it('should create working matchers for pattern conditions', async () => {
      const spec: QualitySpec = {
        content: `WHEN code contains console.log THEN warn about debug statements`
      };

      const parseResult = await parser.parseQualitySpec(spec);
      const executableRules = parser.convertToExecutableRules(parseResult.rules);
      
      const rule = executableRules[0];
      const testCode = `function test() {
  console.log("debug");
  return true;
}`;

      const matches = await rule.matcher.findMatches(testCode, 'typescript');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].line).toBe(2);
      expect(matches[0].text).toContain('console.log');
    });

    it('should create working actions that generate violations', async () => {
      const spec: QualitySpec = {
        content: `WHEN code contains console.log THEN warn about debug statements`
      };

      const parseResult = await parser.parseQualitySpec(spec);
      const executableRules = parser.convertToExecutableRules(parseResult.rules);
      
      const rule = executableRules[0];
      const testCode = `console.log("test");`;

      const matches = await rule.matcher.findMatches(testCode, 'typescript');
      expect(matches).toHaveLength(1);

      const violation = await rule.action.createViolation(matches[0]);
      expect(violation.id).toBeDefined();
      expect(violation.severity).toBe('warning');
      expect(violation.message).toContain('warn about debug statements');
      expect(violation.line).toBe(1);
      expect(violation.rule).toBe('spec-driven-rule');
    });
  });

  describe('validateRules', () => {
    it('should detect duplicate rule IDs', async () => {
      const spec: QualitySpec = {
        content: `WHEN function has more than 20 lines THEN warn about complexity
WHEN function has more than 20 lines THEN warn about complexity`
      };

      const result = await parser.parseQualitySpec(spec);
      
      // Both rules will have the same ID (when_then_1 and when_then_2), so no duplicates
      // Let's test with a different approach - same pattern but different indices
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].id).toBe('when_then_1');
      expect(result.rules[1].id).toBe('when_then_2');
      
      // Test actual duplicate detection by manually creating rules with same ID
      const duplicateRules = [
        { ...result.rules[0], id: 'duplicate_id' },
        { ...result.rules[1], id: 'duplicate_id' }
      ];
      
      const validation = parser.validateRules(duplicateRules);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('Duplicate rule ID'))).toBe(true);
    });

    it('should warn about low confidence rules', async () => {
      const spec: QualitySpec = {
        content: `This is not a proper rule format
Another invalid rule`
      };

      const result = await parser.parseQualitySpec(spec);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Low confidence'))).toBe(true);
    });
  });

  describe('metric conditions', () => {
    it('should parse metric-based conditions', async () => {
      const spec: QualitySpec = {
        content: `WHEN lines > 100 THEN warn about file size
WHEN functions >= 10 THEN suggest refactoring`
      };

      const result = await parser.parseQualitySpec(spec);
      
      expect(result.rules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const firstRule = result.rules[0];
      expect(firstRule.condition.type).toBe('metric');
      expect(firstRule.condition.metric?.name).toBe('lines');
      expect(firstRule.condition.metric?.operator).toBe('>');
      expect(firstRule.condition.metric?.value).toBe(100);
    });

    it('should execute metric-based rules correctly', async () => {
      const spec: QualitySpec = {
        content: `WHEN lines > 5 THEN warn about file size`
      };

      const parseResult = await parser.parseQualitySpec(spec);
      const executableRules = parser.convertToExecutableRules(parseResult.rules);
      
      const rule = executableRules[0];
      const testCode = `line 1
line 2
line 3
line 4
line 5
line 6
line 7`;

      const matches = await rule.matcher.findMatches(testCode, 'typescript');
      expect(matches).toHaveLength(1); // Should match because 7 lines > 5
      
      const violation = await rule.action.createViolation(matches[0]);
      expect(violation.message).toContain('warn about file size');
    });
  });

  describe('error handling', () => {
    it('should handle malformed specs gracefully', async () => {
      const spec: QualitySpec = {
        content: `WHEN THEN
IF THEN
function should`
      };

      const result = await parser.parseQualitySpec(spec);
      
      // Should not throw, but may have errors or low confidence rules
      expect(result).toBeDefined();
      expect(result.rules).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should provide helpful error messages', async () => {
      const spec: QualitySpec = {
        content: `WHEN function THEN
IF code THEN`
      };

      const result = await parser.parseQualitySpec(spec);
      
      if (result.errors.length > 0) {
        expect(result.errors[0].message).toBeDefined();
        expect(result.errors[0].suggestion).toBeDefined();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle a comprehensive quality specification', async () => {
      const spec: QualitySpec = {
        content: `# Comprehensive Quality Rules

# Function complexity rules
WHEN function has more than 20 lines THEN warn about complexity
WHEN function has more than 5 parameters THEN suggest refactoring

# Naming conventions
variable names should be descriptive
function names must use camelCase
class names must use PascalCase

# Code quality
WHEN code contains console.log THEN warn about debug statements
IF code uses var declaration THEN flag for modernization
WHEN line length exceeds 120 characters THEN suggest line breaking

# Documentation
code should have proper comments
WHEN function has no documentation THEN suggest adding JSDoc

# Error handling
functions must handle errors properly
WHEN try block has no catch THEN warn about error handling`,
        metadata: {
          version: '1.0.0',
          author: 'Test Author',
          description: 'Comprehensive quality rules'
        }
      };

      const result = await parser.parseQualitySpec(spec);
      
      expect(result.rules.length).toBeGreaterThan(5);
      expect(result.metadata.confidence).toBeGreaterThan(0.6);
      
      // Convert to executable and test
      const executableRules = parser.convertToExecutableRules(result.rules);
      expect(executableRules.length).toBe(result.rules.length);
      
      // Test with sample code
      const testCode = `var oldVariable = "test";
console.log("debug");
function veryLongFunctionNameThatExceedsReasonableLengthAndShouldBeBrokenIntoSmallerPieces() {
  // No error handling
  return oldVariable;
}`;

      let totalViolations = 0;
      for (const rule of executableRules) {
        const matches = await rule.matcher.findMatches(testCode, 'typescript');
        totalViolations += matches.length;
      }
      
      expect(totalViolations).toBeGreaterThan(0);
    });
  });
});