import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Drawer } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSchema } from '@tabler/icons-react';
import { Sidebar } from './components/Sidebar';
import { RequestBuilder } from './components/RequestBuilder';
import { RequestTabs } from './components/RequestTabs';
import { ResponsePanel } from './components/ResponsePanel';
import { WelcomePage } from './components/WelcomePage';
import { CategoryDetailPage } from './components/CategoryDetailPage';
import { CommandPalette } from './components/CommandPalette';
import { VariablesPage } from './components/VariablesPage';
import { SchemaPanel } from './components/SchemaPanel';
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
import { useServiceWSStore } from './store/useWebSocketStore';
import { io as sioConnect, type Socket as SioSocket } from 'socket.io-client';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'SIO';

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
  endpointType: 'http' | 'websocket' | 'socketio';
  path: string;
  fullUrl: string | null;
  method: string | null;
  name?: string;
  description?: string;
  request?: SchemaBlock;
  response?: SchemaBlock;
  events?: WsEvent[];
  auth?: SchemaBlock;
  connectHeaders?: SchemaBlock;
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
  const [sioSocket, setSioSocket] = useState<SioSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingWsEventRef = useRef<{ eventName: string; data: string } | null>(null);
  const selectedEndpointRef = useRef<ApiEndpoint | null>(null);
  const selectedCategoryRef = useRef<CategoryInfo | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [schemaDrawerOpened, { open: openSchemaDrawer, close: closeSchemaDrawer }] = useDisclosure(false);
  const [variables, setVariables] = useState<Variable[]>(() => loadVariables());
  const [configHeaders, setConfigHeaders] = useState<ConfigHeader[]>(() => loadConfigHeaders());

  // Keep refs in sync for hot-reload lookups
  useEffect(() => { selectedEndpointRef.current = selectedEndpoint; }, [selectedEndpoint]);
  useEffect(() => { selectedCategoryRef.current = selectedCategory; }, [selectedCategory]);

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

  const fetchApiData = useCallback((restoreFromUrl = false) => {
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

    fetch('/api/endpoints')
      .then((res) => res.json())
      .then((data: ApiEndpoint[]) => {
        setEndpoints(data);

        if (restoreFromUrl) {
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
              endpoint = data.find((e) => e.path === path && e.endpointType === 'websocket');
            } else if (type === 'sio') {
              endpoint = data.find((e) => e.path === path && e.endpointType === 'socketio');
            } else if (method) {
              endpoint = data.find((e) => e.path === path && e.method === method);
            }
            if (endpoint) {
              setSelectedEndpoint(endpoint);
            }
          }
        } else {
          // Reload: refresh selected endpoint with updated data
          const current = selectedEndpointRef.current;
          if (current) {
            const updated = data.find((e) => e.id === current.id);
            setSelectedEndpoint(updated ?? null);
          }
        }
      })
      .catch(console.error);

    fetch('/api/categories')
      .then((res) => res.json())
      .then((data: CategoryInfo[]) => {
        setCategories(data);

        if (restoreFromUrl) {
          const params = new URLSearchParams(window.location.search);
          const categoryId = params.get('category');
          if (categoryId) {
            const findCat = (cats: CategoryInfo[]): CategoryInfo | undefined => {
              for (const cat of cats) {
                if (cat.id === categoryId) return cat;
                const found = findCat(cat.children);
                if (found) return found;
              }
              return undefined;
            };
            const category = findCat(data);
            if (category) {
              setSelectedCategory(category);
            }
          }
        } else {
          // Reload: refresh selected category with updated data
          const current = selectedCategoryRef.current;
          if (current) {
            const findCat = (cats: CategoryInfo[]): CategoryInfo | undefined => {
              for (const cat of cats) {
                if (cat.id === current.id) return cat;
                const found = findCat(cat.children);
                if (found) return found;
              }
              return undefined;
            };
            setSelectedCategory(findCat(data) ?? null);
          }
        }
      })
      .catch(console.error);

    fetch('/api/variables')
      .then((res) => res.json())
      .then((configVars: VariableDefinition[]) => {
        const localVars = loadVariables();
        const merged = mergeVariables(configVars, localVars);
        setVariables(merged);
      })
      .catch(console.error);

    fetch('/api/headers')
      .then((res) => res.json())
      .then((configHeaderDefs: HeaderDefinition[]) => {
        const savedHeaders = loadConfigHeaders();
        const merged = mergeConfigHeaders(configHeaderDefs, savedHeaders);
        setConfigHeaders(merged);
      })
      .catch(console.error);
  }, []);

  // Initial data load
  useEffect(() => {
    fetchApiData(true);
  }, [fetchApiData]);

  // Connect to backend service WebSocket for hot-reload
  const connectServiceWS = useServiceWSStore((s) => s.connect);
  const disconnectServiceWS = useServiceWSStore((s) => s.disconnect);
  useEffect(() => {
    connectServiceWS(() => fetchApiData(false));
    return () => disconnectServiceWS();
  }, [connectServiceWS, disconnectServiceWS, fetchApiData]);

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
      const isSocketio = selectedEndpoint.endpointType === 'socketio';
      const method: HttpMethod = isWebSocket ? 'WS' : isSocketio ? 'SIO' : (selectedEndpoint.method as HttpMethod) || 'GET';

      // Generate body example for POST/PUT/PATCH methods
      let body = '';
      if (['POST', 'PUT', 'PATCH'].includes(method) && hasBodyFields(selectedEndpoint.request)) {
        const exampleData = generateExampleFromSchema(selectedEndpoint.request!);
        body = JSON.stringify(exampleData, null, 2);
      }

      // For SIO endpoints, populate auth fields as params and connectHeaders as headers
      let initParams = paramsFields;
      let initHeaders: KeyValue[] = [{ key: '', value: '', enabled: true }];
      if (isSocketio) {
        if (selectedEndpoint.auth?.fields) {
          initParams = [];
          selectedEndpoint.auth.fields.forEach((field) => {
            const value = field.example !== undefined ? String(field.example) : '';
            initParams.push({ key: field.name, value, enabled: true });
          });
          initParams.push({ key: '', value: '', enabled: true });
        }
        if (selectedEndpoint.connectHeaders?.fields) {
          initHeaders = [];
          selectedEndpoint.connectHeaders.fields.forEach((field) => {
            const value = field.example !== undefined ? String(field.example) : '';
            initHeaders.push({ key: field.name, value, enabled: true });
          });
          initHeaders.push({ key: '', value: '', enabled: true });
        }
      }

      setRequest({
        method,
        url: (isWebSocket || isSocketio) ? selectedEndpoint.path : getFullUrl(selectedEndpoint.path),
        params: initParams,
        headers: initHeaders,
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

      const method: HttpMethod = endpoint.endpointType === 'websocket' ? 'WS' : endpoint.endpointType === 'socketio' ? 'SIO' : (endpoint.method as HttpMethod);

      // Generate body example for POST/PUT/PATCH methods
      let body = '';
      if (['POST', 'PUT', 'PATCH'].includes(method) && hasBodyFields(endpoint.request)) {
        const exampleData = generateExampleFromSchema(endpoint.request!);
        body = JSON.stringify(exampleData, null, 2);
      }

      // For SIO endpoints, populate auth fields as params and connectHeaders as headers
      let sioParams = paramsFields;
      let sioHeaders: KeyValue[] = [{ key: '', value: '', enabled: true }];
      if (endpoint.endpointType === 'socketio') {
        if (endpoint.auth?.fields) {
          sioParams = [];
          endpoint.auth.fields.forEach((field) => {
            const value = field.example !== undefined ? String(field.example) : '';
            sioParams.push({ key: field.name, value, enabled: true });
          });
          sioParams.push({ key: '', value: '', enabled: true });
        }
        if (endpoint.connectHeaders?.fields) {
          sioHeaders = [];
          endpoint.connectHeaders.fields.forEach((field) => {
            const value = field.example !== undefined ? String(field.example) : '';
            sioHeaders.push({ key: field.name, value, enabled: true });
          });
          sioHeaders.push({ key: '', value: '', enabled: true });
        }
      }

      setRequest({
        method,
        url: (endpoint.endpointType === 'websocket' || endpoint.endpointType === 'socketio') ? endpoint.path : getFullUrl(endpoint.path),
        params: endpoint.endpointType === 'socketio' ? sioParams : paramsFields,
        headers: sioHeaders,
        body,
      });
      setResponse(null);
      setWsMessages([]);
      if (socket) {
        socket.close();
        setSocket(null);
        setWsConnected(false);
      }
      if (sioSocket) {
        sioSocket.disconnect();
        setSioSocket(null);
        setWsConnected(false);
      }

      // Update URL with path and method/type
      const urlParams = new URLSearchParams();
      urlParams.set('path', endpoint.path);
      if (endpoint.endpointType === 'websocket') {
        urlParams.set('type', 'ws');
      } else if (endpoint.endpointType === 'socketio') {
        urlParams.set('type', 'sio');
      } else if (endpoint.method) {
        urlParams.set('method', endpoint.method);
      }
      window.history.replaceState(null, '', `?${urlParams.toString()}`);
    },
    [getFullUrl, categories, findCategoryPath, socket, sioSocket]
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

  const handleParamsChange = useCallback((params: KeyValue[]) => {
    setRequest((prev) => ({ ...prev, params }));
  }, []);

  const handleHeadersChange = useCallback((headers: KeyValue[]) => {
    setRequest((prev) => ({ ...prev, headers }));
  }, []);

  const handleBodyChange = useCallback((body: string) => {
    setRequest((prev) => ({ ...prev, body }));
  }, []);

  const handleUrlChange = useCallback((url: string) => {
    setRequest((prev) => ({ ...prev, url }));
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

    if (request.method === 'SIO') {
      if (wsConnected) {
        sioSocket?.disconnect();
        setSioSocket(null);
        setWsConnected(false);
        return;
      }

      setLoading(true);
      try {
        // Build auth object from params (used for SIO auth)
        const authObj: Record<string, string> = {};
        resolvedParams.forEach((p) => {
          if (p.enabled && p.key) authObj[p.key] = p.value;
        });

        // Build extraHeaders from headers
        const extraHeaders: Record<string, string> = {};
        resolvedHeaders.forEach((h) => {
          if (h.enabled && h.key) extraHeaders[h.key] = h.value;
        });

        const sio = sioConnect(resolvedUrl, {
          transports: ['websocket', 'polling'],
          ...(Object.keys(authObj).length > 0 ? { auth: authObj } : {}),
          ...(Object.keys(extraHeaders).length > 0 ? { extraHeaders } : {}),
        });
        sio.on('connect', () => {
          setWsConnected(true);
          setLoading(false);
          setSioSocket(sio);
          setWsMessages(prev => [...prev, { type: 'received', data: 'Connected to ' + resolvedUrl, time: Date.now() }]);

          if (pendingWsEventRef.current) {
            const { eventName, data } = pendingWsEventRef.current;
            try {
              sio.emit(eventName, JSON.parse(data));
            } catch {
              sio.emit(eventName, data);
            }
            setWsMessages(prev => [...prev, { type: 'sent', data, time: Date.now(), event: eventName }]);
            pendingWsEventRef.current = null;
          }

          // Listen for events defined in the endpoint
          if (selectedEndpoint?.events) {
            for (const ev of selectedEndpoint.events) {
              sio.on(ev.name, (...args: unknown[]) => {
                const msgData = args.length === 1 ? JSON.stringify(args[0], null, 2) : JSON.stringify(args, null, 2);
                setWsMessages(prev => [...prev, { type: 'received', data: msgData, time: Date.now(), event: ev.name }]);
              });
            }
          }
        });
        sio.on('disconnect', () => {
          setWsConnected(false);
          setSioSocket(null);
          setWsMessages(prev => [...prev, { type: 'received', data: 'Disconnected', time: Date.now() }]);
        });
        sio.on('connect_error', (error) => {
          setWsMessages(prev => [...prev, { type: 'received', data: 'SocketIO Error: ' + error.message, time: Date.now() }]);
          setLoading(false);
        });
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

  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleSendRequest = useCallback(() => {
    handleSendRef.current(false);
  }, []);

  const handleMockSendRequest = useCallback(() => {
    handleSendRef.current(true);
  }, []);

  const handleSendEvent = useCallback((eventName: string, data: string) => {
    if (sioSocket?.connected) {
      try {
        sioSocket.emit(eventName, JSON.parse(data));
      } catch {
        sioSocket.emit(eventName, data);
      }
      setWsMessages(prev => [...prev, { type: 'sent', data, time: Date.now(), event: eventName }]);
    } else if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
      setWsMessages(prev => [...prev, { type: 'sent', data, time: Date.now(), event: eventName }]);
    } else if (!wsConnected && !loading) {
      pendingWsEventRef.current = { eventName, data };
      handleSendRef.current(false);
    }
  }, [socket, sioSocket, wsConnected, loading]);

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
            corsMode={corsMode}
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
                  onUrlChange={handleUrlChange}
                  onSend={handleSendRequest}
                  onMockSend={mockMode && selectedEndpoint && selectedEndpoint.endpointType === 'http' ? handleMockSendRequest : undefined}
                  loading={loading || ((request.method === 'WS' || request.method === 'SIO') && !wsConnected && !!(socket || sioSocket))}
                  wsConnected={wsConnected}
                />

                <PanelGroup orientation="horizontal" className="flex-1">
                  {/* Request Panel */}
                  <Panel defaultSize="50%" minSize="25%">
                    <div className="h-full flex flex-col border-r border-border">
                      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border">
                        <div className="flex-1 min-w-0">
                          {selectedEndpoint?.name && (
                            <div className="text-lg font-semibold text-text-primary">
                              {selectedEndpoint.name}
                            </div>
                          )}
                          {selectedEndpoint?.description && (
                            <div className="text-sm text-text-secondary mt-0.5">
                              {selectedEndpoint.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={openSchemaDrawer}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          <IconSchema size={14} />
                          Schema
                        </button>
                      </div>
                      <RequestTabs
                        params={request.params}
                        headers={request.headers}
                        body={request.body}
                        method={request.method}
                        onParamsChange={handleParamsChange}
                        onHeadersChange={handleHeadersChange}
                        onBodyChange={handleBodyChange}
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
                        isWs={request.method === 'WS' || request.method === 'SIO'}
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

      <Drawer
        opened={schemaDrawerOpened}
        onClose={closeSchemaDrawer}
        title="Schema"
        position="right"
        size={480}
        styles={{
          content: { backgroundColor: 'var(--color-bg-primary)' },
          header: { backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' },
          title: { fontWeight: 600 },
        }}
      >
        {selectedEndpoint && (
          <div className="pt-4">
            <SchemaPanel
              requestSchema={selectedEndpoint.request}
              responseSchema={selectedEndpoint.response}
              wsEvents={selectedEndpoint.events}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default App;
