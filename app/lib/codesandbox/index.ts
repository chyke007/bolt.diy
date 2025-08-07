import { CodeSandbox } from '@codesandbox/sdk';

interface CodeSandboxContext {
  loaded: boolean;
  sandboxId?: string;
  error?: string;
}

export const codesandboxContext: CodeSandboxContext = import.meta.hot?.data.codesandboxContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.codesandboxContext = codesandboxContext;
}

// Create a search-compatible interface that mimics WebContainer's text search
export interface CodeSandboxSearchResult {
  path: string;
  lineNumber: number;
  previewText: string;
  matchCharStart: number;
  matchCharEnd: number;
}

export interface CodeSandboxSearchOptions {
  folders?: string[];
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
  useRegExp?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface CodeSandboxSearchProgressCallback {
  (filePath: string, matches: CodeSandboxSearchResult[]): void;
}

export class CodeSandboxInstance {
  private _sdk: CodeSandbox;
  private _sandboxId: string;
  private _client: any;
  private _fileSystem: any;
  private _initialized: boolean = false;
  private _error: string | null = null;

  constructor(apiKey: string) {
    this._sdk = new CodeSandbox(apiKey);
    this._sandboxId = '';
    this._client = null;
    this._fileSystem = null;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      console.log('Initializing CodeSandbox...');

      // Create a sandbox with timeout protection
      const sandboxPromise = this._sdk.sandboxes.create({
        id: '33s7n6',
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sandbox creation timeout')), 8000);
      });

      const sandbox = (await Promise.race([sandboxPromise, timeoutPromise])) as any;

      this._sandboxId = sandbox.id;
      console.log('Sandbox created:', this._sandboxId);

      const apiKey = import.meta.env.VITE_CSB_API_KEY || process.env.VITE_CSB_API_KEY;

      console.log('Api Key:', apiKey);

      const client = await sandbox.connect();
      console.log('Connected to sandbox:', client);

      this._initialized = true;
      codesandboxContext.loaded = true;
      codesandboxContext.sandboxId = this._sandboxId;
      codesandboxContext.error = undefined;

      console.log('CodeSandbox initialized successfully:', this._sandboxId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific DataView errors
      if (
        errorMessage.includes('DataView') ||
        errorMessage.includes('Offset is outside the bounds') ||
        errorMessage.includes('RangeError')
      ) {
        console.error('CodeSandbox SDK DataView error detected - using fallback mode:', error);
        this._error = 'CodeSandbox SDK connection error - using local fallback';
      } else {
        console.error('Failed to initialize CodeSandbox:', error);
        this._error = errorMessage;
      }

      codesandboxContext.error = this._error;
      codesandboxContext.loaded = false;

      throw new Error(`CodeSandbox initialization failed: ${this._error}`);
    }
  }

