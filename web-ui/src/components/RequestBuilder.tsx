import { memo, useCallback } from 'react';
import { Box, TextInput, Button, Group, Tooltip, Badge } from '@mantine/core';
import { IconSend, IconLoader2, IconMask, IconPlugConnected, IconPlugConnectedX } from '@tabler/icons-react';
import type { HttpMethod } from '../App';

interface RequestBuilderProps {
  method: HttpMethod;
  url: string;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onMockSend?: () => void;
  loading: boolean;
  wsConnected?: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'yellow',
  DELETE: 'red',
  PATCH: 'teal',
  WS: 'violet',
  SIO: 'lime',
};

const BADGE_STYLES = {
  root: {
    minWidth: 80,
    height: 36,
    fontSize: 14,
    fontWeight: 700,
  },
};

const INPUT_STYLES = {
  input: {
    backgroundColor: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border)',
    fontFamily: 'var(--mantine-font-family-monospace)',
    '&:focus': {
      borderColor: 'var(--color-accent)',
    },
  },
};

export const RequestBuilder = memo(function RequestBuilder({
  method,
  url,
  onUrlChange,
  onSend,
  onMockSend,
  loading,
  wsConnected,
}: RequestBuilderProps) {
  const isWs = method === 'WS' || method === 'SIO';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUrlChange(e.target.value),
    [onUrlChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onSend();
    },
    [onSend]
  );

  return (
    <Box className="bg-bg-secondary border-b border-border p-4">
      <Group gap="sm">
        <Badge
          size="xl"
          radius="md"
          color={methodColors[method]}
          variant="filled"
          className="font-mono"
          styles={BADGE_STYLES}
        >
          {method}
        </Badge>

        <TextInput
          value={url}
          onChange={handleChange}
          placeholder={isWs ? (method === 'SIO' ? "Enter SocketIO URL" : "Enter WebSocket URL") : "Enter request URL"}
          flex={1}
          onKeyDown={handleKeyDown}
          styles={INPUT_STYLES}
        />

        <Button
          onClick={onSend}
          disabled={loading || !url}
          color={isWs ? (wsConnected ? "red" : method === 'SIO' ? "lime" : "violet") : "orange"}
          leftSection={
            loading ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : isWs ? (
              wsConnected ? <IconPlugConnectedX size={16} /> : <IconPlugConnected size={16} />
            ) : (
              <IconSend size={16} />
            )
          }
        >
          {loading
            ? (isWs ? 'Connecting...' : 'Sending...')
            : isWs
              ? (wsConnected ? 'Disconnect' : 'Connect')
              : 'Send'}
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
});
