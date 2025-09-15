import { QualityGateConfig, QualityThresholds } from '../types';

export class QualityGateConfigService {
  private configs: Map<string, QualityGateConfig> = new Map();
  private defaultConfig: QualityGateConfig;

  constructor() {
    this.defaultConfig = this.createDefaultConfig();
    this.loadConfigurations();
  }

  private createDefaultConfig(): QualityGateConfig {
    return {
      enabled: true,
      thresholds: {
        minQualityScore: 70,
        maxCriticalViolations: 0,
        maxErrorViolations: 3,
        maxWarningViolations: 10,
        blockOnCritical: true,
        warnOnLowScore: true
      },
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '*.test.ts',
        '*.test.js',
        '*.spec.ts',
        '*.spec.js',
        '*.md',
        '*.json'
      ]
    };
  }

  private loadConfigurations(): void {
    // In a real implementation, this would load from a database or config file
    // For demo purposes, we'll use the default config
    this.configs.set('default', this.defaultConfig);
    
    // Example team-specific config
    const strictTeamConfig: QualityGateConfig = {
      enabled: true,
      thresholds: {
        minQualityScore: 85,
        maxCriticalViolations: 0,
        maxErrorViolations: 1,
        maxWarningViolations: 5,
        blockOnCritical: true,
        warnOnLowScore: true
      },
      excludePatterns: this.defaultConfig.excludePatterns,
      teamId: 'strict-team'
    };
    
    this.configs.set('strict-team', strictTeamConfig);
  }

  getConfig(teamId?: string): QualityGateConfig {
    if (teamId && this.configs.has(teamId)) {
      return this.configs.get(teamId)!;
    }
    return this.defaultConfig;
  }

  updateConfig(teamId: string, config: Partial<QualityGateConfig>): void {
    const existingConfig = this.getConfig(teamId);
    const updatedConfig: QualityGateConfig = {
      ...existingConfig,
      ...config,
      thresholds: {
        ...existingConfig.thresholds,
        ...(config.thresholds || {})
      }
    };
    
    this.configs.set(teamId, updatedConfig);
  }

  isFileExcluded(filePath: string, config: QualityGateConfig): boolean {
    return config.excludePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.')
      );
      return regex.test(filePath);
    });
  }

  validateThresholds(thresholds: Partial<QualityThresholds>): string[] {
    const errors: string[] = [];

    if (thresholds.minQualityScore !== undefined) {
      if (thresholds.minQualityScore < 0 || thresholds.minQualityScore > 100) {
        errors.push('minQualityScore must be between 0 and 100');
      }
    }

    if (thresholds.maxCriticalViolations !== undefined && thresholds.maxCriticalViolations < 0) {
      errors.push('maxCriticalViolations must be non-negative');
    }

    if (thresholds.maxErrorViolations !== undefined && thresholds.maxErrorViolations < 0) {
      errors.push('maxErrorViolations must be non-negative');
    }

    if (thresholds.maxWarningViolations !== undefined && thresholds.maxWarningViolations < 0) {
      errors.push('maxWarningViolations must be non-negative');
    }

    return errors;
  }

  exportConfig(teamId?: string): string {
    const config = this.getConfig(teamId);
    return JSON.stringify(config, null, 2);
  }

  importConfig(teamId: string, configJson: string): void {
    try {
      const config = JSON.parse(configJson) as QualityGateConfig;
      const validationErrors = this.validateThresholds(config.thresholds);
      
      if (validationErrors.length > 0) {
        throw new Error(`Invalid configuration: ${validationErrors.join(', ')}`);
      }
      
      this.configs.set(teamId, config);
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}