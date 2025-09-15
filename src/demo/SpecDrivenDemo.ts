import { AnalysisService } from '../analysis/AnalysisService';
import { QualitySpecService } from '../analysis/QualitySpecService';
import { AnalysisRequest } from '../types';

/**
 * Demo showcasing the Spec-Driven Quality Rules Parser functionality
 */
export class SpecDrivenDemo {
  private analysisService: AnalysisService;
  private specService: QualitySpecService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.specService = new QualitySpecService(this.analysisService);
  }

  async runDemo(): Promise<void> {
    console.log('\n🚀 KIRO Code Quality Guardian - Spec-Driven Parser Demo\n');

    // Demo 1: Create custom quality specifications
    await this.demoCustomSpecCreation();

    // Demo 2: Test spec-driven analysis
    await this.demoSpecDrivenAnalysis();

    // Demo 3: Import/Export specifications
    await this.demoImportExport();

    // Demo 4: Spec validation and error handling
    await this.demoValidationAndErrors();

    // Demo 5: Team-specific quality standards
    await this.demoTeamSpecificStandards();

    console.log('\n✅ Spec-Driven Parser Demo completed successfully!\n');
  }

  private async demoCustomSpecCreation(): Promise<void> {
    console.log('📝 Demo 1: Creating Custom Quality Specifications\n');

    // Create a comprehensive quality specification
    const comprehensiveSpec = `# Comprehensive TypeScript Quality Rules

# Function complexity and structure
WHEN function has more than 25 lines THEN warn about complexity
WHEN function has more than 5 parameters THEN suggest parameter object
IF function name contains "temp" or "test" THEN flag for review

# Variable and naming conventions  
variable names should be descriptive and meaningful
WHEN variable name is less than 3 characters THEN suggest longer names
class names must use PascalCase convention

# Code quality and best practices
WHEN code contains console.log THEN warn about debug statements
IF code uses var declaration THEN flag for modernization
WHEN line length exceeds 120 characters THEN suggest line breaking

# Documentation requirements
WHEN function has no comments THEN suggest adding documentation
code should have proper JSDoc comments for public methods

# Error handling
WHEN try block has no catch THEN warn about error handling
functions should handle edge cases properly

# Performance considerations
WHEN loop nesting exceeds 3 levels THEN warn about complexity
IF code duplicates logic THEN suggest refactoring`;

    const result = await this.specService.createQualitySpec(
      'comprehensive-typescript',
      comprehensiveSpec,
      {
        version: '1.0.0',
        author: 'KIRO Demo Team',
        description: 'Comprehensive TypeScript quality standards'
      }
    );

    console.log(`✅ Created comprehensive spec: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.errors.length > 0) {
      console.log('❌ Errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:', result.warnings);
    }

    // Create a simpler team-specific spec
    const teamSpec = `# Frontend Team Quality Rules

WHEN React component has more than 200 lines THEN suggest splitting
WHEN useState is used more than 5 times THEN suggest useReducer
IF component has no PropTypes THEN warn about type safety
WHEN CSS-in-JS exceeds 50 lines THEN suggest external stylesheet`;

    const teamResult = await this.specService.createQualitySpec(
      'frontend-team',
      teamSpec,
      {
        version: '1.0.0',
        author: 'Frontend Team Lead',
        description: 'Frontend team specific quality rules'
      }
    );

    console.log(`✅ Created team spec: ${teamResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log();
  }

  private async demoSpecDrivenAnalysis(): Promise<void> {
    console.log('🔍 Demo 2: Spec-Driven Code Analysis\n');

    // Sample code with various quality issues
    const sampleCode = `var globalVariable = "should use let or const";

console.log("Debug statement that should be removed");

// This function has multiple quality issues
function calculateSomethingVeryComplexAndLongNamedThatExceedsReasonableLength(param1, param2, param3, param4, param5, param6) {
  // No documentation
  // Too many parameters
  // Long function name
  // Uses var
  var result = 0;
  
  try {
    for (let i = 0; i < param1.length; i++) {
      for (let j = 0; j < param2.length; j++) {
        for (let k = 0; k < param3.length; k++) {
          for (let l = 0; l < param4.length; l++) {
            // Nested loops exceed 3 levels
            result += param1[i] * param2[j] * param3[k] * param4[l];
          }
        }
      }
    }
  } catch (error) {
    // Has error handling - good!
    console.log("Error occurred:", error);
  }
  
  return result;
}

// Another function with issues
function temp() {
  // Function name contains "temp"
  var x = 1; // Short variable name, uses var
  return x;
}

class myClass {
  // Class name should use PascalCase
  constructor() {
    this.data = [];
  }
}`;

    // Analyze with comprehensive spec
    const analysisRequest: AnalysisRequest = {
      filePath: 'demo/sample.ts',
      content: sampleCode,
      language: 'typescript',
      userId: 'demo-user',
      standards: ['comprehensive-typescript'],
      context: {
        teamId: 'comprehensive-typescript'
      }
    };

    console.log('Analyzing sample code with comprehensive TypeScript rules...\n');
    
    const result = await this.analysisService.analyzeCode(analysisRequest);

    console.log(`📊 Analysis Results:`);
    console.log(`   Quality Score: ${result.qualityScore}/100`);
    console.log(`   Processing Time: ${result.processingTime}ms`);
    console.log(`   Lines of Code: ${result.metadata.linesOfCode}`);
    console.log(`   Total Violations: ${result.violations.length}\n`);

    // Group violations by severity
    const violationsBySeverity = result.violations.reduce((acc, violation) => {
      acc[violation.severity] = (acc[violation.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📈 Violations by Severity:');
    Object.entries(violationsBySeverity).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : severity === 'error' ? '🟠' : severity === 'warning' ? '🟡' : '🔵';
      console.log(`   ${emoji} ${severity}: ${count}`);
    });

    console.log('\n🔍 Detailed Violations:');
    result.violations.slice(0, 8).forEach((violation, index) => {
      console.log(`   ${index + 1}. [${violation.severity.toUpperCase()}] Line ${violation.line}: ${violation.message}`);
      if (violation.suggestion) {
        console.log(`      💡 Suggestion: ${violation.suggestion}`);
      }
    });

    if (result.violations.length > 8) {
      console.log(`   ... and ${result.violations.length - 8} more violations`);
    }

    console.log();
  }

  private async demoImportExport(): Promise<void> {
    console.log('📤 Demo 3: Import/Export Quality Specifications\n');

    // Demo markdown import
    const markdownSpec = `# Backend API Quality Rules

**Version:** 2.0.0
**Author:** Backend Team

## Rules

- WHEN API endpoint has no authentication THEN flag security issue
- WHEN database query has no error handling THEN warn about robustness
- IF function returns sensitive data THEN ensure proper sanitization
- WHEN API response exceeds 5MB THEN suggest pagination
- code should follow REST conventions properly`;

    console.log('📥 Importing specification from Markdown...');
    const importResult = await this.specService.importQualitySpec(
      'backend-api',
      markdownSpec,
      'markdown'
    );

    console.log(`   Import result: ${importResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (importResult.warnings.length > 0) {
      console.log(`   Warnings: ${importResult.warnings.length}`);
    }

    // Demo JSON export
    console.log('\n📤 Exporting specification to JSON...');
    const jsonExport = this.specService.exportQualitySpec('backend-api', 'json');
    
    if (jsonExport) {
      const parsed = JSON.parse(jsonExport);
      console.log(`   Exported ${parsed.rules.length} rules`);
      console.log(`   Metadata: v${parsed.metadata.version} by ${parsed.metadata.author}`);
    }

    // Demo YAML export
    console.log('\n📤 Exporting specification to YAML...');
    const yamlExport = this.specService.exportQualitySpec('backend-api', 'yaml');
    
    if (yamlExport) {
      console.log('   YAML export preview:');
      console.log(yamlExport.split('\n').slice(0, 8).map(line => `     ${line}`).join('\n'));
      console.log('     ...');
    }

    console.log();
  }

  private async demoValidationAndErrors(): Promise<void> {
    console.log('⚠️  Demo 4: Spec Validation and Error Handling\n');

    // Test with invalid specification
    const invalidSpec = `# Invalid Quality Rules

WHEN THEN
IF THEN
function should
This is not a valid rule at all
WHEN function has more than THEN warn
IF code uses THEN flag`;

    console.log('🔍 Testing with invalid specification...');
    const invalidResult = await this.specService.createQualitySpec(
      'invalid-test',
      invalidSpec
    );

    console.log(`   Creation result: ${invalidResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Errors found: ${invalidResult.errors.length}`);
    console.log(`   Warnings: ${invalidResult.warnings.length}`);

    if (invalidResult.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      invalidResult.errors.slice(0, 3).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (invalidResult.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      invalidResult.warnings.slice(0, 3).forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    // Test with partially valid specification
    const partiallyValidSpec = `# Partially Valid Rules

WHEN function has more than 20 lines THEN warn about complexity
This line will be parsed as generic rule with low confidence
IF code uses var declaration THEN flag for modernization
Another unparseable line that should generate warnings
WHEN variable name is less than 3 characters THEN suggest longer names`;

    console.log('\n🔍 Testing with partially valid specification...');
    const partialResult = await this.specService.createQualitySpec(
      'partial-test',
      partiallyValidSpec
    );

    console.log(`   Creation result: ${partialResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Errors: ${partialResult.errors.length}`);
    console.log(`   Warnings: ${partialResult.warnings.length}`);

    console.log();
  }

  private async demoTeamSpecificStandards(): Promise<void> {
    console.log('👥 Demo 5: Team-Specific Quality Standards\n');

    // Create different team specifications
    const teams = [
      {
        id: 'mobile-team',
        spec: `# Mobile Development Quality Rules

WHEN React Native component exceeds 150 lines THEN suggest refactoring
WHEN async function has no error handling THEN warn about crashes
IF platform-specific code has no fallback THEN flag compatibility issue
WHEN image assets exceed 1MB THEN suggest optimization
code should follow mobile performance best practices`,
        description: 'Mobile development team standards'
      },
      {
        id: 'security-team',
        spec: `# Security Team Quality Rules

WHEN code contains hardcoded credentials THEN flag security violation
IF user input is not validated THEN warn about injection attacks
WHEN sensitive data is logged THEN flag privacy violation
WHEN encryption is not used for sensitive data THEN flag security issue
code must follow OWASP security guidelines`,
        description: 'Security team standards'
      },
      {
        id: 'performance-team',
        spec: `# Performance Team Quality Rules

WHEN database query has no index THEN warn about performance
IF loop complexity exceeds O(n²) THEN suggest optimization
WHEN memory allocation exceeds threshold THEN flag memory issue
WHEN API response time exceeds 200ms THEN suggest caching
code should be optimized for performance`,
        description: 'Performance team standards'
      }
    ];

    // Create team specifications
    for (const team of teams) {
      console.log(`📋 Creating specification for ${team.id}...`);
      const result = await this.specService.createQualitySpec(
        team.id,
        team.spec,
        {
          version: '1.0.0',
          author: `${team.id} Lead`,
          description: team.description
        }
      );
      console.log(`   Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    }

    // Show statistics
    console.log('\n📊 Quality Specification Statistics:');
    const stats = this.specService.getSpecificationStats();
    console.log(`   Total Specifications: ${stats.totalSpecs}`);
    console.log(`   Total Rules: ${stats.totalRules}`);
    console.log(`   Average Rules per Spec: ${Math.round(stats.totalRules / stats.totalSpecs)}`);

    console.log('\n📋 Specifications by Team:');
    stats.specsByIdentifier
      .filter(spec => ['mobile-team', 'security-team', 'performance-team'].includes(spec.identifier))
      .forEach(spec => {
        console.log(`   ${spec.identifier}: ${spec.ruleCount} rules (v${spec.version})`);
      });

    // Test team-specific analysis
    console.log('\n🔍 Testing team-specific analysis...');
    
    const securityTestCode = `const API_KEY = "hardcoded-secret-key-123";

function processUserInput(userInput) {
  // No input validation
  const query = "SELECT * FROM users WHERE id = " + userInput;
  
  console.log("Processing user:", userInput); // Logging sensitive data
  
  return database.query(query);
}`;

    const securityAnalysis = await this.analysisService.analyzeCode({
      filePath: 'security-test.js',
      content: securityTestCode,
      language: 'javascript',
      userId: 'security-demo',
      context: { teamId: 'security-team' }
    });

    console.log(`   Security Analysis - Quality Score: ${securityAnalysis.qualityScore}/100`);
    console.log(`   Security Violations: ${securityAnalysis.violations.length}`);
    
    const securityViolations = securityAnalysis.violations.filter(v => 
      v.message.toLowerCase().includes('security') || 
      v.message.toLowerCase().includes('credential') ||
      v.message.toLowerCase().includes('sensitive')
    );
    
    console.log(`   Security-specific violations: ${securityViolations.length}`);

    console.log();
  }
}

// Export for use in main demo
export async function runSpecDrivenDemo(): Promise<void> {
  const demo = new SpecDrivenDemo();
  await demo.runDemo();
}