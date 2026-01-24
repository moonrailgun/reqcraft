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
import type { ResponseState } from '../App';

interface ResponsePanelProps {
  response: ResponseState | null;
  loading: boolean;
  isWs?: boolean;
  wsMessages?: { type: 'sent' | 'received', data: string, time: number, event?: string }[];
  wsConnected?: boolean;
}

export function ResponsePanel({ response, loading, isWs, wsMessages, wsConnected }: ResponsePanelProps) {
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
          <Text size="sm" fw={600}>WebSocket Messages</Text>
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
        <Box className="flex-1 overflow-auto bg-bg-primary p-0">
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr className="border-b border-border bg-bg-secondary sticky top-0 z-10">
                <Table.Th w={40} />
                <Table.Th>Data</Table.Th>
                <Table.Th w={100}>Time</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {wsMessages?.map((msg, i) => (
                <Table.Tr key={i} className="border-b border-border hover:bg-bg-hover">
                  <Table.Td>
                    {msg.type === 'sent' ? (
                      <ThemeIcon size="sm" color="blue" variant="light">
                        <IconArrowUpRight size={12} />
                      </ThemeIcon>
                    ) : (
                      <ThemeIcon size="sm" color="green" variant="light">
                        <IconArrowDownLeft size={12} />
                      </ThemeIcon>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      {msg.event && (
                        <Text size="xs" c="dimmed" ff="monospace">Event: {msg.event}</Text>
                      )}
                      <Code block className="bg-transparent p-0 text-xs">
                        {formatJson(msg.data)}
                      </Code>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {new Date(msg.time).toLocaleTimeString()}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(!wsMessages || wsMessages.length === 0) && (
                <Table.Tr>
                  <Table.Td colSpan={3} className="text-center py-12">
                    <Stack align="center" gap="xs">
                      <IconMessage size={32} color="var(--color-text-dimmed)" />
                      <Text size="sm" c="dimmed">No messages yet</Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
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
    <Box className="flex flex-col h-full">
      <Tabs defaultValue="body" className="flex flex-col h-full">
        <Box className="flex items-center justify-between border-b border-border bg-bg-secondary px-4">
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

        <Tabs.Panel value="body" className="flex-1 overflow-auto bg-bg-primary p-4">
          <Code
            block
            className="bg-transparent text-sm whitespace-pre-wrap break-all"
            styles={{
              root: {
                backgroundColor: 'transparent',
                padding: 0,
              },
            }}
          >
            {formatJson(response.body)}
          </Code>
        </Tabs.Panel>

        <Tabs.Panel value="headers" className="flex-1 overflow-auto bg-bg-primary p-4">
          <Table>
            <Table.Tbody>
              {Object.entries(response.headers).map(([key, value]) => (
                <Table.Tr key={key} className="border-b border-border">
                  <Table.Td className="font-medium text-text-secondary py-2 pr-4">
                    {key}
                  </Table.Td>
                  <Table.Td className="font-mono py-2">{value}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
