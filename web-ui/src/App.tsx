import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar } from './components/Sidebar';
import { RequestBuilder } from './components/RequestBuilder';
import { RequestTabs } from './components/RequestTabs';
import { ResponsePanel } from './components/ResponsePanel';
import { WelcomePage } from './components/WelcomePage';
import { CategoryDetailPage } from './components/CategoryDetailPage';
import { CommandPalette } from './components/CommandPalette';
import { VariablesPage } from './components/VariablesPage';
import {
  type Variable,
  type VariableDefinition,
  type HeaderDefinition,
  type ConfigHeader,
  loadVariables,
  saveVariables,
  replaceVariables,
  replaceVariablesInKeyValues,
  mergeVariables,
  loadConfigHeaders,
  saveConfigHeaders,
  mergeConfigHeaders,
} from './utils/variables';
import { generateExampleFromSchema, hasBodyFields } from './utils/schema';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';

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

export interface WsEvent {
  name: string;
  request?: SchemaBlock;
  response?: SchemaBlock;
}

export interface ApiEndpoint {
  id: string;
  endpointType: 'http' | 'websocket';
  path: string;
  fullUrl: string | null;
  method: string | null;
  name?: string;
  description?: string;
  request?: SchemaBlock;
  response?: SchemaBlock;
  events?: WsEvent[];
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
  corsMode: boolean;
}

