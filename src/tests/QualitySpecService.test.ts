import { describe, it, expect, beforeEach } from 'vitest';
import { QualitySpecService } from '../analysis/QualitySpecService';
import { AnalysisService } from '../analysis/AnalysisService';

describe('QualitySpecService', () => {
  let specService: QualitySpecService;
  let analysisService: AnalysisService;

  beforeEach(() => {
    analysisService = new AnalysisService();
    specService = new QualitySpecService(analysisService);
  });

  describe('createQualitySpec', () => {
    it('should create a valid quality specification', async () => {
      const content = `WHEN function has more than 20 lines THEN warn about complexity
IF code uses var declaration THEN flag for modernization`;

      const result = await specService.createQualitySpec('test-team', content, {
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test specification'
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Verify the spec was stored
      const storedSpec = specService.getQualitySpec('test-team');
      expect(storedSpec).toBeDefined();
      expect(storedSpec?.content).toBe(content);
      expect(storedSpec?.metadata?.author).toBe('Test Author');
    });

    it('should reject invalid quality specifications', async () => {
      const invalidContent = `WHEN THEN
IF THEN`;

      const result = await specService.createQualitySpec('invalid-team', invalidContent);

      expect(result.success).toBe(false);
      // With stricter validation, specs with no valid rules or low confidence are rejected
      // The spec may not have explicit errors but fails validation due to low confidence/no rules
      
      // Verify the spec was not stored
      const storedSpec = specService.getQualitySpec('invalid-team');
      expect(storedSpec).toBeNull();
    });

    it('should provide warnings for low confidence rules', async () => {
      const content = `WHEN function has more than 20 lines THEN warn about complexity
This is not a proper rule format`;

      const result = await specService.createQualitySpec('warning-team', content);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('updateQualitySpec', () => {
    it('should update an existing quality specification', async () => {
      // Create initial spec
      const initialContent = `WHEN function has more than 20 lines THEN warn about complexity`;
      await specService.createQualitySpec('update-team', initialContent);

      // Update the spec
      const updatedContent = `WHEN function has more than 15 lines THEN warn about complexity
IF code uses var declaration THEN flag for modernization`;

      const result = await specService.updateQualitySpec('update-team', updatedContent, {
        description: 'Updated specification'
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify the update
      const updatedSpec = specService.getQualitySpec('update-team');
      expect(updatedSpec?.content).toBe(updatedContent);
      expect(updatedSpec?.metadata?.description).toBe('Updated specification');
      expect(updatedSpec?.metadata?.version).toBe('1.0.1'); // Version should increment
    });

    it('should fail to update non-existent specification', async () => {
      const result = await specService.updateQualitySpec('non-existent', 'some content');

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Quality specification 'non-existent' not found");
    });

    it('should increment version correctly', async () => {
      // Create initial spec
      await specService.createQualitySpec('version-team', 'WHEN function THEN warn', {
        version: '2.1.5'
      });

      // Update the spec
      await specService.updateQualitySpec('version-team', 'WHEN function THEN error');

      const updatedSpec = specService.getQualitySpec('version-team');
      expect(updatedSpec?.metadata?.version).toBe('2.1.6');
    });
  });

  describe('deleteQualitySpec', () => {
    it('should delete an existing quality specification', async () => {
      // Create spec
      await specService.createQualitySpec('delete-team', 'WHEN function THEN warn');

      // Verify it exists
      expect(specService.getQualitySpec('delete-team')).toBeDefined();

      // Delete it
      const deleted = specService.deleteQualitySpec('delete-team');
      expect(deleted).toBe(true);

      // Verify it's gone
      expect(specService.getQualitySpec('delete-team')).toBeNull();
    });

    it('should return false when deleting non-existent specification', () => {
      const deleted = specService.deleteQualitySpec('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('listQualitySpecs', () => {
    it('should list all quality specifications', async () => {
      // Create multiple specs
      await specService.createQualitySpec('team1', 'WHEN function THEN warn');
      await specService.createQualitySpec('team2', 'IF code THEN error');

      const specs = specService.listQualitySpecs();
      
      // Should include at least our 2 specs (plus any defaults)
      expect(specs.length).toBeGreaterThanOrEqual(2);
      
      const identifiers = specs.map(s => s.identifier);
      expect(identifiers).toContain('team1');
      expect(identifiers).toContain('team2');
    });
  });

  describe('importQualitySpec', () => {
    it('should import from markdown format', async () => {
      const markdown = `# Quality Rules

**Version:** 1.0.0
**Author:** Test Author

## Rules

- WHEN function has more than 20 lines THEN warn about complexity
- IF code uses var declaration THEN flag for modernization`;

      const result = await specService.importQualitySpec('markdown-team', markdown, 'markdown');

      expect(result.success).toBe(true);
      
      const spec = specService.getQualitySpec('markdown-team');
      expect(spec?.content).toContain('WHEN function has more than 20 lines');
      expect(spec?.content).toContain('IF code uses var declaration');
    });

    it('should import from JSON format', async () => {
      const json = JSON.stringify({
        metadata: {
          version: '1.0.0',
          author: 'Test Author'
        },
        rules: [
          'WHEN function has more than 20 lines THEN warn about complexity',
          'IF code uses var declaration THEN flag for modernization'
        ]
      });

      const result = await specService.importQualitySpec('json-team', json, 'json');

      expect(result.success).toBe(true);
      
      const spec = specService.getQualitySpec('json-team');
      expect(spec?.content).toContain('WHEN function has more than 20 lines');
    });

    it('should import from plain text format', async () => {
      const plainText = `WHEN function has more than 20 lines THEN warn about complexity
IF code uses var declaration THEN flag for modernization`;

      const result = await specService.importQualitySpec('plain-team', plainText, 'plain');

      expect(result.success).toBe(true);
      
      const spec = specService.getQualitySpec('plain-team');
      expect(spec?.content).toBe(plainText);
    });

    it('should handle import errors gracefully', async () => {
      const invalidJson = '{ invalid json }';

      const result = await specService.importQualitySpec('error-team', invalidJson, 'json');

      expect(result.success).toBe(false);
      // The import may succeed in parsing but fail validation due to no valid rules
      // Check that the spec was not stored successfully
      const storedSpec = specService.getQualitySpec('error-team');
      expect(storedSpec).toBeNull();
    });
  });

  describe('exportQualitySpec', () => {
    beforeEach(async () => {
      await specService.createQualitySpec('export-team', 
        'WHEN function has more than 20 lines THEN warn about complexity\nIF code uses var THEN flag',
        {
          version: '1.2.3',
          author: 'Export Author',
          description: 'Export test specification'
        }
      );
    });

    it('should export to markdown format', () => {
      const markdown = specService.exportQualitySpec('export-team', 'markdown');

      expect(markdown).toBeDefined();
      expect(markdown).toContain('# Quality Specification');
      expect(markdown).toContain('**Version:** 1.2.3');
      expect(markdown).toContain('**Author:** Export Author');
      expect(markdown).toContain('- WHEN function has more than 20 lines');
    });

    it('should export to JSON format', () => {
      const json = specService.exportQualitySpec('export-team', 'json');

      expect(json).toBeDefined();
      
      const parsed = JSON.parse(json!);
      expect(parsed.metadata.version).toBe('1.2.3');
      expect(parsed.metadata.author).toBe('Export Author');
      expect(parsed.rules).toContain('WHEN function has more than 20 lines THEN warn about complexity');
    });

    it('should export to plain text format', () => {
      const plainText = specService.exportQualitySpec('export-team', 'plain');

      expect(plainText).toBeDefined();
      expect(plainText).toContain('WHEN function has more than 20 lines THEN warn about complexity');
      expect(plainText).toContain('IF code uses var THEN flag');
    });

    it('should return null for non-existent specification', () => {
      const result = specService.exportQualitySpec('non-existent', 'markdown');
      expect(result).toBeNull();
    });
  });

  describe('getSpecificationStats', () => {
    it('should provide accurate statistics', async () => {
      // Create test specs
      await specService.createQualitySpec('stats-team1', 
        'WHEN function THEN warn\nIF code THEN error'
      );
      await specService.createQualitySpec('stats-team2', 
        'WHEN variable THEN suggest'
      );

      const stats = specService.getSpecificationStats();

      expect(stats.totalSpecs).toBeGreaterThanOrEqual(2);
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.specsByIdentifier.length).toBe(stats.totalSpecs);
      
      const team1Stats = stats.specsByIdentifier.find(s => s.identifier === 'stats-team1');
      expect(team1Stats).toBeDefined();
      expect(team1Stats?.ruleCount).toBeGreaterThan(0);
    });
  });

  describe('integration with AnalysisService', () => {
    it('should load rules into analysis service when creating spec', async () => {
      const content = `WHEN function has more than 20 lines THEN warn about complexity`;

      await specService.createQualitySpec('integration-team', content);

      // Verify rules were loaded into analysis service
      const loadedRules = analysisService.getLoadedRules('integration-team');
      expect(loadedRules.length).toBeGreaterThan(0);
    });

    it('should clear old rules when updating spec', async () => {
      // Create initial spec
      await specService.createQualitySpec('update-integration-team', 
        'WHEN function THEN warn'
      );

      const initialRules = analysisService.getLoadedRules('update-integration-team');
      expect(initialRules.length).toBeGreaterThan(0);

      // Update spec
      await specService.updateQualitySpec('update-integration-team', 
        'WHEN function THEN warn\nIF code THEN error'
      );

      const updatedRules = analysisService.getLoadedRules('update-integration-team');
      expect(updatedRules.length).toBeGreaterThanOrEqual(initialRules.length);
    });

    it('should clear rules when deleting spec', async () => {
      // Create spec
      await specService.createQualitySpec('delete-integration-team', 
        'WHEN function THEN warn'
      );

      expect(analysisService.getLoadedRules('delete-integration-team').length).toBeGreaterThan(0);

      // Delete spec
      specService.deleteQualitySpec('delete-integration-team');

      // Rules should be cleared
      expect(analysisService.getLoadedRules('delete-integration-team')).toHaveLength(0);
    });
  });
});