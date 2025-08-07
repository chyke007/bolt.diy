import { codesandbox } from '~/lib/codesandbox';
import { webcontainer } from '~/lib/webcontainer';

export interface FileNode {
  path: string;
  content: string;
  isBinary: boolean;
  lastModified: Date;
}

export interface FileSystemOperation {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  mkdir: (path: string, recursive?: boolean) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  deleteDirectory: (path: string, recursive?: boolean) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;
}

export interface FileManager {
  provider: 'codesandbox' | 'webcontainer' | 'local';
  isReady: boolean;
  error?: string;

  // File operations
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  mkdir: (path: string, recursive?: boolean) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  deleteDirectory: (path: string, recursive?: boolean) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  stat: (path: string) => Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;

  // Upload operations
  uploadFiles: (files: File[]) => Promise<void>;
  uploadFolder: (folder: FileList) => Promise<void>;

  // Health check
  healthCheck: () => Promise<boolean>;
}

// Local file system implementation (fallback)
class LocalFileSystem implements FileSystemOperation {
  private _files: Map<string, FileNode> = new Map();

  constructor() {
    // Initialize with some default files
    this._files.set('/package.json', {
      path: '/package.json',
      content: JSON.stringify(
        {
          name: 'bolt-diy-project',
          version: '1.0.0',
          description: 'Local development project',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
        },
        null,
        2,
      ),
      isBinary: false,
      lastModified: new Date(),
    });

    this._files.set('/README.md', {
      path: '/README.md',
      content: '# Bolt.diy Project\n\nThis is a local development project with hybrid file management.',
      isBinary: false,
      lastModified: new Date(),
    });

    this._files.set('/src/App.tsx', {
      path: '/src/App.tsx',
      content: `import React from 'react'

function App() {
  return (
    <div>
      <h1>Hello from Bolt.diy!</h1>
      <p>This is a local development environment with hybrid file management.</p>
    </div>
  )
}

export default App`,
      isBinary: false,
      lastModified: new Date(),
    });
  }

  async readFile(path: string): Promise<string> {
    const file = this._files.get(path);

    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    return file.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const parentDir = path.substring(0, path.lastIndexOf('/'));

    if (parentDir && parentDir !== path) {
      await this.mkdir(parentDir, true);
    }

    this._files.set(path, {
      path,
      content,
      isBinary: false,
      lastModified: new Date(),
    });
  }

  async readdir(path: string): Promise<string[]> {
    const entries: string[] = [];
    const prefix = path === '/' ? '/' : path + '/';

    // Fix Map iteration by using Array.from
    for (const [filePath] of Array.from(this._files.entries())) {
      if (filePath.startsWith(prefix) && filePath !== path) {
        const relativePath = filePath.substring(prefix.length);

        if (!relativePath.includes('/')) {
          entries.push(relativePath);
        }
      }
    }

    return entries;
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    if (this._files.has(path)) {
      if (recursive) {
        return; // Directory already exists
      }

      throw new Error(`Directory already exists: ${path}`);
    }

    if (recursive) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts) {
        currentPath += '/' + part;

        if (!this._files.has(currentPath)) {
          this._files.set(currentPath, {
            path: currentPath,
            content: '',
            isBinary: false,
            lastModified: new Date(),
          });
        }
      }
    } else {
      this._files.set(path, {
        path,
        content: '',
        isBinary: false,
        lastModified: new Date(),
      });
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!this._files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }

    this._files.delete(path);
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    if (!this._files.has(path)) {
      throw new Error(`Directory not found: ${path}`);
    }

    if (!recursive) {
      const entries = await this.readdir(path);

      if (entries.length > 0) {
        throw new Error(`Directory not empty: ${path}`);
      }
    }

    this._files.delete(path);

    if (recursive) {
      const prefix = path === '/' ? '/' : path + '/';

      // Fix Map iteration by using Array.from
      for (const [filePath] of Array.from(this._files.entries())) {
        if (filePath.startsWith(prefix)) {
          this._files.delete(filePath);
        }
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    return this._files.has(path);
  }

  async stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> {
    const file = this._files.get(path);

    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      isFile: file.content !== '',
      isDirectory: file.content === '',
      size: file.content.length,
    };
  }
}

// Hybrid file manager implementation
class HybridFileManager implements FileManager {
  private _provider: 'codesandbox' | 'webcontainer' | 'local' = 'local';
  private _isReady = false;
  private _error?: string;
  private _fileSystem: FileSystemOperation;
  private _codesandboxInstance?: any;
  private _webcontainerInstance?: any;

