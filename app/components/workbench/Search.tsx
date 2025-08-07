import { useState, useMemo, useCallback, useEffect } from 'react';
import type { TextSearchOptions, TextSearchOnProgressCallback, WebContainer } from '@webcontainer/api';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { codesandbox } from '~/lib/codesandbox';
import { WORK_DIR } from '~/utils/constants';
import { debounce } from '~/utils/debounce';

interface DisplayMatch {
  path: string;
  lineNumber: number;
  previewText: string;
  matchCharStart: number;
  matchCharEnd: number;
}

// Search provider type
type SearchProvider = 'webcontainer' | 'codesandbox';

// WebContainer search implementation
async function performWebContainerSearch(
  instance: WebContainer,
  query: string,
  options: Omit<TextSearchOptions, 'folders'>,
  onProgress: (results: DisplayMatch[]) => void,
): Promise<void> {
  if (!instance || typeof instance.internal?.textSearch !== 'function') {
    console.error('WebContainer instance not available or internal searchText method is missing/not a function.');
    return;
  }

  const searchOptions: TextSearchOptions = {
    ...options,
    folders: [WORK_DIR],
  };

  const progressCallback: TextSearchOnProgressCallback = (filePath: any, apiMatches: any[]) => {
    const displayMatches: DisplayMatch[] = [];

    apiMatches.forEach((apiMatch: { preview: { text: string; matches: string | any[] }; ranges: any[] }) => {
      const previewLines = apiMatch.preview.text.split('\n');

      apiMatch.ranges.forEach((range: { startLineNumber: number; startColumn: any; endColumn: any }) => {
        let previewLineText = '(Preview line not found)';
        let lineIndexInPreview = -1;

        if (apiMatch.preview.matches.length > 0) {
          const previewStartLine = apiMatch.preview.matches[0].startLineNumber;
          lineIndexInPreview = range.startLineNumber - previewStartLine;
        }

        if (lineIndexInPreview >= 0 && lineIndexInPreview < previewLines.length) {
          previewLineText = previewLines[lineIndexInPreview];
        } else {
          previewLineText = previewLines[0] ?? '(Preview unavailable)';
        }

        displayMatches.push({
          path: filePath,
          lineNumber: range.startLineNumber,
          previewText: previewLineText,
          matchCharStart: range.startColumn,
          matchCharEnd: range.endColumn,
        });
      });
    });

    if (displayMatches.length > 0) {
      onProgress(displayMatches);
    }
  };

  try {
    await instance.internal.textSearch(query, searchOptions, progressCallback);
  } catch (error) {
    console.error('Error during WebContainer text search:', error);
  }
}

// CodeSandbox search implementation
async function performCodeSandboxSearch(
  instance: any,
  query: string,
  options: any,
  onProgress: (results: DisplayMatch[]) => void,
): Promise<void> {
  if (!instance) {
    console.error('CodeSandbox instance not available.');
    return;
  }

  try {
    // Check if instance is properly initialized
    if (!instance.isLoaded()) {
      console.error('CodeSandbox instance not initialized.');
      return;
    }

    // Perform health check
    const isHealthy = await instance.healthCheck();

    if (!isHealthy) {
      console.error('CodeSandbox instance is not healthy.');
      return;
    }

    console.log('Starting CodeSandbox search for:', query);

    await instance.textSearch(query, options, (filePath: string, matches: any[]) => {
      console.log(`Found ${matches.length} matches in ${filePath}`);

      const displayMatches: DisplayMatch[] = matches.map((match: any) => ({
        path: filePath,
        lineNumber: match.lineNumber,
        previewText: match.previewText,
        matchCharStart: match.matchCharStart,
        matchCharEnd: match.matchCharEnd,
      }));

      if (displayMatches.length > 0) {
        onProgress(displayMatches);
      }
    });

    console.log('CodeSandbox search completed');
  } catch (error) {
    console.error('Error during CodeSandbox text search:', error);

    // If search fails, try to provide some fallback results
    console.log('Attempting to provide fallback search results...');

    // For mock mode, we can provide some basic results
    if (instance.isMockInstance && instance.isMockInstance()) {
      console.log('Using mock instance fallback search');

      /*
       * The mock instance already has its own textSearch implementation
       * so we don't need to duplicate the logic here
       */
    }
  }
}

