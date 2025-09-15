import WebSocket, { WebSocketServer } from 'ws';
import { QualityFeedback, RuleViolation, AnalysisResult } from '../types';

// Extend WebSocket interface to include isAlive property
declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
  }
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  messageId: string;
}

export interface InEditorNotification {
  type: 'inline' | 'popup' | 'status-bar' | 'gutter';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  filePath: string;
  line?: number;
  column?: number;
  duration?: number; // milliseconds
  actionable?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'fix' | 'ignore' | 'learn-more' | 'configure';
  data?: any;
}

export interface FormattedFeedback {
  summary: {
    qualityScore: number;
    totalViolations: number;
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  notifications: InEditorNotification[];
  quickFixes: QuickFix[];
  trends: QualityTrend[];
}

export interface QuickFix {
  id: string;
  title: string;
  description: string;
  filePath: string;
  line: number;
  column: number;
  replacement: string;
  confidence: number;
}

export interface QualityTrend {
  metric: string;
  current: number;
  previous: number;
  trend: 'improving' | 'declining' | 'stable';
  change: number;
}

export class NotificationService {
  private connections: Map<string, WebSocket> = new Map();
  private server: WebSocketServer | null = null;
  private messageIdCounter: number = 0;

  constructor(private port: number = 8080) {}

  async initialize(): Promise<void> {
    this.server = new WebSocketServer({ 
      port: this.port,
      perMessageDeflate: false // Disable compression for faster real-time updates
    });
    
    this.server.on('connection', (ws: WebSocket, request) => {
      const userId = this.extractUserIdFromRequest(request);
      
      if (userId) {
        this.connections.set(userId, ws);
        console.log(`User ${userId} connected for real-time feedback`);
        
        // Set up ping/pong for connection health
        (ws as any).isAlive = true;
        ws.on('pong', () => {
          (ws as any).isAlive = true;
        });
        
        ws.on('message', (data) => {
          this.handleClientMessage(userId, data.toString());
        });
        
        ws.on('close', () => {
          this.connections.delete(userId);
          console.log(`User ${userId} disconnected`);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error);
          this.connections.delete(userId);
        });

        // Send connection confirmation with capabilities
        const connectionMessage = this.createMessage('connection-established', { 
          userId, 
          timestamp: new Date().toISOString(),
          capabilities: [
            'real-time-feedback',
            'in-editor-notifications',
            'quick-fixes',
            'quality-trends'
          ]
        });
        this.sendMessage(ws, connectionMessage);
      } else {
        ws.close(1008, 'User ID required');
      }
    });

    // Set up connection health monitoring
    this.startHealthCheck();

    console.log(`Notification service listening on port ${this.port}`);
  }

  async sendRealTimeFeedback(feedback: QualityFeedback): Promise<void> {
    const connection = this.connections.get(feedback.userId);
    
    if (connection && connection.readyState === WebSocket.OPEN) {
      // Format the feedback for in-editor display
      const formattedFeedback = this.formatFeedbackForEditor(feedback);
      
      const message = this.createMessage('quality-feedback', {
        filePath: feedback.filePath,
        analysis: feedback.analysis,
        responseTime: feedback.responseTime,
        formatted: formattedFeedback
      });

      this.sendMessage(connection, message);
      
      // Send individual in-editor notifications
      for (const notification of formattedFeedback.notifications) {
        const notificationMessage = this.createMessage('in-editor-notification', notification);
        this.sendMessage(connection, notificationMessage);
      }

      console.log(`Sent real-time feedback to user ${feedback.userId} for ${feedback.filePath} (${formattedFeedback.notifications.length} notifications)`);
    } else {
      console.warn(`No active connection for user ${feedback.userId}`);
    }
  }

