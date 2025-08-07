import { atom, map, type MapStore } from 'nanostores';
import { hybridFileManager } from '~/lib/files/hybrid-file-manager';
import type { FileNode } from '~/lib/files/hybrid-file-manager';

export interface FileMap {
  [path: string]: FileNode;
}

export class HybridFilesStore {
  files: MapStore<FileMap> = map({});
  filesCount = atom<number>(0);
  isLoading = atom<boolean>(false);
  error = atom<string | null>(null);
  provider = atom<'codesandbox' | 'webcontainer' | 'local'>('local');

  constructor() {
    this._initialize();
  }

  private async _initialize(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Wait for file manager to be ready
      while (!hybridFileManager.isReady) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.provider.set(hybridFileManager.provider);

      // Load initial file tree
      await this.loadFileTree();

      console.log(`Hybrid files store initialized with provider: ${hybridFileManager.provider}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.error.set(errorMessage);
      console.error('Failed to initialize hybrid files store:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadFileTree(rootPath: string = '/'): Promise<void> {
    try {
      const fileTree = await hybridFileManager.getFileTree(rootPath);
      const fileMap: FileMap = {};

      for (const file of fileTree) {
        fileMap[file.path] = file;
      }

      this.files.set(fileMap);
      this.filesCount.set(fileTree.length);
    } catch (error) {
      console.error('Failed to load file tree:', error);
      throw error;
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      return await hybridFileManager.readFile(path);
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      await hybridFileManager.writeFile(path, content);

      // Update the file in our store
      const currentFiles = this.files.get();
      currentFiles[path] = {
        path,
        content,
        isBinary: false,
        lastModified: new Date(),
      };

      this.files.set({ ...currentFiles });
    } catch (error) {
      console.error(`Failed to write file ${path}:`, error);
      throw error;
    }
  }

  async createFile(path: string, content: string = ''): Promise<void> {
    try {
      await hybridFileManager.writeFile(path, content);

      // Add to store
      const currentFiles = this.files.get();
      currentFiles[path] = {
        path,
        content,
        isBinary: false,
        lastModified: new Date(),
      };

      this.files.set({ ...currentFiles });
      this.filesCount.set(Object.keys(currentFiles).length);
    } catch (error) {
      console.error(`Failed to create file ${path}:`, error);
      throw error;
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      await hybridFileManager.mkdir(path, true);

      // Refresh file tree to include new directory
      await this.loadFileTree();
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await hybridFileManager.deleteFile(path);

      // Remove from store
      const currentFiles = this.files.get();
      delete currentFiles[path];

      this.files.set({ ...currentFiles });
      this.filesCount.set(Object.keys(currentFiles).length);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      throw error;
    }
  }

  async deleteDirectory(path: string, recursive = false): Promise<void> {
    try {
      await hybridFileManager.deleteDirectory(path, recursive);

      // Refresh file tree
      await this.loadFileTree();
    } catch (error) {
      console.error(`Failed to delete directory ${path}:`, error);
      throw error;
    }
  }

  async uploadFiles(files: File[]): Promise<void> {
    try {
      this.isLoading.set(true);

      await hybridFileManager.uploadFiles(files);

      // Refresh file tree to include uploaded files
      await this.loadFileTree();

      console.log(`Successfully uploaded ${files.length} files`);
    } catch (error) {
      console.error('Failed to upload files:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async uploadFolder(folder: FileList): Promise<void> {
    try {
      this.isLoading.set(true);

      await hybridFileManager.uploadFolder(folder);

      // Refresh file tree to include uploaded folder
      await this.loadFileTree();

      console.log(`Successfully uploaded folder with ${folder.length} files`);
    } catch (error) {
      console.error('Failed to upload folder:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async listFiles(path: string = '/'): Promise<string[]> {
    try {
      return await hybridFileManager.readdir(path);
    } catch (error) {
      console.error(`Failed to list files in ${path}:`, error);
      return [];
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      return await hybridFileManager.exists(path);
    } catch (error) {
      console.error(`Failed to check if file exists ${path}:`, error);
      return false;
    }
  }

  async getFileInfo(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number } | null> {
    try {
      return await hybridFileManager.stat(path);
    } catch (error) {
      console.error(`Failed to get file info for ${path}:`, error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      return await hybridFileManager.healthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Get current provider status
  getProviderStatus(): { provider: string; isReady: boolean; error?: string } {
    return {
      provider: hybridFileManager.provider,
      isReady: hybridFileManager.isReady,
      error: hybridFileManager.error,
    };
  }

  // Refresh file tree
  async refresh(): Promise<void> {
    await this.loadFileTree();
  }

  // Get file by path
  getFile(path: string): FileNode | undefined {
    const currentFiles = this.files.get();
    return currentFiles[path];
  }

  // Get all files
  getAllFiles(): FileNode[] {
    const currentFiles = this.files.get();
    return Object.values(currentFiles);
  }

  // Search files by content
  async searchFiles(query: string): Promise<FileNode[]> {
    const allFiles = this.getAllFiles();
    const results: FileNode[] = [];

    for (const file of allFiles) {
      if (file.content.toLowerCase().includes(query.toLowerCase())) {
        results.push(file);
      }
    }

    return results;
  }

  // Get file tree structure
  getFileTree(): { [path: string]: { type: 'file' | 'directory'; children?: string[] } } {
    const currentFiles = this.files.get();
    const tree: { [path: string]: { type: 'file' | 'directory'; children?: string[] } } = {};

    // Add all files
    for (const [path] of Object.entries(currentFiles)) {
      tree[path] = { type: 'file' };
    }

    // Build directory structure
    for (const path of Object.keys(currentFiles)) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts.slice(0, -1)) {
        currentPath += '/' + part;

        if (!tree[currentPath]) {
          tree[currentPath] = { type: 'directory', children: [] };
        }

        if (tree[currentPath].children) {
          tree[currentPath].children!.push(currentPath + '/' + parts[parts.indexOf(part) + 1]);
        }
      }
    }

    return tree;
  }
}

// Create and export the hybrid files store instance
export const hybridFilesStore = new HybridFilesStore();
