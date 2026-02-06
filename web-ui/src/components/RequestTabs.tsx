import { useMemo, useState, useCallback, memo } from 'react';
import {
  Box,
  Tabs,
  Table,
  Checkbox,
  TextInput,
  ActionIcon,
  Badge,
  Tooltip,
  Group,
  Text,
  Button,
} from '@mantine/core';
import {
  IconX,
  IconFileImport,
  IconSend,
  IconMessage,
  IconArrowLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import Editor from '@monaco-editor/react';
import type { KeyValue, SchemaBlock, WsEvent } from '../App';
import { generateExampleFromSchema, hasBodyFields } from '../utils/schema';

interface RequestTabsProps {
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  method: string;
  onParamsChange: (params: KeyValue[]) => void;
  onHeadersChange: (headers: KeyValue[]) => void;
  onBodyChange: (body: string) => void;
  requestSchema?: SchemaBlock;
  wsEvents?: WsEvent[];
  onSendEvent?: (eventName: string, data: string) => void;
}

const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

const INPUT_STYLES = {
  input: {
    color: 'var(--color-text-primary)',
  },
};

const TABS_STYLES = {
  root: { display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const },
};

const BODY_BOX_STYLE = { position: 'relative' as const, flex: 1, minHeight: 0 };

const LOAD_EXAMPLE_BUTTON_STYLE = {
  position: 'absolute' as const,
  bottom: 16,
  right: 16,
  zIndex: 10,
};

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  formatOnPaste: true,
  formatOnType: true,
  padding: { top: 12 },
};

interface KeyValueRowProps {
  item: KeyValue;
  index: number;
  itemsLength: number;
  onUpdate: (index: number, field: keyof KeyValue, value: string | boolean) => void;
  onRemove: (index: number) => void;
}

const KeyValueRow = memo(function KeyValueRow({
  item,
  index,
  itemsLength,
  onUpdate,
  onRemove,
}: KeyValueRowProps) {
  return (
    <Table.Tr className="border-b border-border hover:bg-bg-hover">
      <Table.Td>
        <Checkbox
          checked={item.enabled}
          onChange={(e) => onUpdate(index, 'enabled', e.currentTarget.checked)}
          color="orange"
          size="sm"
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={item.key}
          onChange={(e) => onUpdate(index, 'key', e.target.value)}
          placeholder="Key"
          variant="unstyled"
          size="sm"
          styles={INPUT_STYLES}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={item.value}
          onChange={(e) => onUpdate(index, 'value', e.target.value)}
          placeholder="Value"
          variant="unstyled"
          size="sm"
          styles={INPUT_STYLES}
        />
      </Table.Td>
      <Table.Td>
        {itemsLength > 1 && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onRemove(index)}
            className="hover:text-error"
          >
            <IconX size={14} />
          </ActionIcon>
        )}
      </Table.Td>
    </Table.Tr>
  );
});

interface KeyValueTableProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
}

