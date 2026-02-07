import { useMemo, useState, useEffect, memo } from 'react';
import {
  Box,
  Text,
  UnstyledButton,
  Group,
  Stack,
  Collapse,
  Badge,
  ScrollArea,
  Tooltip,
  Select,
} from '@mantine/core';
import {
  IconChevronRight,
  IconServer,
  IconFolder,
  IconFolderOpen,
  IconApi,
  IconVariable,
  IconPlugConnected,
} from '@tabler/icons-react';
import type { ApiEndpoint, CategoryInfo } from '../App';
import type { Variable } from '../utils/variables';
import { useServiceWSStore } from '../store/useWebSocketStore';

interface SidebarProps {
  endpoints: ApiEndpoint[];
  categories: CategoryInfo[];
  selectedId?: string;
  selectedCategoryId?: string;
  expandedCategoryIds?: Set<string>;
  onSelect: (endpoint: ApiEndpoint) => void;
  onCategorySelect: (category: CategoryInfo) => void;
  onReset: () => void;
  mockMode?: boolean;
  corsMode?: boolean;
  baseUrls: string[];
  selectedBaseUrl: string;
  onBaseUrlChange: (url: string) => void;
  variables: Variable[];
  variablesSelected?: boolean;
  onVariablesClick: () => void;
}

const methodStyles: Record<string, { bg: string; text: string }> = {
  GET: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  POST: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
  PUT: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15' },
  DELETE: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
  PATCH: { bg: 'rgba(20, 184, 166, 0.15)', text: '#2dd4bf' },
  WS: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
  SIO: { bg: 'rgba(132, 204, 22, 0.15)', text: '#a3e635' },
};

interface TreeItemProps {
  level: number;
  isLast?: boolean;
  children: React.ReactNode;
}

function TreeItem({ level, children }: TreeItemProps) {
  return (
    <Box
      style={{
        paddingLeft: level > 0 ? level * 16 : 0,
        position: 'relative',
      }}
    >
      {level > 0 && (
        <Box
          style={{
            position: 'absolute',
            left: level * 16 - 8,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          }}
        />
      )}
      {children}
    </Box>
  );
}

interface CategoryGroupProps {
  category: CategoryInfo;
  endpoints: ApiEndpoint[];
  allEndpoints: ApiEndpoint[];
  selectedId?: string;
  selectedCategoryId?: string;
  expandedCategoryIds?: Set<string>;
  onSelect: (endpoint: ApiEndpoint) => void;
  onCategorySelect: (category: CategoryInfo) => void;
  level?: number;
}

function CategoryGroup({
  category,
  endpoints,
  allEndpoints,
  selectedId,
  selectedCategoryId,
  expandedCategoryIds,
  onSelect,
  onCategorySelect,
  level = 0,
}: CategoryGroupProps) {
  const [opened, setOpened] = useState(true);

  // Auto-expand when category is in expandedCategoryIds
  useEffect(() => {
    if (expandedCategoryIds?.has(category.id)) {
      setOpened(true);
    }
  }, [expandedCategoryIds, category.id]);

  const categoryEndpoints = endpoints.filter(
    (ep) => ep.categoryId === category.id
  );

  const totalCount = categoryEndpoints.length + category.children.reduce(
    (acc, child) => acc + allEndpoints.filter(ep => ep.categoryId === child.id).length,
    0
  );

  const displayName =
    category.name || category.id.replace(/^cat-/, '').split('-')[0];
  const isSelected = selectedCategoryId === category.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCategorySelect(category);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpened((o) => !o);
  };

  return (
    <TreeItem level={level}>
      <UnstyledButton
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          transition: 'all 0.15s ease',
        }}
        className="hover:bg-[rgba(255,255,255,0.05)]"
      >
        <Box
          onClick={handleToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          className="hover:bg-[rgba(255,255,255,0.1)]"
        >
          <IconChevronRight
            size={14}
            style={{
              transform: opened ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          />
        </Box>
        {opened ? (
          <IconFolderOpen size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
        ) : (
          <IconFolder size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
        )}
        <Text
          size="sm"
          fw={500}
          style={{
            flex: 1,
            color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.85)',
          }}
        >
          {displayName}
        </Text>
        <Badge
          size="xs"
          variant="light"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.6)',
            border: 'none',
          }}
        >
          {totalCount}
        </Badge>
      </UnstyledButton>

      <Collapse in={opened}>
        <Stack gap={2} style={{ marginTop: 2 }}>
          {categoryEndpoints.map((ep) => (
            <EndpointItem
              key={ep.id}
              endpoint={ep}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}

          {category.children.map((child) => (
            <CategoryGroup
              key={child.id}
              category={child}
              endpoints={allEndpoints}
              allEndpoints={allEndpoints}
              selectedId={selectedId}
              selectedCategoryId={selectedCategoryId}
              expandedCategoryIds={expandedCategoryIds}
              onSelect={onSelect}
              onCategorySelect={onCategorySelect}
              level={level + 1}
            />
          ))}
        </Stack>
      </Collapse>
    </TreeItem>
  );
}

