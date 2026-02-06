import { useState, useCallback, memo } from 'react';
import {
  Box,
  Text,
  Badge,
  Code,
  Group,
  Stack,
  ActionIcon,
  Tabs,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconSchema,
  IconMessage,
} from '@tabler/icons-react';
import type { SchemaBlock, Field, WsEvent } from '../App';

interface SchemaPanelProps {
  requestSchema?: SchemaBlock;
  responseSchema?: SchemaBlock;
  wsEvents?: WsEvent[];
}

const TYPE_COLORS: Record<string, string> = {
  string: 'blue',
  number: 'green',
  boolean: 'yellow',
  array: 'violet',
  object: 'orange',
};

interface FieldRowProps {
  field: Field;
  depth: number;
}

const FieldRow = memo(function FieldRow({ field, depth }: FieldRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasNested = !!field.nested && field.nested.fields.length > 0;

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const typeColor = TYPE_COLORS[field.fieldType] || 'gray';

  const hasMeta =
    field.comment ||
    field.example !== undefined ||
    field.mock !== undefined;

  return (
    <>
      <Box
        className="border-b border-border hover:bg-bg-hover"
        style={{ paddingLeft: 12 + depth * 16, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}
      >
        {/* First line: name + type + tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasNested && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={toggleExpanded}
              style={{ marginLeft: -4 }}
            >
              {expanded ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
            </ActionIcon>
          )}

          <Text size="sm" fw={600} ff="monospace" className="text-text-primary">
            {field.name}
          </Text>

          <Badge size="xs" variant="light" color={typeColor}>
            {field.fieldType}
          </Badge>

          {!field.optional && (
            <Badge size="xs" variant="filled" color="red">
              required
            </Badge>
          )}
          {field.optional && (
            <Badge size="xs" variant="outline" color="gray">
              optional
            </Badge>
          )}
          {field.isParams && (
            <Badge size="xs" variant="light" color="cyan">
              query
            </Badge>
          )}
        </div>

        {/* Second line: comment / example / mock */}
        {hasMeta && (
          <div className="mt-1 pl-0.5">
            {field.comment && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {field.comment}
              </Text>
            )}
            <Group gap="sm" mt={field.comment ? 2 : 0} wrap="wrap">
              {field.example !== undefined && (
                <Group gap={4}>
                  <Text size="xs" c="dimmed">example:</Text>
                  <Code style={{ fontSize: 11 }}>{String(field.example)}</Code>
                </Group>
              )}
              {field.mock !== undefined && (
                <Group gap={4}>
                  <Text size="xs" c="dimmed">mock:</Text>
                  <Code style={{ fontSize: 11 }}>{String(field.mock)}</Code>
                </Group>
              )}
            </Group>
          </div>
        )}
      </Box>

      {/* Nested fields */}
      {hasNested && expanded && (
        <Box style={{ borderLeft: '2px solid var(--color-border)', marginLeft: 12 + depth * 16 + 6 }}>
          <FieldList schema={field.nested!} depth={0} />
        </Box>
      )}
    </>
  );
});

interface FieldListProps {
  schema: SchemaBlock;
  depth: number;
}

const FieldList = memo(function FieldList({ schema, depth }: FieldListProps) {
  return (
    <>
      {schema.fields.map((field) => (
        <FieldRow key={field.name} field={field} depth={depth} />
      ))}
    </>
  );
});

interface SchemaBlockViewProps {
  title: string;
  schema?: SchemaBlock;
  color: string;
}

const SchemaBlockView = memo(function SchemaBlockView({
  title,
  schema,
  color,
}: SchemaBlockViewProps) {
  if (!schema || schema.fields.length === 0) {
    return (
      <Box className="mb-3">
        <Group gap="xs" className="px-3 py-2 bg-bg-secondary border-b border-border">
          <Badge size="sm" variant="light" color={color}>
            {title}
          </Badge>
        </Group>
        <Box className="px-3 py-6 text-center">
          <Text size="sm" c="dimmed">
            No schema defined
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mb-3">
      <Group gap="xs" className="px-3 py-2 bg-bg-secondary border-b border-border">
        <Badge size="sm" variant="light" color={color}>
          {title}
        </Badge>
        <Text size="xs" c="dimmed">
          {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      <FieldList schema={schema} depth={0} />
    </Box>
  );
});

const WsEventSchemaView = memo(function WsEventSchemaView({
  events,
}: {
  events: WsEvent[];
}) {
  const [activeEvent, setActiveEvent] = useState<string | null>(
    events.length > 0 ? events[0].name : null
  );

  const selectedEvent = events.find((e) => e.name === activeEvent);

  return (
    <Box>
      <Tabs value={activeEvent} onChange={setActiveEvent}>
        <Tabs.List className="bg-bg-secondary border-b border-border px-2">
          {events.map((event) => (
            <Tabs.Tab key={event.name} value={event.name} leftSection={<IconMessage size={14} />}>
              {event.name}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {selectedEvent && (
          <Box>
            <SchemaBlockView
              title="Request"
              schema={selectedEvent.request}
              color="blue"
            />
            <SchemaBlockView
              title="Response"
              schema={selectedEvent.response}
              color="green"
            />
          </Box>
        )}
      </Tabs>
    </Box>
  );
});

export const SchemaPanel = memo(function SchemaPanel({
  requestSchema,
  responseSchema,
  wsEvents,
}: SchemaPanelProps) {
  const hasAnySchema =
    (requestSchema && requestSchema.fields.length > 0) ||
    (responseSchema && responseSchema.fields.length > 0);
  const hasWsEvents = wsEvents && wsEvents.length > 0;

  if (!hasAnySchema && !hasWsEvents) {
    return (
      <Box className="h-full flex items-center justify-center bg-bg-primary">
        <Stack align="center" gap="xs">
          <IconSchema size={32} color="var(--color-text-dimmed)" />
          <Text size="sm" c="dimmed">
            No schema defined for this endpoint
          </Text>
        </Stack>
      </Box>
    );
  }

  if (hasWsEvents) {
    return (
      <Box className="flex-1 overflow-auto bg-bg-primary">
        <WsEventSchemaView events={wsEvents!} />
      </Box>
    );
  }

  return (
    <Box className="flex-1 overflow-auto bg-bg-primary">
      <SchemaBlockView
        title="Request"
        schema={requestSchema}
        color="blue"
      />
      <SchemaBlockView
        title="Response"
        schema={responseSchema}
        color="green"
      />
    </Box>
  );
});
