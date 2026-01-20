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
import { IconBolt } from '@tabler/icons-react';
import type { ResponseState } from '../App';

interface ResponsePanelProps {
  response: ResponseState | null;
  loading: boolean;
}

export function ResponsePanel({ response, loading }: ResponsePanelProps) {
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

  if (loading) {
    return (
      <Box className="flex-1 flex items-center justify-center bg-bg-primary">
        <Stack align="center" gap="md">
          <Loader size="lg" color="orange" />
          <Text c="dimmed">Sending request...</Text>
        </Stack>
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
