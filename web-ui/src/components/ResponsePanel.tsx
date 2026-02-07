import { useMemo, memo } from 'react';
import {
  Box,
  Tabs,
  Text,
  Group,
  Badge,
  Code,
  Table,
  Loader,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import { IconBolt, IconMessage, IconArrowUpRight, IconArrowDownLeft } from '@tabler/icons-react';
import Editor from '@monaco-editor/react';
import type { ResponseState } from '../App';

interface ResponsePanelProps {
  response: ResponseState | null;
  loading: boolean;
  isWs?: boolean;
  wsMessages?: { type: 'sent' | 'received', data: string, time: number, event?: string }[];
  wsConnected?: boolean;
  method?: string;
}

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'blue';
  if (status >= 400 && status < 500) return 'yellow';
  return 'red';
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatJson = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const getLanguageFromContentType = (headers: Record<string, string>): string => {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  const mimeType = contentType.split(';')[0].trim().toLowerCase();

  if (mimeType.includes('json')) return 'json';
  if (mimeType.includes('html')) return 'html';
  if (mimeType.includes('xml')) return 'xml';
  if (mimeType.includes('javascript')) return 'javascript';
  if (mimeType.includes('css')) return 'css';
  if (mimeType.includes('yaml') || mimeType.includes('yml')) return 'yaml';
  return 'plaintext';
};

const formatBody = (body: string, language: string): string => {
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
};

const EDITOR_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  padding: { top: 12 },
  domReadOnly: true,
};

const PANEL_STYLE = { flex: 1, minHeight: 0, overflow: 'hidden' };
const PANEL_HEADERS_STYLE = { flex: 1, minHeight: 0, overflow: 'auto' };

export const ResponsePanel = memo(function ResponsePanel({ response, loading, isWs, wsMessages, wsConnected, method }: ResponsePanelProps) {
  const { language, formattedBody } = useMemo(() => {
    if (!response) return { language: 'plaintext', formattedBody: '' };
    const lang = getLanguageFromContentType(response.headers);
    return {
      language: lang,
      formattedBody: formatBody(response.body, lang),
    };
  }, [response]);

  if (loading && !isWs) {
    return (
      <Box className="flex-1 flex items-center justify-center bg-bg-primary">
        <Stack align="center" gap="md">
          <Loader size="lg" color="orange" />
          <Text c="dimmed">Sending request...</Text>
        </Stack>
      </Box>
    );
  }

  if (isWs) {
    return (
      <Box className="flex flex-col h-full">
        <Box className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 h-[41px]">
          <Group gap="md">
            <Text size="sm" fw={600}>{method === 'SSE' ? 'SSE Messages' : method === 'SIO' ? 'Socket.IO Messages' : 'WebSocket Messages'}</Text>
            {wsMessages && wsMessages.length > 0 && (
              <Badge size="xs" variant="light" color="gray">
                {wsMessages.length}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: wsConnected ? '#22c55e' : '#ef4444',
                boxShadow: wsConnected ? '0 0 6px rgba(34, 197, 94, 0.5)' : 'none',
              }}
            />
            <Text size="xs" fw={500} c={wsConnected ? 'green' : 'red'}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </Group>
        </Box>
        <Box className="flex-1 overflow-auto bg-bg-primary p-2">
          <Stack gap="xs">
            {[...(wsMessages || [])].reverse().map((msg, i) => (
              <Box
                key={i}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: msg.type === 'sent'
                    ? 'rgba(59, 130, 246, 0.08)'
                    : 'rgba(34, 197, 94, 0.08)',
                  borderLeft: `3px solid ${msg.type === 'sent' ? '#3b82f6' : '#22c55e'}`,
                }}
              >
                <Group justify="space-between" align="flex-start" mb={6}>
                  <Group gap="xs">
                    {msg.type === 'sent' ? (
                      <ThemeIcon size="xs" color="blue" variant="light" radius="xl">
                        <IconArrowUpRight size={10} />
                      </ThemeIcon>
                    ) : (
                      <ThemeIcon size="xs" color="green" variant="light" radius="xl">
                        <IconArrowDownLeft size={10} />
                      </ThemeIcon>
                    )}
                    <Badge
                      size="xs"
                      variant="light"
                      color={msg.type === 'sent' ? 'blue' : 'green'}
                    >
                      {msg.type === 'sent' ? 'Sent' : 'Received'}
                    </Badge>
                    {msg.event && (
                      <Badge size="xs" variant="outline" color="violet">
                        {msg.event}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {new Date(msg.time).toLocaleTimeString()}
                  </Text>
                </Group>
                <Code
                  block
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    fontSize: 12,
                    padding: 8,
                    borderRadius: 4,
                  }}
                >
                  {formatJson(msg.data)}
                </Code>
              </Box>
            ))}
            {(!wsMessages || wsMessages.length === 0) && (
              <Box className="text-center py-12">
                <Stack align="center" gap="xs">
                  <IconMessage size={32} color="var(--color-text-dimmed)" />
                  <Text size="sm" c="dimmed">No messages yet</Text>
                  <Text size="xs" c="dimmed">Connect to start receiving messages</Text>
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    );
  }

  if (!response) {
    return (
      <Box className="flex-1 flex items-center justify-center bg-bg-primary">
        <Stack align="center" gap="md" className="text-center px-8">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <IconBolt size={32} />
          </ThemeIcon>
          <Box>
            <Text fw={500}>Enter a URL and click Send</Text>
            <Text size="sm" c="dimmed" mt={4}>
              Response will appear here
            </Text>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Tabs defaultValue="body" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <Box className="flex items-center justify-between border-b border-border bg-bg-secondary px-4" style={{ flexShrink: 0 }}>
          <Tabs.List className="border-0">
            <Tabs.Tab value="body">Body</Tabs.Tab>
            <Tabs.Tab value="headers">Headers</Tabs.Tab>
          </Tabs.List>

          <Group gap="lg">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Status:
              </Text>
              <Badge color={getStatusColor(response.status)} variant="filled">
                {response.status} {response.statusText}
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Time:
              </Text>
              <Text size="sm" c="green" ff="monospace" fw={500}>
                {response.time}ms
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Size:
              </Text>
              <Text size="sm" c="blue" ff="monospace" fw={500}>
                {formatSize(response.size)}
              </Text>
            </Group>
          </Group>
        </Box>

        <Tabs.Panel value="body" style={PANEL_STYLE} className="bg-bg-primary">
          <Editor
            height="100%"
            language={language}
            value={formattedBody}
            theme="vs-dark"
            options={EDITOR_OPTIONS}
          />
        </Tabs.Panel>

        <Tabs.Panel value="headers" style={PANEL_HEADERS_STYLE} className="bg-bg-primary p-4">
          <Table.ScrollContainer minWidth={400}>
            <Table>
              <Table.Tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <Table.Tr key={key} className="border-b border-border">
                    <Table.Td className="font-medium text-text-secondary py-2 pr-4 whitespace-nowrap">
                      {key}
                    </Table.Td>
                    <Table.Td className="font-mono py-2 break-all">{value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
});
