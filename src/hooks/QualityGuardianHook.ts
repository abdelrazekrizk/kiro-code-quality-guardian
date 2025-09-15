import { KiroAgentHook, FileChangeEvent, PreCommitEvent, CommitResult, QualityFeedback } from '../types';
import { AnalysisService } from '../analysis/AnalysisService';
import { NotificationService } from '../notifications/NotificationService';
import { QualityGateService } from './QualityGateService';

export class QualityGuardianHook implements KiroAgentHook {
  private analysisService: AnalysisService;
  private notificationService: NotificationService;
  private qualityGateService: QualityGateService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.notificationService = new NotificationService();
    this.qualityGateService = new QualityGateService();
  }

  async initialize(): Promise<void> {
    await this.notificationService.initialize();
    console.log('Quality Guardian Hook initialized');
  }

  async onFileChange(event: FileChangeEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing file change: ${event.filePath} for user ${event.userId}`);
      
      // Skip analysis for certain file types
      if (this.shouldSkipAnalysis(event.filePath)) {
        console.log(`Skipping analysis for ${event.filePath} (excluded file type)`);
        return;
      }

      // Analyze code quality
      const analysis = await this.analysisService.analyzeCode({
        filePath: event.filePath,
        content: event.content,
        language: event.language,
        userId: event.userId
      });

      // Send real-time feedback
      const feedback: QualityFeedback = {
        userId: event.userId,
        filePath: event.filePath,
        analysis: analysis,
        responseTime: Date.now() - startTime
      };

      await this.notificationService.sendRealTimeFeedback(feedback);

      // Log analysis results
      this.logAnalysisResults(analysis);

    } catch (error) {
      await this.handleAnalysisError(error, event);
    }
  }

  private shouldSkipAnalysis(filePath: string): boolean {
    const excludedExtensions = ['.md', '.txt', '.json', '.xml', '.yml', '.yaml'];
    const excludedPaths = ['node_modules/', 'dist/', 'build/', '.git/'];
    
    // Check file extension
    const hasExcludedExtension = excludedExtensions.some(ext => 
      filePath.toLowerCase().endsWith(ext)
    );
    
    // Check path patterns
    const hasExcludedPath = excludedPaths.some(path => 
      filePath.includes(path)
    );
    
    return hasExcludedExtension || hasExcludedPath;
  }

  private logAnalysisResults(analysis: any): void {
    const { analysisId, filePath, violations, qualityScore, processingTime } = analysis;
    
    console.log(`Analysis completed: ${analysisId}`);
    console.log(`  File: ${filePath}`);
    console.log(`  Quality Score: ${qualityScore}/100`);
    console.log(`  Violations: ${violations.length}`);
    console.log(`  Processing Time: ${processingTime}ms`);
    
    if (violations.length > 0) {
      console.log('  Violations:');
      violations.forEach((violation: any, index: number) => {
        console.log(`    ${index + 1}. [${violation.severity.toUpperCase()}] Line ${violation.line}: ${violation.message}`);
      });
    }
  }

  private async handleAnalysisError(error: unknown, event: FileChangeEvent): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Analysis failed for ${event.filePath}:`, errorMessage);
    
    // Send error notification to user
    try {
      const errorFeedback: QualityFeedback = {
        userId: event.userId,
        filePath: event.filePath,
        analysis: {
          analysisId: `error_${Date.now()}`,
          filePath: event.filePath,
          violations: [{
            id: 'analysis-error',
            severity: 'error',
            message: `Analysis failed: ${errorMessage}`,
            line: 1,
            column: 1,
            rule: 'system-error'
          }],
          qualityScore: 0,
          processingTime: 0,
          metadata: {
            language: event.language,
            linesOfCode: 0
          }
        },
        responseTime: 0
      };

      await this.notificationService.sendRealTimeFeedback(errorFeedback);
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  async shutdown(): Promise<void> {
    await this.notificationService.shutdown();
    console.log('Quality Guardian Hook shut down');
  }

  async onPreCommit(event: PreCommitEvent): Promise<CommitResult> {
    console.log(`Processing pre-commit for user ${event.userId} with ${event.changes.length} changed files`);
    
    try {
      const result = await this.qualityGateService.enforceQualityGate(event);
      
      // Log the quality gate decision
      this.logQualityGateResult(result, event);
      
      // Send notification about the quality gate result
      await this.sendQualityGateNotification(event.userId, result);
      
      return result;
    } catch (error) {
      console.error('Pre-commit quality gate failed:', error);
      return {
        action: 'warn' as any,
        message: `Quality gate check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: 0
      };
    }
  }

  private logQualityGateResult(result: CommitResult, event: PreCommitEvent): void {
    console.log(`Quality Gate Result for ${event.userId}:`);
    console.log(`  Action: ${result.action.toUpperCase()}`);
    console.log(`  Message: ${result.message}`);
    console.log(`  Processing Time: ${result.processingTime}ms`);
    
    if (result.qualityScore !== undefined) {
      console.log(`  Quality Score: ${result.qualityScore}/100`);
    }
    
    if (result.violations && result.violations.length > 0) {
      console.log(`  Violations: ${result.violations.length}`);
      const severityCounts = result.violations.reduce((counts, violation) => {
        counts[violation.severity] = (counts[violation.severity] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      Object.entries(severityCounts).forEach(([severity, count]) => {
        console.log(`    ${severity}: ${count}`);
      });
    }
  }

  private async sendQualityGateNotification(userId: string, result: CommitResult): Promise<void> {
    try {
      const notification: QualityFeedback = {
        userId,
        filePath: 'pre-commit-check',
        analysis: {
          analysisId: `precommit_${Date.now()}`,
          filePath: 'pre-commit-check',
          violations: result.violations || [],
          qualityScore: result.qualityScore || 0,
          processingTime: result.processingTime,
          metadata: {
            language: 'multi',
            linesOfCode: 0
          }
        },
        responseTime: result.processingTime
      };

      await this.notificationService.sendRealTimeFeedback(notification);
    } catch (error) {
      console.error('Failed to send quality gate notification:', error);
    }
  }

  getQualityGateConfig(teamId?: string) {
    return this.qualityGateService.getConfig(teamId);
  }

  updateQualityGateConfig(teamId: string, config: any): void {
    this.qualityGateService.updateConfig(teamId, config);
  }

  getStatus(): { activeConnections: number } {
    return {
      activeConnections: this.notificationService.getActiveConnections()
    };
  }
}