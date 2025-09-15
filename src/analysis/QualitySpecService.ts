import { QualitySpec, SpecParseResult } from './SpecDrivenParser';
import { AnalysisService } from './AnalysisService';

/**
 * Service for managing quality specifications and their lifecycle
 */
export class QualitySpecService {
  private analysisService: AnalysisService;
  private specStorage: Map<string, QualitySpec> = new Map();

  constructor(analysisService: AnalysisService) {
    this.analysisService = analysisService;
    this.initializeDefaultSpecs();
  }

  /**
   * Create a new quality specification from natural language
   */
  async createQualitySpec(
    identifier: string, 
    content: string, 
    metadata?: { version?: string; author?: string; description?: string }
  ): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    
    const spec: QualitySpec = {
      content,
      metadata: {
        version: metadata?.version || '1.0.0',
        author: metadata?.author || 'Unknown',
        description: metadata?.description || `Quality specification for ${identifier}`,
        ...metadata
      }
    };

    // Validate the specification
    const validation = await this.analysisService.validateQualitySpec(spec);
    
    if (validation.isValid) {
      // Store the specification
      this.specStorage.set(identifier, spec);
      
      // Load it into the analysis service
      await this.analysisService.loadQualityStandards(identifier, spec);
      
      return {
        success: true,
        errors: validation.errors,
        warnings: validation.warnings
      };
    } else {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }
  }

  /**
   * Update an existing quality specification
   */
  async updateQualitySpec(
    identifier: string, 
    content: string, 
    metadata?: Partial<QualitySpec['metadata']>
  ): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    
    const existingSpec = this.specStorage.get(identifier);
    if (!existingSpec) {
      return {
        success: false,
        errors: [`Quality specification '${identifier}' not found`],
        warnings: []
      };
    }

    const updatedSpec: QualitySpec = {
      content,
      metadata: {
        ...existingSpec.metadata,
        ...metadata,
        version: this.incrementVersion(existingSpec.metadata?.version || '1.0.0')
      }
    };

    // Validate the updated specification
    const validation = await this.analysisService.validateQualitySpec(updatedSpec);
    
    if (validation.isValid) {
      // Clear old rules
      this.analysisService.clearRules(identifier);
      
      // Store the updated specification
      this.specStorage.set(identifier, updatedSpec);
      
      // Load updated rules
      await this.analysisService.loadQualityStandards(identifier, updatedSpec);
      
      return {
        success: true,
        errors: validation.errors,
        warnings: validation.warnings
      };
    } else {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }
  }

  /**
   * Get a quality specification
   */
  getQualitySpec(identifier: string): QualitySpec | null {
    return this.specStorage.get(identifier) || null;
  }

  /**
   * Delete a quality specification
   */
  deleteQualitySpec(identifier: string): boolean {
    const existed = this.specStorage.has(identifier);
    if (existed) {
      this.specStorage.delete(identifier);
      this.analysisService.clearRules(identifier);
    }
    return existed;
  }

  /**
   * List all quality specifications
   */
  listQualitySpecs(): Array<{ identifier: string; spec: QualitySpec }> {
    return Array.from(this.specStorage.entries()).map(([identifier, spec]) => ({
      identifier,
      spec
    }));
  }

  /**
   * Import quality specification from various formats
   */
  async importQualitySpec(
    identifier: string,
    source: string,
    format: 'markdown' | 'yaml' | 'json' | 'plain'
  ): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    
    try {
      let content: string;
      
      switch (format) {
        case 'markdown':
          content = this.extractFromMarkdown(source);
          break;
        case 'yaml':
          content = this.extractFromYaml(source);
          break;
        case 'json':
          content = this.extractFromJson(source);
          break;
        case 'plain':
        default:
          content = source;
          break;
      }

      return await this.createQualitySpec(identifier, content, {
        description: `Imported ${format} specification`
      });
      
    } catch (error) {
      return {
        success: false,
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Export quality specification to different formats
   */
  exportQualitySpec(identifier: string, format: 'markdown' | 'yaml' | 'json' | 'plain'): string | null {
    const spec = this.specStorage.get(identifier);
    if (!spec) {
      return null;
    }

    switch (format) {
      case 'markdown':
        return this.exportToMarkdown(spec);
      case 'yaml':
        return this.exportToYaml(spec);
      case 'json':
        return this.exportToJson(spec);
      case 'plain':
      default:
        return spec.content;
    }
  }

  /**
   * Get statistics about loaded specifications
   */
  getSpecificationStats(): {
    totalSpecs: number;
    totalRules: number;
    specsByIdentifier: Array<{ identifier: string; ruleCount: number; version: string }>;
  } {
    const specs = this.listQualitySpecs();
    const totalRules = specs.reduce((sum, { identifier }) => {
      return sum + this.analysisService.getLoadedRules(identifier).length;
    }, 0);

    return {
      totalSpecs: specs.length,
      totalRules,
      specsByIdentifier: specs.map(({ identifier, spec }) => ({
        identifier,
        ruleCount: this.analysisService.getLoadedRules(identifier).length,
        version: spec.metadata?.version || '1.0.0'
      }))
    };
  }

  private initializeDefaultSpecs(): void {
    // Load some default quality specifications
    const defaultSpecs = [
      {
        identifier: 'typescript-basic',
        content: `# TypeScript Basic Quality Rules

WHEN function has more than 20 lines THEN warn about complexity
WHEN variable name is less than 3 characters THEN suggest longer names  
WHEN code contains console.log THEN warn about debug statements
IF code uses var declaration THEN flag for modernization
WHEN line length exceeds 120 characters THEN suggest line breaking`,
        metadata: {
          version: '1.0.0',
          author: 'KIRO Team',
          description: 'Basic TypeScript quality rules'
        }
      },
      {
        identifier: 'general-quality',
        content: `# General Code Quality Rules

WHEN code has no comments THEN suggest adding documentation
WHEN function name contains "temp" or "test" THEN flag for review
IF TODO comment exists THEN suggest creating proper task
WHEN code duplicates patterns THEN suggest refactoring
WHEN error handling is missing THEN warn about robustness`,
        metadata: {
          version: '1.0.0',
          author: 'KIRO Team',
          description: 'General code quality guidelines'
        }
      }
    ];

    // Load default specs asynchronously
    Promise.all(
      defaultSpecs.map(spec => 
        this.createQualitySpec(spec.identifier, spec.content, spec.metadata)
      )
    ).then(() => {
      console.log('Default quality specifications loaded');
    }).catch(error => {
      console.warn('Failed to load default specifications:', error);
    });
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length >= 3) {
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    return version;
  }

  private extractFromMarkdown(source: string): string {
    // Extract code quality rules from markdown
    const lines = source.split('\n');
    const rules: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that look like rules (including list items)
      if (trimmed.match(/^-?\s*(WHEN|IF|Function|Variable|Code)\s+.+/i)) {
        // Remove list marker if present
        const rule = trimmed.replace(/^-\s*/, '');
        rules.push(rule);
      }
    }
    
    return rules.join('\n');
  }

  private extractFromYaml(source: string): string {
    // Simple YAML extraction - in a real implementation, use a YAML parser
    const lines = source.split('\n');
    const rules: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && trimmed.match(/(WHEN|IF)/i)) {
        rules.push(trimmed.substring(2));
      }
    }
    
    return rules.join('\n');
  }

  private extractFromJson(source: string): string {
    try {
      const parsed = JSON.parse(source);
      if (parsed.rules && Array.isArray(parsed.rules)) {
        return parsed.rules.join('\n');
      }
      if (typeof parsed.content === 'string') {
        return parsed.content;
      }
      return source;
    } catch {
      return source;
    }
  }

  private exportToMarkdown(spec: QualitySpec): string {
    const metadata = spec.metadata;
    let markdown = `# Quality Specification: ${metadata?.description || 'Untitled'}\n\n`;
    
    if (metadata?.version) {
      markdown += `**Version:** ${metadata.version}\n`;
    }
    if (metadata?.author) {
      markdown += `**Author:** ${metadata.author}\n`;
    }
    
    markdown += '\n## Rules\n\n';
    
    const rules = spec.content.split('\n').filter(line => line.trim());
    for (const rule of rules) {
      markdown += `- ${rule}\n`;
    }
    
    return markdown;
  }

  private exportToYaml(spec: QualitySpec): string {
    const rules = spec.content.split('\n').filter(line => line.trim());
    let yaml = `metadata:\n`;
    yaml += `  version: "${spec.metadata?.version || '1.0.0'}"\n`;
    yaml += `  author: "${spec.metadata?.author || 'Unknown'}"\n`;
    yaml += `  description: "${spec.metadata?.description || 'Quality specification'}"\n`;
    yaml += `rules:\n`;
    
    for (const rule of rules) {
      yaml += `  - "${rule}"\n`;
    }
    
    return yaml;
  }

  private exportToJson(spec: QualitySpec): string {
    const rules = spec.content.split('\n').filter(line => line.trim());
    return JSON.stringify({
      metadata: spec.metadata,
      rules: rules
    }, null, 2);
  }
}