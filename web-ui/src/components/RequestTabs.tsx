import { useMemo } from 'react';
import {
  Box,
  Tabs,
  Table,
  Checkbox,
  TextInput,
  ActionIcon,
  Badge,
  Tooltip,
} from '@mantine/core';
import { IconX, IconFileImport } from '@tabler/icons-react';
import Editor from '@monaco-editor/react';
import type { KeyValue, SchemaBlock, Field } from '../App';

interface RequestTabsProps {
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  method: string;
  onParamsChange: (params: KeyValue[]) => void;
  onHeadersChange: (headers: KeyValue[]) => void;
  onBodyChange: (body: string) => void;
  requestSchema?: SchemaBlock;
}

const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

function generateExampleValue(field: Field): unknown {
  if (field.example !== undefined) {
    return field.example;
  }

  // Default values based on type
  switch (field.fieldType) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      if (field.nested) {
        return generateExampleFromSchema(field.nested);
      }
      return {};
    default:
      return '';
  }
}

function generateExampleFromSchema(schema: SchemaBlock): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (field.nested) {
      result[field.name] = generateExampleFromSchema(field.nested);
    } else {
      result[field.name] = generateExampleValue(field);
    }
  }

  return result;
}

export function RequestTabs({
  params,
  headers,
  body,
  method,
  onParamsChange,
  onHeadersChange,
  onBodyChange,
  requestSchema,
}: RequestTabsProps) {
  const showBodyTab = METHODS_WITH_BODY.includes(method.toUpperCase());
  const hasExample = useMemo(() => {
    if (!requestSchema?.fields) return false;
    return requestSchema.fields.some((f) => f.example !== undefined);
  }, [requestSchema]);

  const handleLoadExample = () => {
    if (!requestSchema) return;
    const exampleData = generateExampleFromSchema(requestSchema);
    onBodyChange(JSON.stringify(exampleData, null, 2));
  };
  const updateKeyValue = (
    items: KeyValue[],
    index: number,
    field: keyof KeyValue,
    value: string | boolean,
    onChange: (items: KeyValue[]) => void
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (
      index === items.length - 1 &&
      (newItems[index].key || newItems[index].value)
    ) {
      newItems.push({ key: '', value: '', enabled: true });
    }

    onChange(newItems);
  };

  const removeKeyValue = (
    items: KeyValue[],
    index: number,
    onChange: (items: KeyValue[]) => void
  ) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const getActiveCount = (items: KeyValue[]) =>
    items.filter((p) => p.key).length;

  const renderKeyValueTable = (
    items: KeyValue[],
    onChange: (items: KeyValue[]) => void
  ) => (
    <Table className="w-full">
      <Table.Thead>
        <Table.Tr className="border-b border-border">
          <Table.Th w={40} className="text-text-secondary" />
          <Table.Th className="text-text-secondary font-medium">Key</Table.Th>
          <Table.Th className="text-text-secondary font-medium">Value</Table.Th>
          <Table.Th w={40} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item, index) => (
          <Table.Tr key={index} className="border-b border-border hover:bg-bg-hover">
            <Table.Td>
              <Checkbox
                checked={item.enabled}
                onChange={(e) =>
                  updateKeyValue(
                    items,
                    index,
                    'enabled',
                    e.currentTarget.checked,
                    onChange
                  )
                }
                color="orange"
                size="sm"
              />
            </Table.Td>
            <Table.Td>
              <TextInput
                value={item.key}
                onChange={(e) =>
                  updateKeyValue(items, index, 'key', e.target.value, onChange)
                }
                placeholder="Key"
                variant="unstyled"
                size="sm"
                styles={{
                  input: {
                    color: 'var(--color-text-primary)',
                  },
                }}
              />
            </Table.Td>
            <Table.Td>
              <TextInput
                value={item.value}
                onChange={(e) =>
                  updateKeyValue(items, index, 'value', e.target.value, onChange)
                }
                placeholder="Value"
                variant="unstyled"
                size="sm"
                styles={{
                  input: {
                    color: 'var(--color-text-primary)',
                  },
                }}
              />
            </Table.Td>
            <Table.Td>
              {items.length > 1 && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => removeKeyValue(items, index, onChange)}
                  className="hover:text-error"
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );

  return (
    <Tabs
      defaultValue="params"
      className="flex-1 flex flex-col min-h-0"
      styles={{
        root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
        panel: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Tabs.List className="bg-bg-secondary border-b border-border">
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
        {showBodyTab && <Tabs.Tab value="body">Body</Tabs.Tab>}
      </Tabs.List>

      <Tabs.Panel value="params" className="overflow-auto bg-bg-primary">
        {renderKeyValueTable(params, onParamsChange)}
      </Tabs.Panel>

      <Tabs.Panel value="headers" className="overflow-auto bg-bg-primary">
        {renderKeyValueTable(headers, onHeadersChange)}
      </Tabs.Panel>

      {showBodyTab && (
        <Tabs.Panel value="body" className="overflow-hidden bg-bg-primary">
          <Box style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            {hasExample && (
              <Tooltip label="Load Example" position="left">
                <ActionIcon
                  variant="filled"
                  color="orange"
                  size="md"
                  onClick={handleLoadExample}
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    zIndex: 10,
                  }}
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
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
                padding: { top: 12 },
              }}
            />
          </Box>
        </Tabs.Panel>
      )}
    </Tabs>
  );
}