  private formatFeedbackForEditor(feedback: QualityFeedback): FormattedFeedback {
    const analysis = feedback.analysis;
    const violations = analysis.violations;
    
    // Calculate summary statistics
    const summary = {
      qualityScore: analysis.qualityScore,
      totalViolations: violations.length,
      criticalCount: violations.filter(v => v.severity === 'critical').length,
      errorCount: violations.filter(v => v.severity === 'error').length,
      warningCount: violations.filter(v => v.severity === 'warning').length,
      infoCount: violations.filter(v => v.severity === 'info').length
    };

    // Create in-editor notifications
    const notifications: InEditorNotification[] = [];
    
    // Add status bar notification for overall quality
    notifications.push({
      type: 'status-bar',
      severity: this.getOverallSeverity(analysis.qualityScore),
      message: `Quality Score: ${analysis.qualityScore}/100 (${violations.length} issues)`,
      filePath: feedback.filePath,
      duration: 5000,
      actionable: true,
      actions: [
        { id: 'view-details', label: 'View Details', type: 'learn-more' },
        { id: 'configure-rules', label: 'Configure Rules', type: 'configure' }
      ]
    });

    // Add inline notifications for each violation
    violations.forEach(violation => {
      notifications.push({
        type: 'inline',
        severity: violation.severity,
        message: this.formatViolationMessage(violation),
        filePath: feedback.filePath,
        line: violation.line,
        column: violation.column,
        actionable: !!violation.suggestion,
        actions: violation.suggestion ? [
          { id: 'apply-fix', label: 'Apply Fix', type: 'fix', data: { suggestion: violation.suggestion } },
          { id: 'ignore-rule', label: 'Ignore Rule', type: 'ignore', data: { ruleId: violation.rule } }
        ] : []
      });
    });

    // Add gutter markers for critical/error violations
    const criticalViolations = violations.filter(v => v.severity === 'critical' || v.severity === 'error');
    criticalViolations.forEach(violation => {
      notifications.push({
        type: 'gutter',
        severity: violation.severity,
        message: `${violation.rule}: ${violation.message}`,
        filePath: feedback.filePath,
        line: violation.line,
        actionable: true,
        actions: [
          { id: 'show-details', label: 'Show Details', type: 'learn-more' }
        ]
      });
    });

    // Generate quick fixes
    const quickFixes = this.generateQuickFixes(violations, feedback.filePath);

    // Generate quality trends (mock data for demo)
    const trends = this.generateQualityTrends(analysis);

    return {
      summary,
      notifications,
      quickFixes,
      trends
    };
  }

  private formatViolationMessage(violation: RuleViolation): string {
    const prefix = this.getSeverityPrefix(violation.severity);
    let message = `${prefix}${violation.message}`;
    
    if (violation.suggestion) {
      message += ` (Suggestion: ${violation.suggestion})`;
    }
    
    return message;
  }