  constructor() {
    this._fileSystem = new LocalFileSystem();
    this._initialize();
  }

  get provider(): 'codesandbox' | 'webcontainer' | 'local' {
    return this._provider;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get error(): string | undefined {
    return this._error;
  }

  private async _initialize(): Promise<void> {
    try {
      // Try CodeSandbox first
      console.log('Initializing hybrid file manager...');

      try {
        this._codesandboxInstance = await codesandbox;

        // Check if this is a mock instance
        if (this._codesandboxInstance.isMockInstance && this._codesandboxInstance.isMockInstance()) {
          console.log('Using CodeSandbox mock instance (fallback mode)');
          this._provider = 'local'; // Treat mock as local
          this._fileSystem = new LocalFileSystem();
        } else {
          const isHealthy = await this._codesandboxInstance.healthCheck();

          if (isHealthy) {
            this._provider = 'codesandbox';
            this._fileSystem = {
              readFile: (path: string) => {
                console.log('CodeSandbox: readFile called with path:', path);
                return this._codesandboxInstance.readFile(path);
              },
              writeFile: (path: string, content: string) => {
                console.log('CodeSandbox: writeFile called with path:', path);
                return this._codesandboxInstance.writeFile(path, content);
              },
              readdir: (path: string) => {
                console.log('CodeSandbox: readdir called with path:', path);
                return this._codesandboxInstance.readdir(path);
              },
              mkdir: (path: string, recursive = false) => {
                console.log('CodeSandbox: mkdir called with path:', path, 'recursive:', recursive);
                return this._codesandboxInstance.mkdir(path, { recursive });
              },
              deleteFile: (path: string) => {
                console.log('CodeSandbox: deleteFile called with path:', path);
                return this._codesandboxInstance.remove(path);
              },
              deleteDirectory: (path: string, recursive = false) => {
                console.log('CodeSandbox: deleteDirectory called with path:', path, 'recursive:', recursive);
                return this._codesandboxInstance.remove(path, { recursive });
              },
              exists: async (path: string) => {
                console.log('CodeSandbox: exists called with path:', path);

                try {
                  await this._codesandboxInstance.stat(path);

                  return true;
                } catch {
                  return false;
                }
              },
              stat: (path: string) => {
                console.log('CodeSandbox: stat called with path:', path);
                return this._codesandboxInstance.stat(path);
              },
            };
            console.log('Using CodeSandbox file system');
          } else {
            throw new Error('CodeSandbox health check failed');
          }
        }
      } catch (error) {
        console.warn('CodeSandbox not available, trying WebContainer...', error);

        // Try WebContainer
        try {
          this._webcontainerInstance = await webcontainer;

          this._provider = 'webcontainer';
          this._fileSystem = {
            readFile: (path: string) => {
              console.log('WebContainer: readFile called with path:', path);
              return this._webcontainerInstance.fs.readFile(path, 'utf-8');
            },
            writeFile: (path: string, content: string) => {
              console.log('WebContainer: writeFile called with path:', path);
              return this._webcontainerInstance.fs.writeFile(path, content);
            },
            readdir: (path: string) => {
              console.log('WebContainer: readdir called with path:', path);
              return this._webcontainerInstance.fs.readdir(path);
            },
            mkdir: (path: string, recursive = false) => {
              console.log('WebContainer: mkdir called with path:', path, 'recursive:', recursive);
              return this._webcontainerInstance.fs.mkdir(path, { recursive });
            },
            deleteFile: (path: string) => {
              console.log('WebContainer: deleteFile called with path:', path);
              return this._webcontainerInstance.fs.rm(path);
            },
            deleteDirectory: (path: string, recursive = false) => {
              console.log('WebContainer: deleteDirectory called with path:', path, 'recursive:', recursive);
              return this._webcontainerInstance.fs.rm(path, { recursive });
            },
            exists: async (path: string) => {
              console.log('WebContainer: exists called with path:', path);

              try {
                // Try to read the directory to see if it exists
                await this._webcontainerInstance.fs.readdir(path);
                console.log('WebContainer: exists - path is a directory');

                return true;
              } catch {
                // If readdir fails, try to read the file
                try {
                  await this._webcontainerInstance.fs.readFile(path, 'utf-8');
                  console.log('WebContainer: exists - path is a file');

                  return true;
                } catch {
                  console.log('WebContainer: exists - path does not exist');
                  return false;
                }
              }
            },
            stat: async (path: string) => {
              console.log('WebContainer: stat called with path:', path);

              try {
                // Try to read as directory first
                await this._webcontainerInstance.fs.readdir(path);
                console.log('WebContainer: stat - path is a directory');

                return {
                  isFile: false,
                  isDirectory: true,
                  size: 0,
                };
              } catch {
                // If readdir fails, try to read as file
                try {
                  const content = await this._webcontainerInstance.fs.readFile(path, 'utf-8');
                  console.log('WebContainer: stat - path is a file, size:', content.length);

                  return {
                    isFile: true,
                    isDirectory: false,
                    size: content.length,
                  };
                } catch {
                  console.log('WebContainer: stat - path not found');
                  throw new Error(`File not found: ${path}`);
                }
              }
            },
          };
          console.log('Using WebContainer file system');
        } catch {
          console.warn('WebContainer not available, using local file system...');

          // Fallback to local
          this._provider = 'local';
          this._fileSystem = new LocalFileSystem();
          console.log('Using local file system (fallback mode)');
        }
      }

      this._isReady = true;
      console.log(`Hybrid file manager initialized with provider: ${this._provider}`);
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Unknown error';
      this._provider = 'local';
      this._fileSystem = new LocalFileSystem();
      this._isReady = true;
      console.error('Hybrid file manager initialization failed, using local fallback:', error);
    }
  }

  // File operations
  async readFile(path: string): Promise<string> {
    console.log('HybridFileManager: readFile called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.readFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    console.log('HybridFileManager: writeFile called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.writeFile(path, content);
  }

  async readdir(path: string): Promise<string[]> {
    console.log('HybridFileManager: readdir called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.readdir(path);
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    console.log(
      'HybridFileManager: mkdir called with path:',
      path,
      'recursive:',
      recursive,
      'provider:',
      this._provider,
    );

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.mkdir(path, recursive);
  }

  async deleteFile(path: string): Promise<void> {
    console.log('HybridFileManager: deleteFile called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.deleteFile(path);
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    console.log(
      'HybridFileManager: deleteDirectory called with path:',
      path,
      'recursive:',
      recursive,
      'provider:',
      this._provider,
    );

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.deleteDirectory(path, recursive);
  }

  async exists(path: string): Promise<boolean> {
    console.log('HybridFileManager: exists called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.exists(path);
  }

  async stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> {
    console.log('HybridFileManager: stat called with path:', path, 'provider:', this._provider);

    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    return this._fileSystem.stat(path);
  }

  // Upload operations
  async uploadFiles(files: File[]): Promise<void> {
    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    for (const file of files) {
      const content = await file.text();
      const path = `/${file.name}`;
      await this.writeFile(path, content);
    }
  }

  async uploadFolder(folder: FileList): Promise<void> {
    if (!this._isReady) {
      throw new Error('File manager not ready');
    }

    for (const file of Array.from(folder)) {
      if (file.webkitRelativePath) {
        // Handle folder structure
        const path = `/${file.webkitRelativePath}`;
        const content = await file.text();
        await this.writeFile(path, content);
      } else {
        // Handle single file
        const path = `/${file.name}`;
        const content = await file.text();
        await this.writeFile(path, content);
      }
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this._isReady) {
        return false;
      }

      // Try a simple file system operation
      await this.readdir('/');

      return true;
    } catch {
      return false;
    }
  }

  // Get file tree
  async getFileTree(rootPath: string = '/'): Promise<FileNode[]> {
    const files: FileNode[] = [];

    const traverse = async (path: string) => {
      try {
        const entries = await this.readdir(path);

        for (const entry of entries) {
          const fullPath = `${path}/${entry}`.replace(/\/+/g, '/');

          try {
            const stat = await this.stat(fullPath);

            if (stat.isFile) {
              const content = await this.readFile(fullPath);
              files.push({
                path: fullPath,
                content,
                isBinary: false, // Simplified for now
                lastModified: new Date(),
              });
            } else if (stat.isDirectory) {
              await traverse(fullPath);
            }
          } catch (error) {
            console.warn(`Cannot access ${fullPath}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Cannot read directory ${path}:`, error);
      }
    };

    await traverse(rootPath);

    return files;
  }
}

// Create and export the hybrid file manager instance
export const hybridFileManager = new HybridFileManager();