  // File system operations for search
  async readFile(path: string, _encoding: string = 'utf-8'): Promise<string> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      return await this._fileSystem.readTextFile(path);
    } catch (error) {
      console.warn(`Failed to read file ${path}:`, error);
      return '';
    }
  }

  async readdir(path: string): Promise<string[]> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      return await this._fileSystem.readdir(path);
    } catch (error) {
      console.warn(`Failed to read directory ${path}:`, error);
      return [];
    }
  }

  async stat(path: string): Promise<any> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      return await this._fileSystem.stat(path);
    } catch (error) {
      console.warn(`Failed to stat ${path}:`, error);
      throw error;
    }
  }

  // Add file system operations for the hybrid file manager
  async writeFile(path: string, content: string): Promise<void> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      await this._fileSystem.writeTextFile(path, content);
    } catch (error) {
      console.warn(`Failed to write file ${path}:`, error);
      throw error;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      await this._fileSystem.mkdir(path, options);
    } catch (error) {
      console.warn(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    try {
      await this._fileSystem.remove(path, options);
    } catch (error) {
      console.warn(`Failed to remove ${path}:`, error);
      throw error;
    }
  }

  // Search functionality
  async textSearch(
    query: string,
    options: CodeSandboxSearchOptions = {},
    progressCallback: CodeSandboxSearchProgressCallback,
  ): Promise<void> {
    if (!this._initialized || !this._fileSystem) {
      throw new Error('CodeSandbox not initialized');
    }

    const searchFolders = options.folders || ['/'];
    const results: CodeSandboxSearchResult[] = [];

    for (const folder of searchFolders) {
      await this._searchInFolder(folder, query, options, results, progressCallback);
    }
  }

  private async _searchInFolder(
    folderPath: string,
    query: string,
    options: CodeSandboxSearchOptions,
    results: CodeSandboxSearchResult[],
    progressCallback: CodeSandboxSearchProgressCallback,
  ): Promise<void> {
    try {
      const entries = await this.readdir(folderPath);

      for (const entry of entries) {
        const fullPath = `${folderPath}/${entry}`.replace(/\/+/g, '/');

        try {
          const stat = await this.stat(fullPath);

          if (stat.isDirectory()) {
            // Recursively search subdirectories
            await this._searchInFolder(fullPath, query, options, results, progressCallback);
          } else if (stat.isFile()) {
            // Search in file
            await this._searchInFile(fullPath, query, options, results, progressCallback);
          }
        } catch {
          console.warn(`Cannot access ${fullPath}`);
        }
      }
    } catch {
      console.warn(`Cannot read directory ${folderPath}`);
    }
  }

  private async _searchInFile(
    filePath: string,
    query: string,
    options: CodeSandboxSearchOptions,
    results: CodeSandboxSearchResult[],
    progressCallback: CodeSandboxSearchProgressCallback,
  ): Promise<void> {
    try {
      // Check if file should be excluded
      if (options.excludePattern && new RegExp(options.excludePattern).test(filePath)) {
        return;
      }

      // Check if file should be included
      if (options.includePattern && !new RegExp(options.includePattern).test(filePath)) {
        return;
      }

      const content = await this.readFile(filePath);

      if (!content) {
        return; // Skip empty files
      }

      const lines = content.split('\n');
      const fileMatches: CodeSandboxSearchResult[] = [];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNumber = lineIndex + 1;

        // Perform search based on options
        let searchQuery = query;

        if (!options.caseSensitive) {
          searchQuery = query.toLowerCase();
        }

        let searchLine = line;

        if (!options.caseSensitive) {
          searchLine = line.toLowerCase();
        }

        let matchIndex = -1;

        if (options.useRegExp) {
          try {
            const regex = new RegExp(searchQuery, options.caseSensitive ? 'g' : 'gi');
            let match;

            while ((match = regex.exec(searchLine)) !== null) {
              matchIndex = match.index;
              break; // Just get the first match for this line
            }
          } catch {
            console.warn(`Invalid regex pattern: ${searchQuery}`);
            continue;
          }
        } else if (options.wholeWord) {
          const wordRegex = new RegExp(`\\b${searchQuery}\\b`, options.caseSensitive ? 'g' : 'gi');
          const match = wordRegex.exec(searchLine);

          if (match) {
            matchIndex = match.index;
          }
        } else {
          matchIndex = searchLine.indexOf(searchQuery);
        }

        if (matchIndex !== -1) {
          fileMatches.push({
            path: filePath,
            lineNumber,
            previewText: line,
            matchCharStart: matchIndex,
            matchCharEnd: matchIndex + query.length,
          });
        }
      }

      if (fileMatches.length > 0) {
        progressCallback(filePath, fileMatches);
        results.push(...fileMatches);
      }
    } catch {
      console.warn(`Cannot search in file ${filePath}`);
    }
  }

  // Get sandbox info
  getSandboxId(): string {
    return this._sandboxId;
  }

  isLoaded(): boolean {
    return this._initialized && codesandboxContext.loaded;
  }

  getError(): string | null {
    return this._error;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this._initialized) {
        return false;
      }

      // Try a simple file system operation
      await this.readdir('/');

      return true;
    } catch {
      return false;
    }
  }
}