function App() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [variablesSelected, setVariablesSelected] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [corsMode, setCorsMode] = useState(false);
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
  const [wsMessages, setWsMessages] = useState<{ type: 'sent' | 'received', data: string, time: number, event?: string }[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingWsEventRef = useRef<{ eventName: string; data: string } | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [variables, setVariables] = useState<Variable[]>(() => loadVariables());
  const [configHeaders, setConfigHeaders] = useState<ConfigHeader[]>(() => loadConfigHeaders());

  const handleVariablesChange = useCallback((newVariables: Variable[]) => {
    setVariables(newVariables);
    saveVariables(newVariables);
  }, []);

  const handleConfigHeadersChange = useCallback((newHeaders: ConfigHeader[]) => {
    setConfigHeaders(newHeaders);
    saveConfigHeaders(newHeaders);
  }, []);

  const handleVariablesClick = useCallback(() => {
    setVariablesSelected(true);
    setSelectedEndpoint(null);
    setSelectedCategory(null);
    setResponse(null);
    window.history.replaceState(null, '', '?variables=1');
  }, []);

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
    // Fetch API info to check mock mode, cors mode and base URLs
    fetch('/api/info')
      .then((res) => res.json())
      .then((data: ApiInfo) => {
        setMockMode(data.mockMode);
        setCorsMode(data.corsMode);
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
        const type = params.get('type');
        const variablesParam = params.get('variables');
        
        if (variablesParam === '1') {
          setVariablesSelected(true);
        } else if (path) {
          let endpoint: ApiEndpoint | undefined;
          if (type === 'ws') {
            // WebSocket endpoint - match by path only
            endpoint = data.find((e) => e.path === path && e.endpointType === 'websocket');
          } else if (method) {
            // HTTP endpoint - match by path and method
            endpoint = data.find((e) => e.path === path && e.method === method);
          }
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

    // Fetch config variables and merge with local variables
    fetch('/api/variables')
      .then((res) => res.json())
      .then((configVars: VariableDefinition[]) => {
        const localVars = loadVariables();
        const merged = mergeVariables(configVars, localVars);
        setVariables(merged);
      })
      .catch(console.error);

    // Fetch config headers and merge with saved headers
    fetch('/api/headers')
      .then((res) => res.json())
      .then((configHeaderDefs: HeaderDefinition[]) => {
        const savedHeaders = loadConfigHeaders();
        const merged = mergeConfigHeaders(configHeaderDefs, savedHeaders);
        setConfigHeaders(merged);
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

      // Determine method based on endpoint type
      const isWebSocket = selectedEndpoint.endpointType === 'websocket';
      const method: HttpMethod = isWebSocket ? 'WS' : (selectedEndpoint.method as HttpMethod) || 'GET';

      // Generate body example for POST/PUT/PATCH methods
      let body = '';
      if (['POST', 'PUT', 'PATCH'].includes(method) && hasBodyFields(selectedEndpoint.request)) {
        const exampleData = generateExampleFromSchema(selectedEndpoint.request!);
        body = JSON.stringify(exampleData, null, 2);
      }

      setRequest({
        method,
        url: isWebSocket ? selectedEndpoint.path : getFullUrl(selectedEndpoint.path),
        params: paramsFields,
        headers: [{ key: '', value: '', enabled: true }],
        body,
      });
    }
  }, [selectedEndpoint, selectedBaseUrl, request.url, getFullUrl]);

  const handleSelectEndpoint = useCallback(
    (endpoint: ApiEndpoint) => {
      setSelectedEndpoint(endpoint);
      setSelectedCategory(null);
      setVariablesSelected(false);

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

      const method = endpoint.endpointType === 'websocket' ? 'WS' : (endpoint.method as HttpMethod);

      // Generate body example for POST/PUT/PATCH methods
      let body = '';
      if (['POST', 'PUT', 'PATCH'].includes(method) && hasBodyFields(endpoint.request)) {
        const exampleData = generateExampleFromSchema(endpoint.request!);
        body = JSON.stringify(exampleData, null, 2);
      }

      setRequest({
        method,
        url: endpoint.endpointType === 'websocket' ? endpoint.path : getFullUrl(endpoint.path),
        params: paramsFields,
        headers: [{ key: '', value: '', enabled: true }],
        body,
      });
      setResponse(null);
      setWsMessages([]);
      if (socket) {
        socket.close();
        setSocket(null);
        setWsConnected(false);
      }

      // Update URL with path and method/type
      const urlParams = new URLSearchParams();
      urlParams.set('path', endpoint.path);
      if (endpoint.endpointType === 'websocket') {
        urlParams.set('type', 'ws');
      } else if (endpoint.method) {
        urlParams.set('method', endpoint.method);
      }
      window.history.replaceState(null, '', `?${urlParams.toString()}`);
    },
    [getFullUrl, categories, findCategoryPath, socket]
  );

  const handleCategorySelect = useCallback((category: CategoryInfo) => {
    setSelectedCategory(category);
    setSelectedEndpoint(null);
    setVariablesSelected(false);
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
    setVariablesSelected(false);
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

    // Apply variable replacements
    const resolvedUrl = replaceVariables(request.url, variables);
    const resolvedParams = replaceVariablesInKeyValues(request.params, variables);
    const resolvedHeaders = replaceVariablesInKeyValues(request.headers, variables);
    const resolvedBody = replaceVariables(request.body, variables);

    if (request.method === 'WS') {
      if (wsConnected) {
        socket?.close();
        setWsConnected(false);
        setSocket(null);
        return;
      }

      setLoading(true);
      try {
        const ws = new WebSocket(resolvedUrl);
        ws.onopen = () => {
          setWsConnected(true);
          setLoading(false);
          setSocket(ws);
          setWsMessages(prev => [...prev, { type: 'received', data: 'Connected to ' + resolvedUrl, time: Date.now() }]);
          
          // Send pending event if exists
          if (pendingWsEventRef.current) {
            const { eventName, data } = pendingWsEventRef.current;
            ws.send(data);
            setWsMessages(prev => [...prev, { type: 'sent', data, time: Date.now(), event: eventName }]);
            pendingWsEventRef.current = null;
          }
        };
        ws.onmessage = (event) => {
          setWsMessages(prev => [...prev, { type: 'received', data: event.data, time: Date.now() }]);
        };
        ws.onclose = () => {
          setWsConnected(false);
          setSocket(null);
          setWsMessages(prev => [...prev, { type: 'received', data: 'Disconnected', time: Date.now() }]);
        };
        ws.onerror = (error) => {
          setWsMessages(prev => [...prev, { type: 'received', data: 'WebSocket Error: ' + error, time: Date.now() }]);
          setLoading(false);
        };
      } catch (err) {
        setWsMessages(prev => [...prev, { type: 'received', data: 'Error: ' + (err instanceof Error ? err.message : String(err)), time: Date.now() }]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      let targetUrl: string;

      if (useMock && selectedEndpoint) {
        // Use mock endpoint with params (apply variable replacement to path)
        const resolvedPath = replaceVariables(selectedEndpoint.path, variables);
        const mockUrl = new URL(`/mock${resolvedPath}`, window.location.origin);
        resolvedParams.forEach((p) => {
          if (p.enabled && p.key) {
            mockUrl.searchParams.append(p.key, p.value);
          }
        });
        targetUrl = mockUrl.toString();
      } else {
        const url = new URL(resolvedUrl);
        resolvedParams.forEach((p) => {
          if (p.enabled && p.key) {
            url.searchParams.append(p.key, p.value);
          }
        });
        
        // If CORS mode is enabled, proxy through local server
        if (corsMode) {
          const encodedUrl = encodeURIComponent(url.toString());
          targetUrl = `/proxy/${encodedUrl}`;
        } else {
          targetUrl = url.toString();
        }
      }

      const headers: Record<string, string> = {};
      
      // Add config headers first (can be overridden by request headers)
      configHeaders.forEach((h) => {
        if (h.enabled && h.name) {
          headers[h.name] = replaceVariables(h.value, variables);
        }
      });
      
      // Add request-specific headers (override config headers)
      resolvedHeaders.forEach((h) => {
        if (h.enabled && h.key) {
          headers[h.key] = h.value;
        }
      });

      const options: RequestInit = {
        method: request.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(request.method) && resolvedBody) {
        options.body = resolvedBody;
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

  const handleSendEvent = useCallback((eventName: string, data: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
      setWsMessages(prev => [...prev, { type: 'sent', data, time: Date.now(), event: eventName }]);
    } else if (!wsConnected && !loading) {
      // Not connected, store event and trigger connection
      pendingWsEventRef.current = { eventName, data };
      handleSend(false);
    }
  }, [socket, wsConnected, loading, handleSend]);

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
            variables={variables}
            variablesSelected={variablesSelected}
            onVariablesClick={handleVariablesClick}
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
                  onMockSend={mockMode && selectedEndpoint && selectedEndpoint.endpointType === 'http' ? () => handleSend(true) : undefined}
                  loading={loading || (request.method === 'WS' && !wsConnected && !!socket)}
                  wsConnected={wsConnected}
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
                        wsEvents={selectedEndpoint?.events}
                        onSendEvent={handleSendEvent}
                      />
                    </div>
                  </Panel>

                  <PanelResizeHandle className="resize-handle" />

                  {/* Response Panel */}
                  <Panel defaultSize="50%" minSize="25%">
                    <div className="h-full flex flex-col">
                      <ResponsePanel 
                        response={response} 
                        loading={loading} 
                        isWs={request.method === 'WS'}
                        wsMessages={wsMessages}
                        wsConnected={wsConnected}
                      />
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
            ) : variablesSelected ? (
              <VariablesPage
                variables={variables}
                onVariablesChange={handleVariablesChange}
                configHeaders={configHeaders}
                onConfigHeadersChange={handleConfigHeadersChange}
              />
            ) : (
              <WelcomePage endpointCount={endpoints.length} mockMode={mockMode} corsMode={corsMode} />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
