// Core types for KIRO Code Quality Guardian

export interface FileChangeEvent {
  filePath: string;
  content: string;
  language: string;
  userId: string;
  timestamp: Date;
}

export interface PreCommitEvent {
  userId: string;
  teamId?: string;
  changes: FileChange[];
  commitMessage: string;
  timestamp: Date;
}

export interface FileChange {
  filePath: string;
  content: string;
  language: string;
  changeType: 'added' | 'modified' | 'deleted';
}

export interface CommitResult {
  action: CommitAction;
  message: string;
  violations?: RuleViolation[];
  qualityScore?: number;
  processingTime: number;
}

export enum CommitAction {
  ALLOW = 'allow',
  BLOCK = 'block',
  WARN = 'warn'
}

export interface AnalysisRequest {
  filePath: string;
  content: string;
  language: string;
  userId: string;
  standards?: string[];
  context?: Record<string, any>;
}

export interface RuleViolation {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  line: number;
  column: number;
  rule: string;
  suggestion?: string;
}

export interface AnalysisResult {
  analysisId: string;
  filePath: string;
  violations: RuleViolation[];
  qualityScore: number;
  processingTime: number;
  metadata: {
    language: string;
    linesOfCode: number;
    complexity?: number;
  };
}

export interface QualityFeedback {
  userId: string;
  filePath: string;
  analysis: AnalysisResult;
  responseTime: number;
}

export interface KiroAgentHook {
  onFileChange(event: FileChangeEvent): Promise<void>;
  onPreCommit?(event: PreCommitEvent): Promise<CommitResult>;
}

export interface QualityThresholds {
  minQualityScore: number;
  maxCriticalViolations: number;
  maxErrorViolations: number;
  maxWarningViolations: number;
  blockOnCritical: boolean;
  warnOnLowScore: boolean;
}

export interface QualityGateConfig {
  enabled: boolean;
  thresholds: QualityThresholds;
  excludePatterns: string[];
  teamId?: string;
}

export interface QualityScore {
  overall: number;
  breakdown: {
    violations: number;
    complexity: number;
    maintainability?: number;
    codeMetrics?: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      functionCount: number;
      averageFunctionLength: number;
    };
  };
}