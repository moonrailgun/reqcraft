import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, TextInput, Text, Kbd, Group, Stack, Badge } from '@mantine/core';
import { IconSearch, IconApi } from '@tabler/icons-react';
import type { ApiEndpoint } from '../App';

interface CommandPaletteProps {
  endpoints: ApiEndpoint[];
  onSelect: (endpoint: ApiEndpoint) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#a855f7',
};

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

function getMatchScore(endpoint: ApiEndpoint, query: string): number {
  const lowerQuery = query.toLowerCase();
  const path = endpoint.path.toLowerCase();
  const name = (endpoint.name || '').toLowerCase();

  // Exact match gets highest score
  if (path === lowerQuery || name === lowerQuery) return 100;

  // Starts with query
  if (path.startsWith(lowerQuery) || name.startsWith(lowerQuery)) return 80;

  // Contains query
  if (path.includes(lowerQuery) || name.includes(lowerQuery)) return 60;

  // Fuzzy match
  if (fuzzyMatch(path, query) || fuzzyMatch(name, query)) return 40;

  return 0;
}

export function CommandPalette({ endpoints, onSelect }: CommandPaletteProps) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredEndpoints = useMemo(() => {
    if (!query.trim()) {
      return endpoints.slice(0, 20);
    }

    return endpoints
      .map(endpoint => ({ endpoint, score: getMatchScore(endpoint, query) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.endpoint);
  }, [endpoints, query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredEndpoints]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleOpen = useCallback(() => {
    setOpened(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setOpened(false);
    setQuery('');
  }, []);

  const handleSelectCurrent = useCallback(() => {
    if (filteredEndpoints[selectedIndex]) {
      onSelect(filteredEndpoints[selectedIndex]);
      handleClose();
    }
  }, [filteredEndpoints, selectedIndex, onSelect, handleClose]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpen]);

  // Navigation within modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredEndpoints.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelectCurrent();
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  }, [filteredEndpoints.length, handleSelectCurrent, handleClose]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="lg"
      padding={0}
      radius="md"
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      transitionProps={{ duration: 150 }}
      styles={{
        content: {
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        },
        body: {
          padding: 0,
        },
      }}
    >
      <div onKeyDown={handleKeyDown}>
        <div className="p-3 border-b border-border">
          <TextInput
            ref={inputRef}
            placeholder="Search APIs by path or name..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={18} className="text-text-secondary" />}
            rightSection={
              <Group gap={4}>
                <Kbd size="xs">↑↓</Kbd>
                <Kbd size="xs">↵</Kbd>
              </Group>
            }
            rightSectionWidth={80}
            autoFocus
            styles={{
              input: {
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                '&:focus': {
                  borderColor: 'var(--color-accent)',
                },
              },
            }}
          />
        </div>

        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
        >
          {filteredEndpoints.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <IconApi size={48} className="mx-auto mb-2 opacity-50" />
              <Text size="sm">No APIs found</Text>
            </div>
          ) : (
            <Stack gap={0}>
              {filteredEndpoints.map((endpoint, index) => (
                <div
                  key={endpoint.id}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-accent/10'
                      : 'hover:bg-bg-primary'
                  }`}
                  onClick={() => {
                    onSelect(endpoint);
                    handleClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="sm"
                      radius="sm"
                      variant="light"
                      style={{
                        backgroundColor: `${METHOD_COLORS[endpoint.method]}20`,
                        color: METHOD_COLORS[endpoint.method],
                        minWidth: 60,
                      }}
                    >
                      {endpoint.method}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <Text
                        size="sm"
                        fw={500}
                        className="text-text-primary truncate"
                        component="div"
                      >
                        {endpoint.path}
                      </Text>
                      {endpoint.name && (
                        <Text
                          size="xs"
                          className="text-text-secondary truncate"
                          component="div"
                        >
                          {endpoint.name}
                        </Text>
                      )}
                    </div>
                    {endpoint.categoryName && (
                      <Text size="xs" className="text-text-tertiary">
                        {endpoint.categoryName}
                      </Text>
                    )}
                  </Group>
                </div>
              ))}
            </Stack>
          )}
        </div>

        <div className="p-2 border-t border-border bg-bg-primary">
          <Group gap="md" justify="center">
            <Group gap={4}>
              <Kbd size="xs">⌘</Kbd>
              <Kbd size="xs">K</Kbd>
              <Text size="xs" c="dimmed">to open</Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">ESC</Kbd>
              <Text size="xs" c="dimmed">to close</Text>
            </Group>
          </Group>
        </div>
      </div>
    </Modal>
  );
}