const KeyValueTable = memo(function KeyValueTable({ items, onChange }: KeyValueTableProps) {
  const handleUpdate = useCallback(
    (index: number, field: keyof KeyValue, value: string | boolean) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (
        index === items.length - 1 &&
        (newItems[index].key || newItems[index].value)
      ) {
        newItems.push({ key: '', value: '', enabled: true });
      }
      onChange(newItems);
    },
    [items, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (items.length === 1) return;
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  const filledItems = useMemo(
    () => items.filter((item) => item.key || item.value),
    [items]
  );

  const allSelected = useMemo(
    () => filledItems.length > 0 && filledItems.every((item) => item.enabled),
    [filledItems]
  );

  const partialSelected = useMemo(() => {
    if (filledItems.length === 0) return false;
    const enabledCount = filledItems.filter((item) => item.enabled).length;
    return enabledCount > 0 && enabledCount < filledItems.length;
  }, [filledItems]);

  const handleToggleAll = useCallback(() => {
    const newItems = items.map((item) => {
      if (item.key || item.value) {
        return { ...item, enabled: !allSelected };
      }
      return item;
    });
    onChange(newItems);
  }, [items, onChange, allSelected]);

  return (
    <Table className="w-full">
      <Table.Thead>
        <Table.Tr className="border-b border-border">
          <Table.Th w={40} className="text-text-secondary">
            <Checkbox
              checked={allSelected}
              indeterminate={partialSelected}
              onChange={handleToggleAll}
              color="orange"
              size="sm"
              disabled={filledItems.length === 0}
            />
          </Table.Th>
          <Table.Th className="text-text-secondary font-medium">Key</Table.Th>
          <Table.Th className="text-text-secondary font-medium">Value</Table.Th>
          <Table.Th w={40} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item, index) => (
          <KeyValueRow
            key={index}
            item={item}
            index={index}
            itemsLength={items.length}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </Table.Tbody>
    </Table>
  );
});

export const RequestTabs = memo(function RequestTabs({
  params,
  headers,
  body,
  method,
  onParamsChange,
  onHeadersChange,
  onBodyChange,
  requestSchema,
  wsEvents,
  onSendEvent,
}: RequestTabsProps) {
  const methodUpper = method?.toUpperCase() || '';
  const showBodyTab = METHODS_WITH_BODY.includes(methodUpper);
  const isWs = methodUpper === 'WS';

  // WebSocket event editing state
  const [selectedWsEvent, setSelectedWsEvent] = useState<WsEvent | null>(null);
  const [wsEventData, setWsEventData] = useState<string>('');

  // Get available tabs based on current state
  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (!isWs) {
      tabs.push('params', 'headers');
      if (showBodyTab) tabs.push('body');
    } else {
      tabs.push('events');
    }
    return tabs;
  }, [isWs, showBodyTab]);

  const getDefaultTab = () => {
    if (isWs) return 'events';
    if (showBodyTab) return 'body';
    return 'params';
  };

  const [activeTab, setActiveTab] = useState<string | null>(getDefaultTab);
  const [prevMethod, setPrevMethod] = useState(methodUpper);
  const [prevWsEvents, setPrevWsEvents] = useState(wsEvents);

  // Adjust state during render when method changes (React recommended pattern)
  if (prevMethod !== methodUpper) {
    setPrevMethod(methodUpper);
    setActiveTab(getDefaultTab());
    setSelectedWsEvent(null);
    setWsEventData('');
  }

  // Adjust state during render when wsEvents change
  if (prevWsEvents !== wsEvents) {
    setPrevWsEvents(wsEvents);
    setSelectedWsEvent(null);
    setWsEventData('');
  }

  // Ensure activeTab is valid
  const effectiveActiveTab =
    activeTab && availableTabs.includes(activeTab) ? activeTab : getDefaultTab();

  const hasExample = useMemo(() => {
    return hasBodyFields(requestSchema);
  }, [requestSchema]);

  const handleLoadExample = () => {
    if (!requestSchema) return;
    const exampleData = generateExampleFromSchema(requestSchema);
    onBodyChange(JSON.stringify(exampleData, null, 2));
  };

  const handleSelectWsEvent = (event: WsEvent) => {
    setSelectedWsEvent(event);
    const data = event.request ? JSON.stringify(generateExampleFromSchema(event.request), null, 2) : '{}';
    setWsEventData(data);
  };

  const handleSendWsEvent = () => {
    if (!onSendEvent || !selectedWsEvent) return;
    onSendEvent(selectedWsEvent.name, wsEventData);
  };

  const handleBackToEventsList = () => {
    setSelectedWsEvent(null);
    setWsEventData('');
  };

  const getActiveCount = (items: KeyValue[]) =>
    items.filter((p) => p.key).length;

  return (
    <Tabs
      value={effectiveActiveTab}
      onChange={setActiveTab}
      className="flex-1 flex flex-col min-h-0"
      styles={TABS_STYLES}
    >
      <Tabs.List className="bg-bg-secondary border-b border-border">
        {!isWs && (
          <>
            <Tabs.Tab value="params">
              Params
              {getActiveCount(params) > 0 && (
                <Badge size="xs" color="orange" ml={6}>
                  {getActiveCount(params)}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="headers">
              Headers
              {getActiveCount(headers) > 0 && (
                <Badge size="xs" color="orange" ml={6}>
                  {getActiveCount(headers)}
                </Badge>
              )}
            </Tabs.Tab>
          </>
        )}
        {showBodyTab && <Tabs.Tab value="body">Body</Tabs.Tab>}
        {isWs && (
          <Tabs.Tab value="events">
            Events
            {wsEvents && wsEvents.length > 0 && (
              <Badge size="xs" color="violet" ml={6}>
                {wsEvents.length}
              </Badge>
            )}
          </Tabs.Tab>
        )}
      </Tabs.List>

      {!isWs && (
        <>
          <Tabs.Panel value="params" className="overflow-auto bg-bg-primary">
            <KeyValueTable items={params} onChange={onParamsChange} />
          </Tabs.Panel>

          <Tabs.Panel value="headers" className="overflow-auto bg-bg-primary">
            <KeyValueTable items={headers} onChange={onHeadersChange} />
          </Tabs.Panel>
        </>
      )}

      {showBodyTab && (
        <Tabs.Panel value="body" className="overflow-hidden bg-bg-primary">
          <Box style={BODY_BOX_STYLE}>
            {hasExample && (
              <Tooltip label="Load Example" position="left">
                <ActionIcon
                  variant="filled"
                  color="orange"
                  size="md"
                  onClick={handleLoadExample}
                  style={LOAD_EXAMPLE_BUTTON_STYLE}
                >
                  <IconFileImport size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Editor
              height="100%"
              defaultLanguage="json"
              value={body}
              onChange={(value) => onBodyChange(value || '')}
              theme="vs-dark"
              options={EDITOR_OPTIONS}
            />
          </Box>
        </Tabs.Panel>
      )}

      {isWs && (
        <Tabs.Panel value="events" className="overflow-hidden bg-bg-primary">
          {selectedWsEvent ? (
            <Box className="flex flex-col h-full">
              <Box className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border">
                <Group gap="sm">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={handleBackToEventsList}
                  >
                    <IconArrowLeft size={16} />
                  </ActionIcon>
                  <IconMessage size={14} color="var(--color-accent-violet)" />
                  <Text size="sm" fw={600}>{selectedWsEvent.name}</Text>
                  {selectedWsEvent.request && (
                    <Badge size="xs" variant="outline" color="gray">Request</Badge>
                  )}
                </Group>
                <Button
                  size="xs"
                  color="violet"
                  leftSection={<IconSend size={14} />}
                  onClick={handleSendWsEvent}
                >
                  Send
                </Button>
              </Box>
              <Box style={BODY_BOX_STYLE}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={wsEventData}
                  onChange={(value) => setWsEventData(value || '')}
                  theme="vs-dark"
                  options={EDITOR_OPTIONS}
                />
              </Box>
            </Box>
          ) : (
            <Table className="w-full">
              <Table.Thead>
                <Table.Tr className="border-b border-border">
                  <Table.Th className="text-text-secondary font-medium px-4">Event Name</Table.Th>
                  <Table.Th className="text-text-secondary font-medium">Schema</Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {wsEvents?.map((event) => (
                  <Table.Tr
                    key={event.name}
                    className="border-b border-border hover:bg-bg-hover cursor-pointer"
                    onClick={() => handleSelectWsEvent(event)}
                  >
                    <Table.Td className="px-4">
                      <Group gap="xs">
                        <IconMessage size={14} color="var(--color-accent-violet)" />
                        <Text size="sm" fw={500}>{event.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {event.request && (
                        <Badge size="xs" variant="outline" color="gray">Request</Badge>
                      )}
                      {event.response && (
                        <Badge size="xs" variant="outline" color="blue" ml={4}>Response</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectWsEvent(event);
                        }}
                      >
                        <IconChevronRight size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(!wsEvents || wsEvents.length === 0) && (
                  <Table.Tr>
                    <Table.Td colSpan={3} className="text-center py-8">
                      <Text size="sm" c="dimmed">No events defined</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      )}

    </Tabs>
  );
});
