import { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from './components/Sidebar';
import { RequestBuilder } from './components/RequestBuilder';
import { RequestTabs } from './components/RequestTabs';
import { ResponsePanel } from './components/ResponsePanel';
import { WelcomePage } from './components/WelcomePage';
import { CategoryDetailPage } from './components/CategoryDetailPage';
import { CommandPalette } from './components/CommandPalette';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
}

export interface ResponseState {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

export interface ApiEndpoint {
  id: string;
  path: string;
  fullUrl: string | null;
  method: string;
  name?: string;
  description?: string;
  request?: SchemaBlock;
  response?: SchemaBlock;
  categoryId?: string;
  categoryName?: string;
}

export interface CategoryInfo {
  id: string;
  name?: string;
  desc?: string;
  endpointCount: number;
  children: CategoryInfo[];
}

export interface SchemaBlock {
  fields: Field[];
  optional: boolean;
}

export interface Field {
  name: string;
  fieldType: string;
  optional: boolean;
  nested?: SchemaBlock;
  mock?: string | number | boolean;
  example?: string | number | boolean;
  comment?: string;
  isParams?: boolean;
}

export interface ApiInfo {
  name: string;
  version: string;
  baseUrls: string[];
  endpointCount: number;
  mockMode: boolean;
}

function App() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [baseUrls, setBaseUrls] = useState<string[]>([]);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('');

  const [request, setRequest] = useState<RequestState>({
    method: 'GET',
    url: '',
    params: [{ key: '', value: '', enabled: true }],
    headers: [{ key: '', value: '', enabled: true }],
    body: '',
  });

  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  // Find all parent category IDs for a given category ID
  const findCategoryPath = useCallback((categoryId: string, cats: CategoryInfo[], path: string[] = []): string[] | null => {
    for (const cat of cats) {
      if (cat.id === categoryId) {
        return [...path, cat.id];
      }
      const found = findCategoryPath(categoryId, cat.children, [...path, cat.id]);
      if (found) return found;
    }
    return null;
  }, []);

  // Compute expanded categories based on selected endpoint
  const computedExpandedIds = useMemo(() => {
    if (!selectedEndpoint?.categoryId) return expandedCategoryIds;
    const path = findCategoryPath(selectedEndpoint.categoryId, categories);
    if (path) {
      return new Set([...expandedCategoryIds, ...path]);
    }
    return expandedCategoryIds;
  }, [selectedEndpoint, categories, expandedCategoryIds, findCategoryPath]);

