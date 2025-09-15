import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QualityGuardianHook } from '../hooks/QualityGuardianHook';
import { FileChangeEvent } from '../types';

describe('QualityGuardianHook', () => {
  let hook: QualityGuardianHook;

  beforeEach(async () => {
    hook = new QualityGuardianHook();
    // Don't initialize WebSocket server in tests to avoid port conflicts
  });

  afterEach(async () => {
    if (hook) {
      await hook.shutdown();
    }
  });

  it('should process file change events', async () => {
    const event: FileChangeEvent = {
      filePath: 'src/test.ts',
      content: 'const message = "Hello, world!";',
      language: 'typescript',
      userId: 'test-user',
      timestamp: new Date()
    };

    // This should not throw an error
    await expect(hook.onFileChange(event)).resolves.toBeUndefined();
  });

  it('should skip analysis for excluded file types', async () => {
    const events: FileChangeEvent[] = [
      {
        filePath: 'README.md',
        content: '# Test',
        language: 'markdown',
        userId: 'test-user',
        timestamp: new Date()
      },
      {
        filePath: 'package.json',
        content: '{}',
        language: 'json',
        userId: 'test-user',
        timestamp: new Date()
      },
      {
        filePath: 'node_modules/test/index.js',
        content: 'console.log("test");',
        language: 'javascript',
        userId: 'test-user',
        timestamp: new Date()
      }
    ];

    // These should all be skipped and not throw errors
    for (const event of events) {
      await expect(hook.onFileChange(event)).resolves.toBeUndefined();
    }
  });

  it('should handle analysis errors gracefully', async () => {
    const event: FileChangeEvent = {
      filePath: 'src/test.ts',
      content: '', // Empty content might cause issues
      language: 'unknown-language', // Unsupported language
      userId: 'test-user',
      timestamp: new Date()
    };

    // Should handle error gracefully without throwing
    await expect(hook.onFileChange(event)).resolves.toBeUndefined();
  });

  it('should provide status information', () => {
    const status = hook.getStatus();
    expect(status).toHaveProperty('activeConnections');
    expect(typeof status.activeConnections).toBe('number');
  });
});