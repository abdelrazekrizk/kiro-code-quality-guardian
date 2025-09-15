import { KiroCodeQualityGuardian } from '../index';
import { FileChangeEvent } from '../types';

export async function runRealTimeFeedbackDemo(): Promise<void> {
  console.log('\n=== REAL-TIME FEEDBACK SYSTEM DEMO ===');
  
  const guardian = new KiroCodeQualityGuardian();
  
  try {
    await guardian.initialize();
    console.log('✅ Guardian initialized successfully');
    
    // Display connection info
    console.log('\n📡 WebSocket Server Information:');
    console.log('   URL: ws://localhost:8080');
    console.log('   Test Client: Open src/notifications/WebSocketClient.html in your browser');
    console.log('   Connection format: ws://localhost:8080?userId=your-user-id');
    
    // Wait a moment for potential client connections
    console.log('\n⏳ Waiting 3 seconds for client connections...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const status = guardian.getStatus();
    console.log(`📊 Active connections: ${status.activeConnections}`);
    
    // Simulate real-time file changes with different quality levels
    const testFiles: FileChangeEvent[] = [
      {
        filePath: 'src/components/UserProfile.tsx',
        content: `// High quality React component
import React, { useState, useCallback } from 'react';

interface UserProfileProps {
  userId: string;
  onUpdate: (data: UserData) => void;
}

interface UserData {
  name: string;
  email: string;
  avatar?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = useCallback((newData: UserData) => {
    setUserData(newData);
    onUpdate(newData);
  }, [onUpdate]);

  return (
    <div className="user-profile">
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <h2>{userData?.name || 'Unknown User'}</h2>
          <p>{userData?.email}</p>
        </div>
      )}
    </div>
  );
};`,
        language: 'typescript',
        userId: 'demo-user-1',
        timestamp: new Date()
      },
      
      {
        filePath: 'src/utils/badCode.js',
        content: `// Poor quality JavaScript code with multiple issues
var globalVariable = "This should not be global";
console.log("Debug statement that should be removed");

function veryLongFunctionNameThatViolatesNamingConventionsAndShouldBeRefactored() {
  // TODO: This function needs to be implemented
  var anotherVar = globalVariable;
  console.log(anotherVar);
  
  if (anotherVar == "something") { // Should use === instead of ==
    return anotherVar;
  }
  
  // Unreachable code
  console.log("This will never execute");
}

// Unused function
function unusedFunction() {
  return "This function is never called";
}

// Missing semicolon
var missingsemicolon = "oops"`,
        language: 'javascript',
        userId: 'demo-user-1',
        timestamp: new Date()
      },
      
      {
        filePath: 'src/services/ApiService.ts',
        content: `// Medium quality TypeScript service
import axios from 'axios';

class ApiService {
  private baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  async fetchUser(id: string) { // Missing return type annotation
    try {
      const response = await axios.get(\`\${this.baseURL}/users/\${id}\`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user:', error); // Should use proper logging
      throw error;
    }
  }
  
  async updateUser(id: string, data: any) { // 'any' type should be avoided
    const response = await axios.put(\`\${this.baseURL}/users/\${id}\`, data);
    return response.data;
  }
}

export default ApiService; // Should use named export`,
        language: 'typescript',
        userId: 'demo-user-1',
        timestamp: new Date()
      }
    ];
    
    console.log('\n🔄 Simulating real-time file changes...');
    
    for (let i = 0; i < testFiles.length; i++) {
      const file = testFiles[i];
      console.log(`\n📝 Processing file ${i + 1}/${testFiles.length}: ${file.filePath}`);
      
      await guardian.processFileChange(file);
      
      // Wait between file changes to simulate real editing
      if (i < testFiles.length - 1) {
        console.log('   ⏳ Waiting 2 seconds before next file...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n✅ Real-time feedback demo completed');
    console.log('\n📋 Demo Summary:');
    console.log(`   • Processed ${testFiles.length} files`);
    console.log(`   • Active WebSocket connections: ${guardian.getStatus().activeConnections}`);
    console.log('   • Check the WebSocket client for real-time notifications');
    
    // Keep the server running for manual testing
    console.log('\n🔄 Server will continue running for manual testing...');
    console.log('   • Open WebSocket client to see live feedback');
    console.log('   • Press Ctrl+C to stop the server');
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await guardian.shutdown();
      process.exit(0);
    });
    
    // Keep the process alive
    await new Promise(() => {}); // Never resolves, keeps server running
    
  } catch (error) {
    console.error('❌ Real-time feedback demo failed:', error);
    await guardian.shutdown();
    throw error;
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runRealTimeFeedbackDemo().catch(console.error);
}