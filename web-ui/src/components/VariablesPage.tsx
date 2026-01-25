import {
  Box,
  Text,
  Table,
  TextInput,
  Checkbox,
  ActionIcon,
  Badge,
  Tooltip,
  Group,
} from '@mantine/core';
import { IconVariable, IconX } from '@tabler/icons-react';
import type { Variable } from '../utils/variables';

interface VariablesPageProps {
  variables: Variable[];
  onVariablesChange: (variables: Variable[]) => void;
}

export function VariablesPage({
  variables,
  onVariablesChange,
}: VariablesPageProps) {
  const updateVariable = (
    index: number,
    field: keyof Variable,
    value: string | boolean
  ) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [field]: value };

    if (
      index === variables.length - 1 &&
      (newVariables[index].name || newVariables[index].value)
    ) {
      newVariables.push({ name: '', value: '', enabled: true });
    }

    onVariablesChange(newVariables);
  };

  const removeVariable = (index: number) => {
    if (variables.length === 1) return;
    const newVariables = variables.filter((_, i) => i !== index);
    onVariablesChange(newVariables);
  };

  const configVariables = variables.filter((v) => v.isFromConfig && v.name);
  const userVariables = variables.filter((v) => !v.isFromConfig);
  const activeCount = variables.filter((v) => v.name && v.enabled).length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-bg-secondary">
        <Group gap="sm">
          <Box
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)',
            }}
          >
            <IconVariable size={20} color="white" />
          </Box>
          <Box>
            <Group gap="xs">
              <Text fw={600} size="lg" className="text-text-primary">
                Variables
              </Text>
              {activeCount > 0 && (
                <Badge size="sm" color="teal">
                  {activeCount} active
                </Badge>
              )}
            </Group>
            <Text size="sm" className="text-text-secondary">
              Define variables to use across all API requests
            </Text>
          </Box>
        </Group>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Config Variables Section */}
        {configVariables.length > 0 && (
          <Box mb="xl">
            <Group gap="xs" mb="sm">
              <Text size="sm" fw={600} className="text-text-secondary uppercase tracking-wide">
                Config Variables
              </Text>
              <Badge size="xs" variant="light" color="blue">
                from .rqc
              </Badge>
            </Group>
            <Box
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <Table>
                <Table.Thead>
                  <Table.Tr className="border-b border-border">
                    <Table.Th w={50} className="text-text-secondary" />
                    <Table.Th w={200} className="text-text-secondary font-medium">
                      Name
                    </Table.Th>
                    <Table.Th className="text-text-secondary font-medium">
                      Value
                    </Table.Th>
                    <Table.Th w={80} className="text-text-secondary font-medium">
                      Type
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {configVariables.map((variable, idx) => {
                    const realIndex = variables.findIndex(
                      (v) => v.name === variable.name && v.isFromConfig
                    );
                    return (
                      <Table.Tr key={idx} className="border-b border-border hover:bg-bg-hover">
                        <Table.Td>
                          <Checkbox
                            checked={variable.enabled}
                            onChange={(e) =>
                              updateVariable(realIndex, 'enabled', e.currentTarget.checked)
                            }
                            color="teal"
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            style={{
                              fontFamily: 'monospace',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {variable.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            value={variable.value}
                            onChange={(e) =>
                              updateVariable(realIndex, 'value', e.target.value)
                            }
                            placeholder="Enter value..."
                            variant="filled"
                            size="sm"
                            styles={{
                              input: {
                                backgroundColor: 'var(--color-bg-primary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                              },
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="gray">
                            String
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Box>
        )}

        {/* User Variables Section */}
        <Box>
          <Text size="sm" fw={600} mb="sm" className="text-text-secondary uppercase tracking-wide">
            Custom Variables
          </Text>
          <Box
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <Table>
              <Table.Thead>
                <Table.Tr className="border-b border-border">
                  <Table.Th w={50} className="text-text-secondary" />
                  <Table.Th w={200} className="text-text-secondary font-medium">
                    Name
                  </Table.Th>
                  <Table.Th className="text-text-secondary font-medium">
                    Value
                  </Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {userVariables.map((variable, idx) => {
                  const realIndex = variables.findIndex(
                    (v, i) => !v.isFromConfig && variables.slice(0, i + 1).filter((x) => !x.isFromConfig).length === idx + 1
                  );
                  return (
                    <Table.Tr key={idx} className="border-b border-border hover:bg-bg-hover">
                      <Table.Td>
                        <Checkbox
                          checked={variable.enabled}
                          onChange={(e) =>
                            updateVariable(realIndex, 'enabled', e.currentTarget.checked)
                          }
                          color="teal"
                          size="sm"
                          disabled={!variable.name}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={variable.name}
                          onChange={(e) =>
                            updateVariable(realIndex, 'name', e.target.value)
                          }
                          placeholder="variable_name"
                          variant="filled"
                          size="sm"
                          styles={{
                            input: {
                              backgroundColor: 'var(--color-bg-primary)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                              fontFamily: 'monospace',
                            },
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={variable.value}
                          onChange={(e) =>
                            updateVariable(realIndex, 'value', e.target.value)
                          }
                          placeholder="Enter value..."
                          variant="filled"
                          size="sm"
                          styles={{
                            input: {
                              backgroundColor: 'var(--color-bg-primary)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                            },
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        {variable.name && userVariables.length > 1 && (
                          <Tooltip label="Remove variable">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => removeVariable(realIndex)}
                              className="hover:text-error"
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        </Box>

        {/* Usage Hint */}
        <Box
          mt="xl"
          p="md"
          style={{
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            borderRadius: 8,
            border: '1px solid rgba(20, 184, 166, 0.2)',
          }}
        >
          <Text size="sm" fw={500} mb="xs" style={{ color: '#14b8a6' }}>
            How to use variables
          </Text>
          <Text size="sm" className="text-text-secondary">
            Use <code className="bg-bg-secondary px-1.5 py-0.5 rounded text-text-primary">{'{variable_name}'}</code> syntax
            in URL, query parameters, headers, or request body to reference variables.
          </Text>
          <Text size="xs" mt="sm" className="text-text-secondary">
            Example: <code className="bg-bg-secondary px-1.5 py-0.5 rounded">https://api.example.com/{'{version}'}/users</code>
          </Text>
        </Box>
      </div>
    </div>
  );
}
