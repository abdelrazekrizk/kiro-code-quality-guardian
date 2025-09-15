import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { NotificationService } from '../notifications/NotificationService';
import { QualityFeedback, AnalysisResult } from '../types';

describe('Real-Time Feedback System', () => {
  let notificationService: NotificationService;
  let testPort: number;

  beforeEach(async () => {
    testPort = 8081; // Use different port for testing
    notificationService = new NotificationService(testPort);
    await notificationService.initialize();
  });

  afterEach(async () => {
    await notificationService.shutdown();
  });

  it('should establish WebSocket connection with user ID', (done) => {
    const userId = 'test-user-1';
    const ws = new WebSocket(`ws://localhost:${testPort}?userId=${userId}`);

    ws.on('open', () => {
      expect(notificationService.getActiveConnections()).toBe(1);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connection-established') {
        expect(message.data.userId).toBe(userId);
        expect(message.data.capabilities).toContain('real-time-feedback');
        expect(message.data.capabilities).toContain('in-editor-notifications');
        ws.close();
        done();
      }
    });

    ws.on('error', done);
  });

  it('should send formatted real-time feedback', (done) => {
    const userId = 'test-user-2';
    const ws = new WebSocket(`ws://localhost:${testPort}?userId=${userId}`);
    let messagesReceived = 0;
    const expectedMessages = ['connection-established', 'quality-feedback', 'in-editor-notification'];

    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connection-established') {
        // Send test feedback after connection is established
        const mockFeedback: QualityFeedback = {
          userId,
          filePath: 'test.ts',
          responseTime: 100,
          analysis: {
            analysisId: 'test-analysis',
            filePath: 'test.ts',
            qualityScore: 75,
            processingTime: 100,
            violations: [
              {
                id: 'test-violation',
                severity: 'warning',
                message: 'Test violation message',
                line: 5,
                column: 10,
                rule: 'test-rule',
                suggestion: 'Test suggestion'
              }
            ],
            metadata: {
              language: 'typescript',
              linesOfCode: 20
            }
          }
        };

        await notificationService.sendRealTimeFeedback(mockFeedback);
      } else if (message.type === 'quality-feedback') {
        expect(message.data.filePath).toBe('test.ts');
        expect(message.data.analysis.qualityScore).toBe(75);
        expect(message.data.formatted.summary.qualityScore).toBe(75);
        expect(message.data.formatted.summary.totalViolations).toBe(1);
        expect(message.data.formatted.notifications.length).toBeGreaterThan(0);
        messagesReceived++;
      } else if (message.type === 'in-editor-notification') {
        expect(message.data.filePath).toBe('test.ts');
        expect(['inline', 'status-bar', 'gutter']).toContain(message.data.type);
        messagesReceived++;
        
        // Check if we received all expected messages
        if (messagesReceived >= 2) { // quality-feedback + at least one in-editor-notification
          ws.close();
          done();
        }
      }
    });

    ws.on('error', done);
  });

  it('should handle client ping/pong', (done) => {
    const userId = 'test-user-3';
    const ws = new WebSocket(`ws://localhost:${testPort}?userId=${userId}`);

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connection-established') {
        // Send ping
        ws.send(JSON.stringify({
          type: 'ping',
          data: { timestamp: Date.now() }
        }));
      } else if (message.type === 'pong') {
        expect(message.data.timestamp).toBeDefined();
        ws.close();
        done();
      }
    });

    ws.on('error', done);
  });

  it('should handle test feedback requests', (done) => {
    const userId = 'test-user-4';
    const ws = new WebSocket(`ws://localhost:${testPort}?userId=${userId}`);
    let receivedTestFeedback = false;

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connection-established') {
        // Request test feedback
        ws.send(JSON.stringify({
          type: 'request-test-feedback',
          data: { userId }
        }));
      } else if (message.type === 'quality-feedback' && !receivedTestFeedback) {
        receivedTestFeedback = true;
        expect(message.data.analysis.violations.length).toBeGreaterThan(0);
        expect(message.data.formatted.summary.qualityScore).toBeDefined();
        ws.close();
        done();
      }
    });

    ws.on('error', done);
  });

  it('should format violations correctly', () => {
    const mockAnalysis: AnalysisResult = {
      analysisId: 'test',
      filePath: 'test.ts',
      qualityScore: 60,
      processingTime: 100,
      violations: [
        {
          id: 'critical-violation',
          severity: 'critical',
          message: 'Critical security issue',
          line: 1,
          column: 1,
          rule: 'security-rule'
        },
        {
          id: 'warning-violation',
          severity: 'warning',
          message: 'Code style issue',
          line: 5,
          column: 10,
          rule: 'style-rule',
          suggestion: 'Use const instead of let'
        }
      ],
      metadata: {
        language: 'typescript',
        linesOfCode: 50
      }
    };

    const mockFeedback: QualityFeedback = {
      userId: 'test-user',
      filePath: 'test.ts',
      responseTime: 100,
      analysis: mockAnalysis
    };

    // Access the private method through type assertion for testing
    const service = notificationService as any;
    const formatted = service.formatFeedbackForEditor(mockFeedback);

    expect(formatted.summary.qualityScore).toBe(60);
    expect(formatted.summary.totalViolations).toBe(2);
    expect(formatted.summary.criticalCount).toBe(1);
    expect(formatted.summary.warningCount).toBe(1);
    expect(formatted.notifications.length).toBeGreaterThan(0);
    
    // Check for status bar notification
    const statusBarNotification = formatted.notifications.find(n => n.type === 'status-bar');
    expect(statusBarNotification).toBeDefined();
    expect(statusBarNotification?.message).toContain('Quality Score: 60/100');
    
    // Check for inline notifications
    const inlineNotifications = formatted.notifications.filter(n => n.type === 'inline');
    expect(inlineNotifications.length).toBe(2);
    
    // Check quick fixes
    const quickFixesWithSuggestions = formatted.quickFixes.filter(qf => qf.description.includes('const'));
    expect(quickFixesWithSuggestions.length).toBeGreaterThan(0);
  });

  it('should maintain connection health with ping/pong', (done) => {
    const userId = 'test-user-5';
    const ws = new WebSocket(`ws://localhost:${testPort}?userId=${userId}`);

    ws.on('open', () => {
      expect(notificationService.getActiveConnections()).toBe(1);
      
      // Simulate connection health check
      setTimeout(() => {
        expect(notificationService.getActiveConnections()).toBe(1);
        ws.close();
        done();
      }, 100);
    });

    ws.on('error', done);
  });
});