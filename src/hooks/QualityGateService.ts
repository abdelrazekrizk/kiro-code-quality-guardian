import { 
  PreCommitEvent, 
  CommitResult, 
  CommitAction, 
  RuleViolation, 
  QualityGateConfig,
  AnalysisResult 
} from '../types';
import { AnalysisService } from '../analysis/AnalysisService';
import { QualityGateConfigService } from '../config/QualityGateConfig';

export class QualityGateService {
  private analysisService: AnalysisService;
  private configService: QualityGateConfigService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.configService = new QualityGateConfigService();
  }

  async enforceQualityGate(event: PreCommitEvent): Promise<CommitResult> {
    const startTime = Date.now();
    
    try {
      // Get quality gate configuration for the team
      const config = this.configService.getConfig(event.teamId);
      
      if (!config.enabled) {
        return {
          action: CommitAction.ALLOW,
          message: 'Quality gate is disabled',
          processingTime: Date.now() - startTime
        };
      }

      // Filter out excluded files
      const filesToAnalyze = event.changes.filter(change => 
        change.changeType !== 'deleted' && 
        !this.configService.isFileExcluded(change.filePath, config)
      );

      if (filesToAnalyze.length === 0) {
        return {
          action: CommitAction.ALLOW,
          message: 'No files to analyze (all excluded or deleted)',
          processingTime: Date.now() - startTime
        };
      }

      // Analyze all changed files
      const analysisResults: AnalysisResult[] = [];
      for (const change of filesToAnalyze) {
        try {
          const result = await this.analysisService.analyzeCode({
            filePath: change.filePath,
            content: change.content,
            language: change.language,
            userId: event.userId
          });
          analysisResults.push(result);
        } catch (error) {
          console.warn(`Failed to analyze ${change.filePath}:`, error);
          // Continue with other files
        }
      }

      // Aggregate results and make decision
      const aggregatedResult = this.aggregateAnalysisResults(analysisResults);
      const decision = this.makeQualityGateDecision(aggregatedResult, config);

      return {
        action: decision.action,
        message: decision.message,
        violations: aggregatedResult.allViolations,
        qualityScore: aggregatedResult.averageQualityScore,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Quality gate enforcement failed:', error);
      return {
        action: CommitAction.WARN,
        message: `Quality gate check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  private aggregateAnalysisResults(results: AnalysisResult[]): AggregatedAnalysis {
    if (results.length === 0) {
      return {
        totalFiles: 0,
        averageQualityScore: 100,
        allViolations: [],
        violationCounts: {
          critical: 0,
          error: 0,
          warning: 0,
          info: 0
        }
      };
    }

    const allViolations: RuleViolation[] = [];
    let totalQualityScore = 0;

    const violationCounts = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0
    };

    for (const result of results) {
      allViolations.push(...result.violations);
      totalQualityScore += result.qualityScore;

      // Count violations by severity
      for (const violation of result.violations) {
        violationCounts[violation.severity]++;
      }
    }

    return {
      totalFiles: results.length,
      averageQualityScore: Math.round(totalQualityScore / results.length),
      allViolations,
      violationCounts
    };
  }

  private makeQualityGateDecision(
    analysis: AggregatedAnalysis, 
    config: QualityGateConfig
  ): QualityGateDecision {
    const { thresholds } = config;
    const { violationCounts, averageQualityScore } = analysis;

    // Check for critical violations (always block if configured)
    if (thresholds.blockOnCritical && violationCounts.critical > thresholds.maxCriticalViolations) {
      return {
        action: CommitAction.BLOCK,
        message: `Commit blocked: ${violationCounts.critical} critical violation(s) found (max allowed: ${thresholds.maxCriticalViolations})`
      };
    }

    // Check error violations
    if (violationCounts.error > thresholds.maxErrorViolations) {
      return {
        action: CommitAction.BLOCK,
        message: `Commit blocked: ${violationCounts.error} error violation(s) found (max allowed: ${thresholds.maxErrorViolations})`
      };
    }

    // Check warning violations
    if (violationCounts.warning > thresholds.maxWarningViolations) {
      return {
        action: CommitAction.BLOCK,
        message: `Commit blocked: ${violationCounts.warning} warning violation(s) found (max allowed: ${thresholds.maxWarningViolations})`
      };
    }

    // Check quality score
    if (averageQualityScore < thresholds.minQualityScore) {
      if (thresholds.warnOnLowScore) {
        return {
          action: CommitAction.WARN,
          message: `Quality score is ${averageQualityScore}/100 (minimum required: ${thresholds.minQualityScore}). Consider improving code quality before committing.`
        };
      } else {
        return {
          action: CommitAction.BLOCK,
          message: `Commit blocked: Quality score is ${averageQualityScore}/100 (minimum required: ${thresholds.minQualityScore})`
        };
      }
    }

    // All checks passed
    const violationSummary = this.createViolationSummary(violationCounts);
    return {
      action: CommitAction.ALLOW,
      message: `Quality gate passed. ${violationSummary} Quality score: ${averageQualityScore}/100`
    };
  }

  private createViolationSummary(counts: ViolationCounts): string {
    const parts: string[] = [];
    
    if (counts.critical > 0) parts.push(`${counts.critical} critical`);
    if (counts.error > 0) parts.push(`${counts.error} error(s)`);
    if (counts.warning > 0) parts.push(`${counts.warning} warning(s)`);
    if (counts.info > 0) parts.push(`${counts.info} info`);

    if (parts.length === 0) {
      return 'No violations found.';
    }

    return `Found: ${parts.join(', ')}.`;
  }

  getConfig(teamId?: string): QualityGateConfig {
    return this.configService.getConfig(teamId);
  }

  updateConfig(teamId: string, config: Partial<QualityGateConfig>): void {
    this.configService.updateConfig(teamId, config);
  }
}

interface AggregatedAnalysis {
  totalFiles: number;
  averageQualityScore: number;
  allViolations: RuleViolation[];
  violationCounts: ViolationCounts;
}

interface ViolationCounts {
  critical: number;
  error: number;
  warning: number;
  info: number;
}

interface QualityGateDecision {
  action: CommitAction;
  message: string;
}