import { useState, useCallback } from 'react';
import { hybridFilesStore } from '~/lib/stores/files-hybrid';

export function FileUploadHybrid() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileTree, setFileTree] = useState<any>({});

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  }, []);

  const handleFolderSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  }, []);

  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading files...');

    try {
      await hybridFilesStore.uploadFiles(selectedFiles);

      setUploadProgress(100);
      setUploadStatus('Files uploaded successfully!');

      // Refresh file tree
      const tree = hybridFilesStore.getFileTree();
      setFileTree(tree);

      // Clear selection
      setSelectedFiles([]);

      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles]);

  const uploadFolder = useCallback(async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading folder...');

    try {
      // Convert File[] to FileList for folder upload
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach((file) => dataTransfer.items.add(file));

      await hybridFilesStore.uploadFolder(dataTransfer.files);

      setUploadProgress(100);
      setUploadStatus('Folder uploaded successfully!');

      // Refresh file tree
      const tree = hybridFilesStore.getFileTree();
      setFileTree(tree);

      // Clear selection
      setSelectedFiles([]);

      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles]);

  const refreshFileTree = useCallback(async () => {
    try {
      await hybridFilesStore.refresh();

      const tree = hybridFilesStore.getFileTree();
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to refresh file tree:', error);
    }
  }, []);

  const renderFileTree = (tree: any, level = 0) => {
    return Object.entries(tree).map(([path, info]: [string, any]) => (
      <div key={path} style={{ marginLeft: level * 20 }}>
        <div className="flex items-center gap-2 py-1">
          <span className="text-sm">
            {info.type === 'directory' ? '📁' : '📄'} {path.split('/').pop() || path}
          </span>
          {info.type === 'file' && (
            <span className="text-xs text-gray-500">({hybridFilesStore.getFile(path)?.content.length || 0} chars)</span>
          )}
        </div>
        {info.children && info.children.length > 0 && (
          <div className="ml-4">
            {info.children.map((childPath: string) => renderFileTree({ [childPath]: tree[childPath] }, level + 1))}
          </div>
        )}
      </div>
    ));
  };

  const providerStatus = hybridFilesStore.getProviderStatus();

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Hybrid File Management</h2>

      {/* Provider Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Provider Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Provider:</span>
            <span
              className={`px-2 py-1 rounded text-xs ${
                providerStatus.provider === 'codesandbox'
                  ? 'bg-blue-100 text-blue-800'
                  : providerStatus.provider === 'webcontainer'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {providerStatus.provider.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span
              className={`px-2 py-1 rounded text-xs ${
                providerStatus.isReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {providerStatus.isReady ? 'Ready' : 'Not Ready'}
            </span>
          </div>
          {providerStatus.error && <div className="text-red-600 text-xs">Error: {providerStatus.error}</div>}
        </div>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Upload Files</h3>

        <div className="space-y-4">
          {/* Single Files */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Files:</label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Folder:</label>
            <input
              type="file"
              multiple
              onChange={handleFolderSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="text-sm font-medium mb-2">Selected Files ({selectedFiles.length}):</h4>
              <ul className="text-xs space-y-1">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="flex justify-between">
                    <span>{file.name}</span>
                    <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Buttons */}
          <div className="flex gap-2">
            <button
              onClick={uploadFiles}
              disabled={isUploading || selectedFiles.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload Files
            </button>
            <button
              onClick={uploadFolder}
              disabled={isUploading || selectedFiles.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload as Folder
            </button>
            <button
              onClick={refreshFileTree}
              disabled={isUploading}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh
            </button>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600">{uploadStatus}</div>
            </div>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div>
        <h3 className="text-lg font-semibold mb-4">File Tree</h3>
        <div className="p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
          {Object.keys(fileTree).length > 0 ? (
            renderFileTree(fileTree)
          ) : (
            <div className="text-gray-500 text-center py-8">
              No files uploaded yet. Upload some files to see them here.
            </div>
          )}
        </div>
      </div>

      {/* File Operations */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">File Operations</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded">
            <h4 className="font-medium mb-2">Create File</h4>
            <button
              onClick={() => hybridFilesStore.createFile('/new-file.txt', 'Hello from hybrid file manager!')}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Create Sample File
            </button>
          </div>

          <div className="p-4 bg-green-50 rounded">
            <h4 className="font-medium mb-2">Create Directory</h4>
            <button
              onClick={() => hybridFilesStore.createDirectory('/new-directory')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Create Sample Directory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