  private getSeverityPrefix(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨 ';
      case 'error': return '❌ ';
      case 'warning': return '⚠️ ';
      case 'info': return 'ℹ️ ';
      default: return '';
    }
  }

  private getOverallSeverity(qualityScore: number): 'info' | 'warning' | 'error' | 'critical' {
    if (qualityScore >= 80) return 'info';
    if (qualityScore >= 60) return 'warning';
    if (qualityScore >= 40) return 'error';
    return 'critical';
  }

  private generateQuickFixes(violations: RuleViolation[], filePath: string): QuickFix[] {
    return violations
      .filter(v => v.suggestion)
      .map((violation, index) => ({
        id: `fix-${index}`,
        title: `Fix ${violation.rule}`,
        description: violation.suggestion!,
        filePath,
        line: violation.line,
        column: violation.column,
        replacement: this.generateReplacement(violation),
        confidence: this.calculateFixConfidence(violation)
      }));
  }

  private generateReplacement(violation: RuleViolation): string {
    // Simple replacement logic based on common patterns
    switch (violation.rule) {
      case 'no-var':
        return violation.suggestion?.replace('var ', 'const ') || '';
      case 'no-console':
        return '// ' + violation.message.split(':')[1]?.trim() || '';
      default:
        return violation.suggestion || '';
    }
  }

  private calculateFixConfidence(violation: RuleViolation): number {
    // Calculate confidence based on rule type and suggestion quality
    const ruleConfidence: Record<string, number> = {
      'no-var': 0.95,
      'no-console': 0.85,
      'prefer-const': 0.90,
      'no-unused-vars': 0.80
    };
    
    return ruleConfidence[violation.rule] || 0.70;
  }

  private generateQualityTrends(analysis: AnalysisResult): QualityTrend[] {
    // Mock trend data for demo purposes
    return [
      {
        metric: 'Quality Score',
        current: analysis.qualityScore,
        previous: analysis.qualityScore - 5,
        trend: 'improving',
        change: 5
      },
      {
        metric: 'Violations',
        current: analysis.violations.length,
        previous: analysis.violations.length + 2,
        trend: 'improving',
        change: -2
      }
    ];
  }

  private createMessage(type: string, data: any): WebSocketMessage {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
      messageId: `msg-${++this.messageIdCounter}`
    };
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  private handleClientMessage(userId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ping':
          this.sendPong(userId);
          break;
        case 'subscribe-notifications':
          this.handleNotificationSubscription(userId, message.data);
          break;
        case 'action-response':
          this.handleActionResponse(userId, message.data);
          break;
        case 'request-test-feedback':
          this.handleTestFeedbackRequest(userId);
          break;
        default:
          console.warn(`Unknown message type from user ${userId}:`, message.type);
      }
    } catch (error) {
      console.error(`Failed to parse message from user ${userId}:`, error);
    }
  }

  private async handleTestFeedbackRequest(userId: string): Promise<void> {
    console.log(`Sending test feedback to user ${userId}`);
    await this.sendTestFeedback(userId);
  }

  private sendPong(userId: string): void {
    const connection = this.connections.get(userId);
    if (connection) {
      const pongMessage = this.createMessage('pong', { timestamp: Date.now() });
      this.sendMessage(connection, pongMessage);
    }
  }

  private handleNotificationSubscription(userId: string, data: any): void {
    console.log(`User ${userId} subscribed to notifications:`, data);
    // Store subscription preferences if needed
  }

  private handleActionResponse(userId: string, data: any): void {
    console.log(`User ${userId} performed action:`, data);
    // Handle user actions like applying fixes, ignoring rules, etc.
  }

  private extractUserIdFromRequest(request: any): string | null {
    // Extract user ID from query parameters or headers
    const url = new URL(request.url || '', 'http://localhost');
    return url.searchParams.get('userId');
  }

  private startHealthCheck(): void {
    setInterval(() => {
      this.connections.forEach((ws, userId) => {
        if (!(ws as any).isAlive) {
          console.log(`Terminating inactive connection for user ${userId}`);
          ws.terminate();
          this.connections.delete(userId);
          return;
        }
        
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  async sendTeamNotification(teamId: string, notification: InEditorNotification): Promise<void> {
    // For demo purposes, broadcast to all connected users
    // In production, this would filter by team membership
    const message = this.createMessage('team-notification', {
      teamId,
      notification
    });

    this.connections.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });

    console.log(`Sent team notification to ${this.connections.size} users`);
  }

  async sendSystemAlert(alert: { severity: string; message: string; actionRequired?: boolean }): Promise<void> {
    const message = this.createMessage('system-alert', alert);

    this.connections.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });

    console.log(`Sent system alert to ${this.connections.size} users`);
  }

  async sendQualityTrend(userId: string, trend: QualityTrend): Promise<void> {
    const connection = this.connections.get(userId);
    
    if (connection && connection.readyState === WebSocket.OPEN) {
      const message = this.createMessage('quality-trend', trend);
      this.sendMessage(connection, message);
      console.log(`Sent quality trend to user ${userId}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.server) {
      // Close all connections gracefully
      this.connections.forEach((ws, userId) => {
        const message = this.createMessage('server-shutdown', {
          message: 'Server is shutting down',
          reconnectIn: 5000
        });
        this.sendMessage(ws, message);
        ws.close(1001, 'Server shutdown');
      });

      this.server.close();
      this.connections.clear();
      console.log('Notification service shut down');
    }
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getConnectionStatus(): { userId: string; connected: boolean; lastSeen: string }[] {
    const status: { userId: string; connected: boolean; lastSeen: string }[] = [];
    
    this.connections.forEach((ws, userId) => {
      status.push({
        userId,
        connected: ws.readyState === WebSocket.OPEN,
        lastSeen: new Date().toISOString()
      });
    });

    return status;
  }

  // Method to test real-time feedback with mock data
  async sendTestFeedback(userId: string): Promise<void> {
    const mockFeedback: QualityFeedback = {
      userId,
      filePath: 'test/example.ts',
      responseTime: 150,
      analysis: {
        analysisId: 'test-analysis-' + Date.now(),
        filePath: 'test/example.ts',
        qualityScore: 75,
        processingTime: 150,
        violations: [
          {
            id: 'test-violation-1',
            severity: 'warning',
            message: 'Consider using const instead of let for immutable variables',
            line: 5,
            column: 1,
            rule: 'prefer-const',
            suggestion: 'Replace let with const'
          },
          {
            id: 'test-violation-2',
            severity: 'error',
            message: 'Unused variable detected',
            line: 10,
            column: 7,
            rule: 'no-unused-vars',
            suggestion: 'Remove unused variable or use it'
          }
        ],
        metadata: {
          language: 'typescript',
          linesOfCode: 25,
          complexity: 3
        }
      }
    };

    await this.sendRealTimeFeedback(mockFeedback);
  }
}