interface EndpointItemProps {
  endpoint: ApiEndpoint;
  selectedId?: string;
  onSelect: (endpoint: ApiEndpoint) => void;
  level?: number;
}

function EndpointItem({
  endpoint,
  selectedId,
  onSelect,
  level = 0,
}: EndpointItemProps) {
  const isSelected = selectedId === endpoint.id;
  const displayMethod = endpoint.endpointType === 'websocket' ? 'WS' : endpoint.endpointType === 'socketio' ? 'SIO' : (endpoint.method || 'GET');
  const methodStyle = methodStyles[displayMethod] || {
    bg: 'rgba(156, 163, 175, 0.15)',
    text: '#9ca3af',
  };

  return (
    <TreeItem level={level}>
      <Tooltip
        label={endpoint.description}
        disabled={!endpoint.description}
        position="right"
        withArrow
        multiline
        w={280}
      >
        <UnstyledButton
          onClick={() => onSelect(endpoint)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
            padding: '6px 12px',
            borderRadius: 6,
            backgroundColor: isSelected
              ? 'rgba(249, 115, 22, 0.15)'
              : 'transparent',
            transition: 'all 0.15s ease',
          }}
          className="hover:bg-[rgba(255,255,255,0.05)]"
        >
          <Group gap={8} wrap="nowrap" style={{ width: '100%' }}>
            <IconApi
              size={14}
              style={{
                color: isSelected ? '#f97316' : 'rgba(255, 255, 255, 0.4)',
                flexShrink: 0,
              }}
            />
            <Box
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: methodStyle.bg,
                flexShrink: 0,
              }}
            >
              <Text
                size="xs"
                fw={600}
                style={{
                  color: methodStyle.text,
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 10,
                }}
              >
                {displayMethod}
              </Text>
            </Box>
            <Text
              size="xs"
              style={{
                color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'var(--mantine-font-family-monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {endpoint.path}
            </Text>
          </Group>
          {endpoint.name && (
            <Text
              size="xs"
              style={{
                color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255, 255, 255, 0.45)',
                marginLeft: 22,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {endpoint.name}
            </Text>
          )}
        </UnstyledButton>
      </Tooltip>
    </TreeItem>
  );
}

interface WebSocketGroupProps {
  endpoints: ApiEndpoint[];
  selectedId?: string;
  onSelect: (endpoint: ApiEndpoint) => void;
}

function WebSocketGroup({
  endpoints,
  selectedId,
  onSelect,
}: WebSocketGroupProps) {
  const [opened, setOpened] = useState(true);

  if (endpoints.length === 0) return null;

  return (
    <Box>
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
        className="hover:bg-[rgba(255,255,255,0.05)]"
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
          }}
        >
          <IconChevronRight
            size={14}
            style={{
              transform: opened ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          />
        </Box>
        <IconPlugConnected size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />
        <Text
          size="sm"
          fw={500}
          style={{ flex: 1, color: 'rgba(255, 255, 255, 0.7)' }}
        >
          WebSocket
        </Text>
        <Badge
          size="xs"
          variant="light"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#a78bfa',
            border: 'none',
          }}
        >
          {endpoints.length}
        </Badge>
      </UnstyledButton>

      <Collapse in={opened}>
        <Stack gap={2} style={{ marginTop: 2 }}>
          {endpoints.map((ep) => (
            <WebSocketItem
              key={ep.id}
              endpoint={ep}
              selectedId={selectedId}
              onSelect={onSelect}
              level={1}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

interface WebSocketItemProps {
  endpoint: ApiEndpoint;
  selectedId?: string;
  onSelect: (endpoint: ApiEndpoint) => void;
  level?: number;
}

function WebSocketItem({
  endpoint,
  selectedId,
  onSelect,
  level = 0,
}: WebSocketItemProps) {
  const isSelected = selectedId === endpoint.id;
  const isSio = endpoint.endpointType === 'socketio';
  const methodStyle = methodStyles[isSio ? 'SIO' : 'WS'];

  // Extract display name from URL
  const getDisplayUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.host + parsed.pathname;
    } catch {
      return url;
    }
  };

  return (
    <TreeItem level={level}>
      <Tooltip
        label={endpoint.description}
        disabled={!endpoint.description}
        position="right"
        withArrow
        multiline
        w={280}
      >
        <UnstyledButton
          onClick={() => onSelect(endpoint)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
            padding: '6px 12px',
            borderRadius: 6,
            backgroundColor: isSelected
              ? (isSio ? 'rgba(132, 204, 22, 0.15)' : 'rgba(139, 92, 246, 0.15)')
              : 'transparent',
            transition: 'all 0.15s ease',
          }}
          className="hover:bg-[rgba(255,255,255,0.05)]"
        >
          <Group gap={8} wrap="nowrap" style={{ width: '100%' }}>
            <IconPlugConnected
              size={14}
              style={{
                color: isSelected ? (isSio ? '#a3e635' : '#a78bfa') : 'rgba(255, 255, 255, 0.4)',
                flexShrink: 0,
              }}
            />
            <Box
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: methodStyle.bg,
                flexShrink: 0,
              }}
            >
              <Text
                size="xs"
                fw={600}
                style={{
                  color: methodStyle.text,
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 10,
                }}
              >
                {isSio ? 'SIO' : 'WS'}
              </Text>
            </Box>
            <Text
              size="xs"
              style={{
                color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'var(--mantine-font-family-monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {getDisplayUrl(endpoint.path)}
            </Text>
          </Group>
          {endpoint.name && (
            <Text
              size="xs"
              style={{
                color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255, 255, 255, 0.45)',
                marginLeft: 22,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {endpoint.name}
            </Text>
          )}
          {endpoint.events && endpoint.events.length > 0 && (
            <Text
              size="xs"
              style={{
                color: isSio ? 'rgba(132, 204, 22, 0.6)' : 'rgba(139, 92, 246, 0.6)',
                marginLeft: 22,
              }}
            >
              {endpoint.events.length} event{endpoint.events.length > 1 ? 's' : ''}
            </Text>
          )}
        </UnstyledButton>
      </Tooltip>
    </TreeItem>
  );
}

interface SocketIOGroupProps {
  endpoints: ApiEndpoint[];
  selectedId?: string;
  onSelect: (endpoint: ApiEndpoint) => void;
}

function SocketIOGroup({
  endpoints,
  selectedId,
  onSelect,
}: SocketIOGroupProps) {
  const [opened, setOpened] = useState(true);

  if (endpoints.length === 0) return null;

  return (
    <Box>
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
        className="hover:bg-[rgba(255,255,255,0.05)]"
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
          }}
        >
          <IconChevronRight
            size={14}
            style={{
              transform: opened ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          />
        </Box>
        <IconPlugConnected size={18} style={{ color: '#a3e635', flexShrink: 0 }} />
        <Text
          size="sm"
          fw={500}
          style={{ flex: 1, color: 'rgba(255, 255, 255, 0.7)' }}
        >
          Socket.IO
        </Text>
        <Badge
          size="xs"
          variant="light"
          style={{
            backgroundColor: 'rgba(132, 204, 22, 0.15)',
            color: '#a3e635',
            border: 'none',
          }}
        >
          {endpoints.length}
        </Badge>
      </UnstyledButton>

      <Collapse in={opened}>
        <Stack gap={2} style={{ marginTop: 2 }}>
          {endpoints.map((ep) => (
            <WebSocketItem
              key={ep.id}
              endpoint={ep}
              selectedId={selectedId}
              onSelect={onSelect}
              level={1}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

interface UncategorizedGroupProps {
  endpoints: ApiEndpoint[];
  selectedId?: string;
  onSelect: (endpoint: ApiEndpoint) => void;
}

function UncategorizedGroup({
  endpoints,
  selectedId,
  onSelect,
}: UncategorizedGroupProps) {
  const [opened, setOpened] = useState(true);

  // Filter out WebSocket and SocketIO endpoints - they are shown in their own groups
  const httpEndpoints = useMemo(
    () => endpoints.filter((ep) => ep.endpointType !== 'websocket' && ep.endpointType !== 'socketio'),
    [endpoints]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {};
    httpEndpoints.forEach((ep) => {
      const parts = ep.path.split('/').filter(Boolean);
      const group = parts.length > 1 ? `/${parts[0]}` : '/';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(ep);
    });
    return groups;
  }, [httpEndpoints]);

  if (httpEndpoints.length === 0) return null;

  return (
    <>
      {Object.entries(grouped).map(([group, eps]) => (
        <Box key={group}>
          <UnstyledButton
            onClick={() => setOpened((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-[rgba(255,255,255,0.05)]"
          >
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 4,
              }}
            >
              <IconChevronRight
                size={14}
                style={{
                  transform: opened ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              />
            </Box>
            <IconFolder size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
            <Text
              size="sm"
              fw={500}
              style={{ flex: 1, color: 'rgba(255, 255, 255, 0.7)' }}
            >
              {group}
            </Text>
            <Badge
              size="xs"
              variant="light"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.6)',
                border: 'none',
              }}
            >
              {eps.length}
            </Badge>
          </UnstyledButton>

          <Collapse in={opened}>
            <Stack gap={2} style={{ marginTop: 2 }}>
              {eps.map((ep) => (
                <EndpointItem
                  key={ep.id}
                  endpoint={ep}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  level={1}
                />
              ))}
            </Stack>
          </Collapse>
        </Box>
      ))}
    </>
  );
}

export const Sidebar = memo(function Sidebar({
  endpoints,
  categories,
  selectedId,
  selectedCategoryId,
  expandedCategoryIds,
  onSelect,
  onCategorySelect,
  onReset,
  mockMode,
  corsMode,
  baseUrls,
  selectedBaseUrl,
  onBaseUrlChange,
  variables,
  variablesSelected,
  onVariablesClick,
}: SidebarProps) {
  const uncategorizedEndpoints = useMemo(
    () => endpoints.filter((ep) => !ep.categoryId),
    [endpoints]
  );

  const uncategorizedWsEndpoints = useMemo(
    () => uncategorizedEndpoints.filter((ep) => ep.endpointType === 'websocket'),
    [uncategorizedEndpoints]
  );

  const uncategorizedSioEndpoints = useMemo(
    () => uncategorizedEndpoints.filter((ep) => ep.endpointType === 'socketio'),
    [uncategorizedEndpoints]
  );

  const activeVariableCount = variables.filter((v) => v.name && v.enabled).length;
  const wsConnected = useServiceWSStore((s) => s.connected);

  return (
    <Box
      style={{
        width: '100%',
        minWidth: 200,
        backgroundColor: '#1a1a1a',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo */}
      <UnstyledButton
        onClick={onReset}
        style={{
          display: 'block',
          padding: 16,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'background 0.15s ease',
        }}
        className="hover:bg-[rgba(255,255,255,0.03)]"
      >
        <Group gap="sm" wrap="nowrap">
          <Box
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
            }}
          >
            <Text fw={700} size="md" c="white">
              R
            </Text>
          </Box>
          <Box>
            <Text fw={600} size="md" style={{ color: '#fff' }}>
              ReqCraft
            </Text>
            <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              API Testing Tool
            </Text>
          </Box>
        </Group>
      </UnstyledButton>

      <ScrollArea style={{ flex: 1 }}>
        <Box style={{ padding: 12 }}>
          {/* Environment Selector */}
          {baseUrls.length > 1 && (
            <Box
              style={{
                padding: 12,
                marginBottom: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Group gap={6} style={{ marginBottom: 8 }}>
                <IconServer size={14} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                <Text
                  size="xs"
                  style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                  }}
                >
                  Environment
                </Text>
              </Group>
              <Select
                value={selectedBaseUrl}
                onChange={(value) => value && onBaseUrlChange(value)}
                data={baseUrls.map((url) => ({ value: url, label: url }))}
                size="xs"
                allowDeselect={false}
                styles={{
                  input: {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 11,
                  },
                  dropdown: {
                    backgroundColor: '#252525',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  },
                  option: {
                    fontSize: 11,
                    fontFamily: 'var(--mantine-font-family-monospace)',
                  },
                }}
              />
            </Box>
          )}

          {/* Variables Section */}
          <UnstyledButton
            onClick={onVariablesClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 8,
              backgroundColor: variablesSelected
                ? 'rgba(20, 184, 166, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              border: variablesSelected
                ? '1px solid rgba(20, 184, 166, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-[rgba(255,255,255,0.05)]"
          >
            <IconVariable
              size={16}
              style={{ color: variablesSelected ? '#14b8a6' : 'rgba(255, 255, 255, 0.5)' }}
            />
            <Text
              size="sm"
              style={{
                color: variablesSelected ? '#14b8a6' : 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                flex: 1,
              }}
            >
              Variables
            </Text>
            {activeVariableCount > 0 && (
              <Badge
                size="xs"
                style={{
                  backgroundColor: 'rgba(20, 184, 166, 0.15)',
                  color: '#14b8a6',
                  border: 'none',
                }}
              >
                {activeVariableCount}
              </Badge>
            )}
          </UnstyledButton>

          {/* Section Header */}
          <Group
            gap={8}
            style={{
              padding: '8px 12px',
              marginBottom: 4,
            }}
          >
            <Text
              size="xs"
              style={{
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.5px',
                flex: 1,
              }}
            >
              API Endpoints
            </Text>
            <Badge
              size="xs"
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#f97316',
                border: 'none',
              }}
            >
              {endpoints.length}
            </Badge>
          </Group>

          <Stack gap={2}>
            {/* WebSocket endpoints first */}
            <WebSocketGroup
              endpoints={uncategorizedWsEndpoints}
              selectedId={selectedId}
              onSelect={onSelect}
            />

            {/* SocketIO endpoints */}
            <SocketIOGroup
              endpoints={uncategorizedSioEndpoints}
              selectedId={selectedId}
              onSelect={onSelect}
            />

            {/* Non-OpenAPI categories */}
            {categories
              .filter((category) => !category.id.startsWith('openapi'))
              .map((category) => (
                <CategoryGroup
                  key={category.id}
                  category={category}
                  endpoints={endpoints}
                  allEndpoints={endpoints}
                  selectedId={selectedId}
                  selectedCategoryId={selectedCategoryId}
                  expandedCategoryIds={expandedCategoryIds}
                  onSelect={onSelect}
                  onCategorySelect={onCategorySelect}
                />
              ))}

            <UncategorizedGroup
              endpoints={uncategorizedEndpoints}
              selectedId={selectedId}
              onSelect={onSelect}
            />

            {/* OpenAPI categories last */}
            {categories
              .filter((category) => category.id.startsWith('openapi'))
              .map((category) => (
                <CategoryGroup
                  key={category.id}
                  category={category}
                  endpoints={endpoints}
                  allEndpoints={endpoints}
                  selectedId={selectedId}
                  selectedCategoryId={selectedCategoryId}
                  expandedCategoryIds={expandedCategoryIds}
                  onSelect={onSelect}
                  onCategorySelect={onCategorySelect}
                />
              ))}

            {endpoints.length === 0 && (
              <Box
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                }}
              >
                <IconApi
                  size={32}
                  style={{ color: 'rgba(255, 255, 255, 0.2)', marginBottom: 8 }}
                />
                <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  No endpoints defined
                </Text>
                <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.3)', marginTop: 4 }}>
                  Add APIs to your .rqc file
                </Text>
              </Box>
            )}
          </Stack>
        </Box>
      </ScrollArea>

      {/* Footer */}
      <Box
        style={{
          padding: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        <Group gap="xs" justify="space-between">
          <Group gap={6}>
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: wsConnected ? '#22c55e' : '#ef4444',
                boxShadow: wsConnected ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none',
              }}
            />
            <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </Group>
          <Group gap={2}>
          {mockMode && (
            <Badge
              size="sm"
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                border: 'none',
              }}
            >
              🎭 Mock
            </Badge>
          )}
          {corsMode && (
            <Badge
              size="sm"
              style={{
                backgroundColor: 'rgba(34, 211, 238, 0.15)',
                color: '#22d3ee',
                border: 'none',
              }}
            >
              🔀 CORS
            </Badge>
          )}

          </Group>
        </Group>
      </Box>
    </Box>
  );
});
Sidebar.displayName = 'Sidebar'