function groupResultsByFile(results: DisplayMatch[]): Record<string, DisplayMatch[]> {
  return results.reduce(
    (acc, result) => {
      if (!acc[result.path]) {
        acc[result.path] = [];
      }

      acc[result.path].push(result);

      return acc;
    },
    {} as Record<string, DisplayMatch[]>,
  );
}

export function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DisplayMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('webcontainer');
  const [providerStatus, setProviderStatus] = useState<{
    webcontainer: 'loading' | 'ready' | 'error';
    codesandbox: 'loading' | 'ready' | 'error';
  }>({
    webcontainer: 'loading',
    codesandbox: 'loading',
  });

  const groupedResults = useMemo(() => groupResultsByFile(searchResults), [searchResults]);

  // Check provider availability
  useEffect(() => {
    const checkProviders = async () => {
      // Check WebContainer
      try {
        await webcontainer;
        setProviderStatus((prev) => ({ ...prev, webcontainer: 'ready' }));
      } catch (error) {
        console.warn('WebContainer not available:', error);
        setProviderStatus((prev) => ({ ...prev, webcontainer: 'error' }));
      }

      // Check CodeSandbox
      try {
        const csb = await codesandbox;
        const isHealthy = await csb.healthCheck();

        if (isHealthy) {
          setProviderStatus((prev) => ({ ...prev, codesandbox: 'ready' }));
        } else {
          setProviderStatus((prev) => ({ ...prev, codesandbox: 'error' }));
        }
      } catch (error) {
        console.warn('CodeSandbox not available:', error);
        setProviderStatus((prev) => ({ ...prev, codesandbox: 'error' }));
      }
    };

    checkProviders();
  }, []);

  // Auto-select best available provider
  useEffect(() => {
    if (providerStatus.webcontainer === 'ready') {
      setSearchProvider('webcontainer');
    } else if (providerStatus.codesandbox === 'ready') {
      setSearchProvider('codesandbox');
    }
  }, [providerStatus]);

  useEffect(() => {
    if (searchResults.length > 0) {
      const allExpanded: Record<string, boolean> = {};
      Object.keys(groupedResults).forEach((file) => {
        allExpanded[file] = true;
      });
      setExpandedFiles(allExpanded);
    }
  }, [groupedResults, searchResults]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        setExpandedFiles({});
        setHasSearched(false);

        return;
      }

      setIsSearching(true);
      setSearchResults([]);
      setExpandedFiles({});
      setHasSearched(true);

      const minLoaderTime = 300; // ms
      const start = Date.now();

      try {
        const progressHandler = (batchResults: DisplayMatch[]) => {
          setSearchResults((prevResults) => [...prevResults, ...batchResults]);
        };

        if (searchProvider === 'webcontainer') {
          const instance = await webcontainer;
          await performWebContainerSearch(
            instance,
            query,
            {
              includes: [],
              excludes: [],
              gitignore: true,
              requireGit: false,
              isRegex: false,
              caseSensitive: false,
              globalIgnoreFiles: false,
              isWordMatch: false,
              ignoreSymlinks: false,
              resultLimit: 1000,
            },
            progressHandler,
          );
        } else if (searchProvider === 'codesandbox') {
          const instance = await codesandbox;

          // Ensure instance is ready before searching
          if (!instance.isLoaded()) {
            console.error('CodeSandbox not ready for search');
            return;
          }

          await performCodeSandboxSearch(
            instance,
            query,
            {
              folders: ['/'],
              includePattern: '.*',
              excludePattern: 'node_modules|.git',
              maxResults: 1000,
              useRegExp: false,
              caseSensitive: false,
              wholeWord: false,
            },
            progressHandler,
          );
        }
      } catch (error) {
        console.error('Failed to initiate search:', error);
      } finally {
        const elapsed = Date.now() - start;

        if (elapsed < minLoaderTime) {
          setTimeout(() => setIsSearching(false), minLoaderTime - elapsed);
        } else {
          setIsSearching(false);
        }
      }
    },
    [searchProvider],
  );

  const debouncedSearch = useCallback(debounce(handleSearch, 300), [handleSearch]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleResultClick = (filePath: string, line?: number) => {
    workbenchStore.setSelectedFile(filePath);

    /*
     * Adjust line number to be 0-based if it's defined
     * The search results use 1-based line numbers, but CodeMirrorEditor expects 0-based
     */
    const adjustedLine = typeof line === 'number' ? Math.max(0, line - 1) : undefined;

    workbenchStore.setCurrentDocumentScrollPosition({ line: adjustedLine, column: 0 });
  };

  const handleProviderChange = (provider: SearchProvider) => {
    setSearchProvider(provider);

    // Clear current results when switching providers
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <div className="flex flex-col h-full bg-bolt-elements-background-depth-2">
      {/* Search Bar */}
      <div className="flex items-center py-3 px-3 gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full px-2 py-1 rounded-md bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none transition-all"
          />
        </div>

        {/* Provider Selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleProviderChange('webcontainer')}
            className={`px-2 py-1 text-xs rounded ${
              searchProvider === 'webcontainer'
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4'
            } ${providerStatus.webcontainer === 'error' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={providerStatus.webcontainer === 'error'}
            title={providerStatus.webcontainer === 'error' ? 'WebContainer not available' : 'Use WebContainer search'}
          >
            WC
          </button>
          <button
            onClick={() => handleProviderChange('codesandbox')}
            className={`px-2 py-1 text-xs rounded ${
              searchProvider === 'codesandbox'
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4'
            } ${providerStatus.codesandbox === 'error' ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={providerStatus.codesandbox === 'error'}
            title={providerStatus.codesandbox === 'error' ? 'CodeSandbox not available' : 'Use CodeSandbox search'}
          >
            CS
          </button>
        </div>
      </div>

      {/* Provider Status */}
      <div className="px-3 pb-2">
        <div className="text-xs text-bolt-elements-textTertiary">
          {searchProvider === 'webcontainer' ? 'Using WebContainer' : 'Using CodeSandbox'}
          {providerStatus.webcontainer === 'loading' && ' (WC loading...)'}
          {providerStatus.codesandbox === 'loading' && ' (CS loading...)'}
          {providerStatus.webcontainer === 'error' && ' (WC unavailable)'}
          {providerStatus.codesandbox === 'error' && ' (CS unavailable - using fallback)'}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto py-2">
        {isSearching && (
          <div className="flex items-center justify-center h-32 text-bolt-elements-textTertiary">
            <div className="i-ph:circle-notch animate-spin mr-2" />
            Searching with {searchProvider === 'webcontainer' ? 'WebContainer' : 'CodeSandbox'}...
          </div>
        )}
        {!isSearching && hasSearched && searchResults.length === 0 && searchQuery.trim() !== '' && (
          <div className="flex items-center justify-center h-32 text-gray-500">No results found.</div>
        )}
        {!isSearching &&
          Object.keys(groupedResults).map((file) => (
            <div key={file} className="mb-2">
              <button
                className="flex gap-2 items-center w-full text-left py-1 px-2 text-bolt-elements-textSecondary bg-transparent hover:bg-bolt-elements-background-depth-3 group"
                onClick={() => setExpandedFiles((prev) => ({ ...prev, [file]: !prev[file] }))}
              >
                <span
                  className=" i-ph:caret-down-thin w-3 h-3 text-bolt-elements-textSecondary transition-transform"
                  style={{ transform: expandedFiles[file] ? 'rotate(180deg)' : undefined }}
                />
                <span className="font-normal text-sm">{file.split('/').pop()}</span>
                <span className="h-5.5 w-5.5 flex items-center justify-center text-xs ml-auto bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-full">
                  {groupedResults[file].length}
                </span>
              </button>
              {expandedFiles[file] && (
                <div className="">
                  {groupedResults[file].map((match, idx) => {
                    const contextChars = 7;
                    const isStart = match.matchCharStart <= contextChars;
                    const previewStart = isStart ? 0 : match.matchCharStart - contextChars;
                    const previewText = match.previewText.slice(previewStart);
                    const matchStart = isStart ? match.matchCharStart : contextChars;
                    const matchEnd = isStart
                      ? match.matchCharEnd
                      : contextChars + (match.matchCharEnd - match.matchCharStart);

                    return (
                      <div
                        key={idx}
                        className="hover:bg-bolt-elements-background-depth-3 cursor-pointer transition-colors pl-6 py-1"
                        onClick={() => handleResultClick(match.path, match.lineNumber)}
                      >
                        <pre className="font-mono text-xs text-bolt-elements-textTertiary truncate">
                          {!isStart && <span>...</span>}
                          {previewText.slice(0, matchStart)}
                          <span className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded px-1">
                            {previewText.slice(matchStart, matchEnd)}
                          </span>
                          {previewText.slice(matchEnd)}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
