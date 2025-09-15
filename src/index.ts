import { QualityGuardianHook } from './hooks/QualityGuardianHook';
import { FileChangeEvent, PreCommitEvent, CommitResult } from './types';
import { runSpecDrivenDemo } from './demo/SpecDrivenDemo';

export class KiroCodeQualityGuardian {
  private hook: QualityGuardianHook;

  constructor() {
    this.hook = new QualityGuardianHook();
  }

  async initialize(): Promise<void> {
    await this.hook.initialize();
    console.log('KIRO Code Quality Guardian initialized successfully');
  }

  async processFileChange(event: FileChangeEvent): Promise<void> {
    await this.hook.onFileChange(event);
  }

  async processPreCommit(event: PreCommitEvent): Promise<CommitResult> {
    if (this.hook.onPreCommit) {
      return await this.hook.onPreCommit(event);
    }
    throw new Error('Pre-commit hook not implemented');
  }

  getQualityGateConfig(teamId?: string) {
    return this.hook.getQualityGateConfig(teamId);
  }

  updateQualityGateConfig(teamId: string, config: any): void {
    this.hook.updateQualityGateConfig(teamId, config);
  }

  getStatus() {
    return this.hook.getStatus();
  }

  async shutdown(): Promise<void> {
    await this.hook.shutdown();
  }
}

// Export main classes for external use
export { QualityGuardianHook } from './hooks/QualityGuardianHook';
export { QualityGateService } from './hooks/QualityGateService';
export { QualityGateConfigService } from './config/QualityGateConfig';
export { AnalysisService } from './analysis/AnalysisService';
export { NotificationService } from './notifications/NotificationService';
export { SpecDrivenParser } from './analysis/SpecDrivenParser';
export { QualitySpecService } from './analysis/QualitySpecService';
export * from './types';

// Demo functionality for testing
async function runDemo() {
  const guardian = new KiroCodeQualityGuardian();
  
  try {
    await guardian.initialize();
    
    // Simulate file change events
    const sampleEvents: FileChangeEvent[] = [
      {
        filePath: 'src/example.ts',
        content: `// Example TypeScript file with quality issues
var oldVariable = "should use let or const";
console.log("Debug statement that should be removed");
function veryLongFunctionNameThatExceedsTheRecommendedLengthAndShouldBeBrokenIntoSmallerPiecesForBetterReadability() {
  // TODO: Implement this function properly
  return oldVariable;
}`,
        language: 'typescript',
        userId: 'demo-user-1',
        timestamp: new Date()
      },
      {
        filePath: 'src/example.py',
        content: `# Example Python file
def calculate_something():
    print("Debug output")  # Should use logging
    # TODO: Add proper error handling
    result = 42
    return result`,
        language: 'python',
        userId: 'demo-user-1',
        timestamp: new Date()
      }
    ];

    // Process each sample event
    for (const event of sampleEvents) {
      console.log(`\n--- Processing ${event.filePath} ---`);
      await guardian.processFileChange(event);
      
      // Wait a bit between events
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Demo pre-commit functionality
    console.log('\n--- Testing Pre-Commit Quality Gate ---');
    
    const preCommitEvent: PreCommitEvent = {
      userId: 'demo-user-1',
      teamId: 'default',
      commitMessage: 'Add new features with some quality issues',
      timestamp: new Date(),
      changes: [
        {
          filePath: 'src/badCode.ts',
          content: `// This file has multiple quality issues
var globalVar = "should not use var";
console.log("Debug statement");
function veryLongFunctionNameThatViolatesNamingConventions() {
  // TODO: Fix this
  return globalVar;
}`,
          language: 'typescript',
          changeType: 'added'
        },
        {
          filePath: 'src/goodCode.ts',
          content: `// This file has good quality
const message = "Hello, world!";

export function greet(name: string): string {
  return \`\${message} \${name}!\`;
}`,
          language: 'typescript',
          changeType: 'modified'
        }
      ]
    };

    const commitResult = await guardian.processPreCommit(preCommitEvent);
    console.log('Pre-commit result:', commitResult);

    // Test with strict team configuration
    console.log('\n--- Testing with Strict Team Configuration ---');
    const strictPreCommitEvent: PreCommitEvent = {
      ...preCommitEvent,
      teamId: 'strict-team'
    };

    const strictCommitResult = await guardian.processPreCommit(strictPreCommitEvent);
    console.log('Strict pre-commit result:', strictCommitResult);

    // Show current configuration
    console.log('\n--- Quality Gate Configuration ---');
    console.log('Default config:', JSON.stringify(guardian.getQualityGateConfig(), null, 2));
    console.log('Strict team config:', JSON.stringify(guardian.getQualityGateConfig('strict-team'), null, 2));

    console.log('\n--- Demo Status ---');
    console.log('Guardian Status:', guardian.getStatus());
    
    // Run the spec-driven parser demo
    console.log('\n=== SPEC-DRIVEN PARSER DEMO ===');
    await runSpecDrivenDemo();
    
    // Run the TypeScript analyzer demo
    const { runTypeScriptAnalyzerDemo } = await import('./demo/TypeScriptAnalyzerDemo');
    await runTypeScriptAnalyzerDemo();
    
    // Run the real-time feedback demo
    console.log('\n=== STARTING REAL-TIME FEEDBACK DEMO ===');
    const { runRealTimeFeedbackDemo } = await import('./demo/RealTimeFeedbackDemo');
    await runRealTimeFeedbackDemo();
    
    // Keep the demo running for a bit to show real-time capabilities
    console.log('\nDemo running... Connect WebSocket client to ws://localhost:8080?userId=demo-user-1 to see real-time feedback');
    console.log('Press Ctrl+C to stop the demo');
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}