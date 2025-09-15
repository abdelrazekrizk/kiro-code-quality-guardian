import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateConfigService } from '../config/QualityGateConfig';

describe('QualityGateConfigService', () => {
  let configService: QualityGateConfigService;

  beforeEach(() => {
    configService = new QualityGateConfigService();
  });

  describe('configuration management', () => {
    it('should provide default configuration', () => {
      const config = configService.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.thresholds.minQualityScore).toBe(70);
      expect(config.thresholds.maxCriticalViolations).toBe(0);
      expect(config.thresholds.blockOnCritical).toBe(true);
    });

    it('should provide team-specific configuration', () => {
      const config = configService.getConfig('strict-team');
      
      expect(config.enabled).toBe(true);
      expect(config.thresholds.minQualityScore).toBe(85);
      expect(config.teamId).toBe('strict-team');
    });

    it('should update configuration correctly', () => {
      configService.updateConfig('test-team', {
        enabled: false,
        thresholds: {
          minQualityScore: 95,
          maxCriticalViolations: 0,
          maxErrorViolations: 0,
          maxWarningViolations: 2,
          blockOnCritical: true,
          warnOnLowScore: false
        }
      });

      const config = configService.getConfig('test-team');
      expect(config.enabled).toBe(false);
      expect(config.thresholds.minQualityScore).toBe(95);
      expect(config.thresholds.maxWarningViolations).toBe(2);
    });
  });

  describe('file exclusion patterns', () => {
    it('should exclude node_modules files', () => {
      const config = configService.getConfig();
      const isExcluded = configService.isFileExcluded('node_modules/package/index.js', config);
      
      expect(isExcluded).toBe(true);
    });

    it('should exclude test files', () => {
      const config = configService.getConfig();
      
      expect(configService.isFileExcluded('src/component.test.ts', config)).toBe(true);
      expect(configService.isFileExcluded('src/utils.spec.js', config)).toBe(true);
    });

    it('should exclude markdown files', () => {
      const config = configService.getConfig();
      const isExcluded = configService.isFileExcluded('README.md', config);
      
      expect(isExcluded).toBe(true);
    });

    it('should not exclude regular source files', () => {
      const config = configService.getConfig();
      
      expect(configService.isFileExcluded('src/component.ts', config)).toBe(false);
      expect(configService.isFileExcluded('src/utils.js', config)).toBe(false);
      expect(configService.isFileExcluded('lib/index.py', config)).toBe(false);
    });
  });

  describe('threshold validation', () => {
    it('should validate quality score range', () => {
      const errors1 = configService.validateThresholds({ minQualityScore: -10 });
      expect(errors1).toContain('minQualityScore must be between 0 and 100');

      const errors2 = configService.validateThresholds({ minQualityScore: 150 });
      expect(errors2).toContain('minQualityScore must be between 0 and 100');

      const errors3 = configService.validateThresholds({ minQualityScore: 75 });
      expect(errors3).toHaveLength(0);
    });

    it('should validate violation counts are non-negative', () => {
      const errors1 = configService.validateThresholds({ maxCriticalViolations: -1 });
      expect(errors1).toContain('maxCriticalViolations must be non-negative');

      const errors2 = configService.validateThresholds({ maxErrorViolations: -5 });
      expect(errors2).toContain('maxErrorViolations must be non-negative');

      const errors3 = configService.validateThresholds({ maxWarningViolations: -2 });
      expect(errors3).toContain('maxWarningViolations must be non-negative');
    });

    it('should pass validation for valid thresholds', () => {
      const errors = configService.validateThresholds({
        minQualityScore: 80,
        maxCriticalViolations: 0,
        maxErrorViolations: 2,
        maxWarningViolations: 5
      });
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('import/export functionality', () => {
    it('should export configuration as JSON', () => {
      const configJson = configService.exportConfig();
      const parsed = JSON.parse(configJson);
      
      expect(parsed.enabled).toBe(true);
      expect(parsed.thresholds).toBeDefined();
      expect(parsed.excludePatterns).toBeDefined();
    });

    it('should import valid configuration', () => {
      const newConfig = {
        enabled: false,
        thresholds: {
          minQualityScore: 90,
          maxCriticalViolations: 0,
          maxErrorViolations: 1,
          maxWarningViolations: 3,
          blockOnCritical: true,
          warnOnLowScore: true
        },
        excludePatterns: ['*.test.ts', 'dist/**']
      };

      configService.importConfig('imported-team', JSON.stringify(newConfig));
      const config = configService.getConfig('imported-team');
      
      expect(config.enabled).toBe(false);
      expect(config.thresholds.minQualityScore).toBe(90);
      expect(config.excludePatterns).toEqual(['*.test.ts', 'dist/**']);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        enabled: true,
        thresholds: {
          minQualityScore: 150, // Invalid
          maxCriticalViolations: -1, // Invalid
          maxErrorViolations: 1,
          maxWarningViolations: 3,
          blockOnCritical: true,
          warnOnLowScore: true
        },
        excludePatterns: []
      };

      expect(() => {
        configService.importConfig('invalid-team', JSON.stringify(invalidConfig));
      }).toThrow('Invalid configuration');
    });
  });
});