// Create and export the CodeSandbox instance
export let codesandbox: Promise<CodeSandboxInstance> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  const apiKey = import.meta.env.VITE_CSB_API_KEY || process.env.VITE_CSB_API_KEY;

  console.log('CodeSandbox API Key:', apiKey ? 'Present' : 'Missing');

  if (!apiKey) {
    console.warn('CodeSandbox API key not found. Set VITE_CSB_API_KEY environment variable.');
    codesandbox = Promise.reject(new Error('CodeSandbox API key not found'));
  } else {
    codesandbox =
      import.meta.hot?.data.codesandbox ??
      Promise.resolve()
        .then(async () => {
          const instance = new CodeSandboxInstance(apiKey);
          console.log('CodeSandbox instance created');

          try {
            await instance.initialize();
            return instance;
          } catch (error) {
            console.error('CodeSandbox initialization failed, will use fallback mode:', error);

            // Return a mock instance that provides basic functionality
            const mockInstance = new MockCodeSandboxInstance();
            await mockInstance.initialize();
            console.log('Mock CodeSandbox instance initialized as fallback');

            return mockInstance;
          }
        })
        .catch((error) => {
          console.error('Failed to initialize CodeSandbox, using fallback mode:', error);

          // Return a mock instance as fallback
          const mockInstance = new MockCodeSandboxInstance();

          return mockInstance.initialize().then(() => {
            console.log('Mock CodeSandbox instance initialized as fallback');
            return mockInstance;
          });
        });

    if (import.meta.hot) {
      import.meta.hot.data.codesandbox = codesandbox;
    }
  }
}

// Mock CodeSandbox instance for fallback when real CodeSandbox fails
class MockCodeSandboxInstance extends CodeSandboxInstance {
  private _mockFiles: Map<string, string> = new Map();

  constructor() {
    super('mock-api-key');

    // Initialize with some mock files
    this._mockFiles.set(
      '/package.json',
      JSON.stringify(
        {
          name: 'bolt-diy-project',
          version: '1.0.0',
          description: 'Mock project for fallback mode',
        },
        null,
        2,
      ),
    );
    this._mockFiles.set('/README.md', '# Bolt.diy Project\n\nThis is a mock project for fallback mode.');
    this._mockFiles.set(
      '/src/App.tsx',
      `import React from 'react'

function App() {
  return (
    <div>
      <h1>Hello from Bolt.diy!</h1>
      <p>This is a mock application.</p>
    </div>
  )
}

export default App`,
    );
  }

  async initialize(): Promise<void> {
    // Mock initialization always succeeds
    console.log('Mock CodeSandbox initialized (fallback mode)');
  }

  async readFile(path: string, _encoding: string = 'utf-8'): Promise<string> {
    return this._mockFiles.get(path) || '';
  }

  async readdir(path: string): Promise<string[]> {
    const entries: string[] = [];
    const prefix = path === '/' ? '/' : path + '/';

    for (const [filePath] of this._mockFiles) {
      if (filePath.startsWith(prefix) && filePath !== path) {
        const relativePath = filePath.substring(prefix.length);

        if (!relativePath.includes('/')) {
          entries.push(relativePath);
        }
      }
    }

    return entries;
  }

  async stat(path: string): Promise<any> {
    const content = this._mockFiles.get(path);

    if (!content) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      isFile: () => true,
      isDirectory: () => false,
      size: content.length,
    };
  }

  isLoaded(): boolean {
    return true;
  }

  getError(): string | null {
    return null;
  }

  // Identify this as a mock instance
  isMockInstance(): boolean {
    return true;
  }

  // Override textSearch to provide better mock search
  async textSearch(
    query: string,
    options: CodeSandboxSearchOptions = {},
    progressCallback: CodeSandboxSearchProgressCallback,
  ): Promise<void> {
    console.log('Mock CodeSandbox: Performing search for:', query);

    const results: CodeSandboxSearchResult[] = [];

    for (const [filePath, content] of this._mockFiles) {
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNumber = lineIndex + 1;

        // Simple case-insensitive search
        const searchQuery = options.caseSensitive ? query : query.toLowerCase();
        const searchLine = options.caseSensitive ? line : line.toLowerCase();
        const matchIndex = searchLine.indexOf(searchQuery);

        if (matchIndex !== -1) {
          results.push({
            path: filePath,
            lineNumber,
            previewText: line,
            matchCharStart: matchIndex,
            matchCharEnd: matchIndex + query.length,
          });
        }
      }
    }

    // Group results by file and call progress callback
    const groupedResults: Record<string, CodeSandboxSearchResult[]> = {};

    for (const result of results) {
      if (!groupedResults[result.path]) {
        groupedResults[result.path] = [];
      }

      groupedResults[result.path].push(result);
    }

    for (const [filePath, fileResults] of Object.entries(groupedResults)) {
      progressCallback(filePath, fileResults);
    }

    console.log(`Mock CodeSandbox: Found ${results.length} matches`);
  }
}
