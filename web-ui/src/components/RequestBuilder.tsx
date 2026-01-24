import { Box, TextInput, Button, Group, Tooltip, Badge } from '@mantine/core';
import { IconSend, IconLoader2, IconMask } from '@tabler/icons-react';
import type { HttpMethod } from '../App';

interface RequestBuilderProps {
  method: HttpMethod;
  url: string;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onMockSend?: () => void;
  loading: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'yellow',
  DELETE: 'red',
  PATCH: 'teal',
  WS: 'violet',
};

export function RequestBuilder({
  method,
  url,
  onUrlChange,
  onSend,
  onMockSend,
  loading,
}: RequestBuilderProps) {
  const isWs = method === 'WS';

  return (
    <Box className="bg-bg-secondary border-b border-border p-4">
      <Group gap="sm">
        <Badge
          size="xl"
          radius="md"
          color={methodColors[method]}
          variant="filled"
          className="font-mono"
          styles={{
            root: {
              minWidth: 80,
              height: 36,
              fontSize: 14,
              fontWeight: 700,
            },
          }}
        >
          {method}
        </Badge>

        <TextInput
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={isWs ? "Enter WebSocket URL" : "Enter request URL"}
          flex={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
          styles={{
            input: {
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--mantine-font-family-monospace)',
              '&:focus': {
                borderColor: 'var(--color-accent)',
              },
            },
          }}
        />

        <Button
          onClick={onSend}
          disabled={loading || !url}
          color={isWs ? "violet" : "orange"}
          leftSection={
            loading ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconSend size={16} />
            )
          }
        >
          {loading ? (isWs ? 'Connecting...' : 'Sending...') : (isWs ? 'Connect' : 'Send')}
        </Button>

        {onMockSend && (
          <Tooltip label="Send request to mock server">
            <Button
              onClick={onMockSend}
              disabled={loading}
              color="violet"
              variant="light"
              leftSection={<IconMask size={16} />}
            >
              Mock
            </Button>
          </Tooltip>
        )}
      </Group>
    </Box>
  );
}
