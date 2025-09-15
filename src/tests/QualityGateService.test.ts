import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../hooks/QualityGateService';
import { PreCommitEvent, CommitAction, FileChange } from '../types';

describe('QualityGateService', () => {
  let qualityGateService: QualityGateService;

  beforeEach(() => {
    qualityGateService = new QualityGateService();
  });

  describe('enforceQualityGate', () => {
    it('should allow commit with good quality code', async () => {
      const event: PreCommitEvent = {
        userId: 'test-user',
        teamId: 'default',
        commitMessage: 'Add good quality code',
        timestamp: new Date(),
        changes: [
          {
            filePath: 'src/goodCode.ts',
            content: `const message = "Hello, world!";
export function greet(name: string): string {
  return \`\${message} \${name}!\`;
}`,
            language: 'typescript',
            changeType: 'added'
          }
        ]
      };

      const result = await qualityGateService.enforceQualityGate(event);
      
      expect(result.action).toBe(CommitAction.ALLOW);
      expect(result.message).toContain('Quality gate passed');
      expect(result.qualityScore).toBeGreaterThan(70);
    });

    it('should block commit with poor quality code', async () => {
      // First, set stricter thresholds for this test
      qualityGateService.updateConfig('test-strict', {
        thresholds: {
          minQualityScore: 95,
          maxCriticalViolations: 0,
          maxErrorViolations: 0,
          maxWarningViolations: 0,
          blockOnCritical: true,
          warnOnLowScore: false
        }
      });

      const event: PreCommitEvent = {
        userId: 'test-user',
        teamId: 'test-strict',
        commitMessage: 'Add poor quality code',
        timestamp: new Date(),
        changes: [
          {
            filePath: 'src/badCode.ts',
            content: `var globalVar = "should not use var";
console.log("Debug statement");
function veryLongFunctionNameThatViolatesNamingConventions() {
  // TODO: Fix this
  return globalVar;
}`,
            language: 'typescript',
            changeType: 'added'
          }
        ]
      };

      const result = await qualityGateService.enforceQualityGate(event);
      
      expect([CommitAction.BLOCK, CommitAction.WARN]).toContain(result.action);
      expect(result.violations).toBeDefined();
      expect(result.violations!.length).toBeGreaterThan(0);
    });

    it('should allow commit when quality gate is disabled', async () => {
      // Update config to disable quality gate
      qualityGateService.updateConfig('test-team', { enabled: false });

      const event: PreCommitEvent = {
        userId: 'test-user',
        teamId: 'test-team',
        commitMessage: 'Add code with disabled gate',
        timestamp: new Date(),
        changes: [
          {
            filePath: 'src/anyCode.ts',
            content: 'var bad = "code";',
            language: 'typescript',
            changeType: 'added'
          }
        ]
      };

      const result = await qualityGateService.enforceQualityGate(event);
      
      expect(result.action).toBe(CommitAction.ALLOW);
      expect(result.message).toContain('Quality gate is disabled');
    });

    it('should skip excluded files', async () => {
      const event: PreCommitEvent = {
        userId: 'test-user',
        teamId: 'default',
        commitMessage: 'Update test files',
        timestamp: new Date(),
        changes: [
          {
            filePath: 'src/component.test.ts',
            content: 'var bad = "test code";',
            language: 'typescript',
            changeType: 'modified'
          },
          {
            filePath: 'README.md',
            content: '# Documentation',
            language: 'markdown',
            changeType: 'modified'
          }
        ]
      };

      const result = await qualityGateService.enforceQualityGate(event);
      
      expect(result.action).toBe(CommitAction.ALLOW);
      expect(result.message).toContain('No files to analyze');
    });

    it('should handle deleted files correctly', async () => {
      const event: PreCommitEvent = {
        userId: 'test-user',
        teamId: 'default',
        commitMessage: 'Delete old files',
        timestamp: new Date(),
        changes: [
          {
            filePath: 'src/oldFile.ts',
            content: '',
            language: 'typescript',
            changeType: 'deleted'
          }
        ]
      };

      const result = await qualityGateService.enforceQualityGate(event);
      
      expect(result.action).toBe(CommitAction.ALLOW);
      expect(result.message).toContain('No files to analyze');
    });
  });

  describe('configuration management', () => {
    it('should return default config for unknown team', () => {
      const config = qualityGateService.getConfig('unknown-team');
      
      expect(config.enabled).toBe(true);
      expect(config.thresholds.minQualityScore).toBe(70);
    });

    it('should return team-specific config when available', () => {
      const config = qualityGateService.getConfig('strict-team');
      
      expect(config.enabled).toBe(true);
      expect(config.thresholds.minQualityScore).toBe(85);
      expect(config.teamId).toBe('strict-team');
    });

    it('should update team configuration', () => {
      qualityGateService.updateConfig('test-team', {
        thresholds: {
          minQualityScore: 90,
          maxCriticalViolations: 0,
          maxErrorViolations: 1,
          maxWarningViolations: 3,
          blockOnCritical: true,
          warnOnLowScore: false
        }
      });

      const config = qualityGateService.getConfig('test-team');
      expect(config.thresholds.minQualityScore).toBe(90);
      expect(config.thresholds.maxErrorViolations).toBe(1);
    });
  });
});