  useEffect(() => {
    // Fetch API info to check mock mode and base URLs
    fetch('/api/info')
      .then((res) => res.json())
      .then((data: ApiInfo) => {
        setMockMode(data.mockMode);
        setBaseUrls(data.baseUrls);
        if (data.baseUrls.length > 0) {
          setSelectedBaseUrl(data.baseUrls[0]);
        }
      })
      .catch(console.error);

    // Fetch endpoints
    fetch('/api/endpoints')
      .then((res) => res.json())
      .then((data: ApiEndpoint[]) => {
        setEndpoints(data);

        // Restore selected endpoint from URL
        const params = new URLSearchParams(window.location.search);
        const path = params.get('path');
        const method = params.get('method');
        if (path && method) {
          const endpoint = data.find((e) => e.path === path && e.method === method);
          if (endpoint) {
            setSelectedEndpoint(endpoint);
          }
        }
      })
      .catch(console.error);

    // Fetch categories
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data: CategoryInfo[]) => {
        setCategories(data);

        // Restore selected category from URL
        const params = new URLSearchParams(window.location.search);
        const categoryId = params.get('category');
        if (categoryId) {
          const findCategory = (cats: CategoryInfo[]): CategoryInfo | undefined => {
            for (const cat of cats) {
              if (cat.id === categoryId) return cat;
              const found = findCategory(cat.children);
              if (found) return found;
            }
            return undefined;
          };
          const category = findCategory(data);
          if (category) {
            setSelectedCategory(category);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Remove tabindex from resize handles to prevent focus ring
  useEffect(() => {
    const removeTabIndex = () => {
      document.querySelectorAll('.resize-handle').forEach((el) => {
        el.setAttribute('tabindex', '-1');
      });
    };
    removeTabIndex();
    // Re-run after a short delay in case elements are rendered async
    const timer = setTimeout(removeTabIndex, 100);
    return () => clearTimeout(timer);
  }, [endpoints, categories]);

  const getFullUrl = useCallback(
    (path: string, baseUrl?: string) => {
      const base = baseUrl || selectedBaseUrl;
      if (base) {
        return `${base.replace(/\/$/, '')}${path}`;
      }
      return path;
    },
    [selectedBaseUrl]
  );

  // Initialize request when endpoint is restored from URL and baseUrl is ready
  useEffect(() => {
    if (selectedEndpoint && selectedBaseUrl && !request.url) {
      // Extract params fields from request schema
      const paramsFields: KeyValue[] = [];
      if (selectedEndpoint.request?.fields) {
        selectedEndpoint.request.fields.forEach((field) => {
          if (field.isParams) {
            const value = field.example !== undefined ? String(field.example) : '';
            paramsFields.push({ key: field.name, value, enabled: true });
          }
        });
      }
      paramsFields.push({ key: '', value: '', enabled: true });

      setRequest({
        method: selectedEndpoint.method as HttpMethod,
        url: getFullUrl(selectedEndpoint.path),
        params: paramsFields,
        headers: [{ key: '', value: '', enabled: true }],
        body: '',
      });
    }
  }, [selectedEndpoint, selectedBaseUrl, request.url, getFullUrl]);

  const handleSelectEndpoint = useCallback(
    (endpoint: ApiEndpoint) => {
      setSelectedEndpoint(endpoint);
      setSelectedCategory(null);

      // Expand parent categories for the selected endpoint
      if (endpoint.categoryId) {
        const path = findCategoryPath(endpoint.categoryId, categories);
        if (path) {
          setExpandedCategoryIds(prev => new Set([...prev, ...path]));
        }
      }

      // Extract params fields from request schema
      const paramsFields: KeyValue[] = [];
      if (endpoint.request?.fields) {
        endpoint.request.fields.forEach((field) => {
          if (field.isParams) {
            const value = field.example !== undefined ? String(field.example) : '';
            paramsFields.push({ key: field.name, value, enabled: true });
          }
        });
      }
      paramsFields.push({ key: '', value: '', enabled: true });

      setRequest({
        method: endpoint.method as HttpMethod,
        url: getFullUrl(endpoint.path),
        params: paramsFields,
        headers: [{ key: '', value: '', enabled: true }],
        body: '',
      });
      setResponse(null);

      // Update URL with path and method
      const urlParams = new URLSearchParams();
      urlParams.set('path', endpoint.path);
      urlParams.set('method', endpoint.method);
      window.history.replaceState(null, '', `?${urlParams.toString()}`);
    },
    [getFullUrl, categories, findCategoryPath]
  );

  const handleCategorySelect = useCallback((category: CategoryInfo) => {
    setSelectedCategory(category);
    setSelectedEndpoint(null);
    setRequest({
      method: 'GET',
      url: '',
      params: [{ key: '', value: '', enabled: true }],
      headers: [{ key: '', value: '', enabled: true }],
      body: '',
    });
    setResponse(null);

    // Update URL with category
    const urlParams = new URLSearchParams();
    urlParams.set('category', category.id);
    window.history.replaceState(null, '', `?${urlParams.toString()}`);
  }, []);

  const handleBaseUrlChange = useCallback(
    (newBaseUrl: string) => {
      setSelectedBaseUrl(newBaseUrl);
      if (selectedEndpoint) {
        setRequest((prev) => ({
          ...prev,
          url: getFullUrl(selectedEndpoint.path, newBaseUrl),
        }));
      }
    },
    [selectedEndpoint, getFullUrl]
  );

  const handleReset = useCallback(() => {
    setSelectedEndpoint(null);
    setSelectedCategory(null);
    setRequest({
      method: 'GET',
      url: '',
      params: [{ key: '', value: '', enabled: true }],
      headers: [{ key: '', value: '', enabled: true }],
      body: '',
    });
    setResponse(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const handleSend = async (useMock: boolean = false) => {
    if (!request.url && !useMock) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      let targetUrl: string;

      if (useMock && selectedEndpoint) {
        // Use mock endpoint with params
        const mockUrl = new URL(`/mock${selectedEndpoint.path}`, window.location.origin);
        request.params.forEach((p) => {
          if (p.enabled && p.key) {
            mockUrl.searchParams.append(p.key, p.value);
          }
        });
        targetUrl = mockUrl.toString();
      } else {
        const url = new URL(request.url);
        request.params.forEach((p) => {
          if (p.enabled && p.key) {
            url.searchParams.append(p.key, p.value);
          }
        });
        targetUrl = url.toString();
      }

      const headers: Record<string, string> = {};
      request.headers.forEach((h) => {
        if (h.enabled && h.key) {
          headers[h.key] = h.value;
        }
      });

      const options: RequestInit = {
        method: request.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
        options.body = request.body;
        // Auto-add Content-Type for JSON if not specified
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      const res = await fetch(targetUrl, options);
      const text = await res.text();
      const endTime = Date.now();

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: text,
        time: endTime - startTime,
        size: new Blob([text]).size,
      });
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: err instanceof Error ? err.message : 'Request failed',
        time: Date.now() - startTime,
        size: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-bg-primary">
      <CommandPalette endpoints={endpoints} onSelect={handleSelectEndpoint} />
      <PanelGroup orientation="horizontal" className="h-full">
        {/* Sidebar Panel */}
        <Panel defaultSize="20%" minSize="15%" maxSize="40%">
          <Sidebar
            endpoints={endpoints}
            categories={categories}
            selectedId={selectedEndpoint?.id}
            selectedCategoryId={selectedCategory?.id}
            expandedCategoryIds={computedExpandedIds}
            onSelect={handleSelectEndpoint}
            onCategorySelect={handleCategorySelect}
            onReset={handleReset}
            mockMode={mockMode}
            baseUrls={baseUrls}
            selectedBaseUrl={selectedBaseUrl}
            onBaseUrlChange={handleBaseUrlChange}
          />
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        {/* Main Content Panel */}
        <Panel defaultSize="80%">
          <div className="h-full flex flex-col overflow-hidden">
            {selectedEndpoint ? (
              <>
                <RequestBuilder
                  method={request.method}
                  url={request.url}
                  onUrlChange={(url) => setRequest({ ...request, url })}
                  onSend={() => handleSend(false)}
                  onMockSend={mockMode && selectedEndpoint ? () => handleSend(true) : undefined}
                  loading={loading}
                />

                <PanelGroup orientation="horizontal" className="flex-1">
                  {/* Request Panel */}
                  <Panel defaultSize="50%" minSize="25%">
                    <div className="h-full flex flex-col border-r border-border">
                      {(selectedEndpoint?.name || selectedEndpoint?.description) && (
                        <div className="px-4 py-3 bg-bg-secondary border-b border-border">
                          {selectedEndpoint?.name && (
                            <div className="text-lg font-semibold text-text-primary">
                              {selectedEndpoint.name}
                            </div>
                          )}
                          {selectedEndpoint?.description && (
                            <div className="text-sm text-text-secondary mt-1">
                              {selectedEndpoint.description}
                            </div>
                          )}
                        </div>
                      )}
                      <RequestTabs
                        params={request.params}
                        headers={request.headers}
                        body={request.body}
                        method={request.method}
                        onParamsChange={(params) => setRequest({ ...request, params })}
                        onHeadersChange={(headers) => setRequest({ ...request, headers })}
                        onBodyChange={(body) => setRequest({ ...request, body })}
                        requestSchema={selectedEndpoint?.request}
                      />
                    </div>
                  </Panel>

                  <PanelResizeHandle className="resize-handle" />

                  {/* Response Panel */}
                  <Panel defaultSize="50%" minSize="25%">
                    <div className="h-full flex flex-col">
                      <ResponsePanel response={response} loading={loading} />
                    </div>
                  </Panel>
                </PanelGroup>
              </>
            ) : selectedCategory ? (
              <CategoryDetailPage
                category={selectedCategory}
                endpoints={endpoints}
                onSelectEndpoint={handleSelectEndpoint}
                onSelectCategory={handleCategorySelect}
              />
            ) : (
              <WelcomePage endpointCount={endpoints.length} mockMode={mockMode} />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
