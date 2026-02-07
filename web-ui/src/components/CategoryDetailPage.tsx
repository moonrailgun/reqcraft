import { Box, Text, Badge, Group, Stack, Card } from '@mantine/core';
import {
  IconFolder,
  IconApi,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { CategoryInfo, ApiEndpoint } from '../App';

interface CategoryDetailPageProps {
  category: CategoryInfo;
  endpoints: ApiEndpoint[];
  onSelectEndpoint: (endpoint: ApiEndpoint) => void;
  onSelectCategory: (category: CategoryInfo) => void;
}

const methodColors: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'yellow',
  DELETE: 'red',
  PATCH: 'teal',
  WS: 'violet',
  SIO: 'lime',
  SSE: 'orange',
};

export function CategoryDetailPage({
  category,
  endpoints,
  onSelectEndpoint,
  onSelectCategory,
}: CategoryDetailPageProps) {
  const categoryEndpoints = endpoints.filter(
    (ep) => ep.categoryId === category.id
  );

  const displayName = category.name || category.id.replace(/^cat-/, '').split('-')[0];

  return (
    <Box className="h-full overflow-auto p-8">
      <Box className="max-w-4xl mx-auto">
        {/* Header */}
        <Group gap="md" mb="xl">
          <Box
            className="w-16 h-16 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <IconFolder size={32} color="white" />
          </Box>
          <Box>
            <Text size="xl" fw={700}>
              {displayName}
            </Text>
            {category.desc && (
              <Text size="sm" c="dimmed" mt={4}>
                {category.desc}
              </Text>
            )}
          </Box>
        </Group>

        {/* Stats */}
        <Group gap="md" mb="xl">
          <Badge
            size="lg"
            variant="light"
            color="orange"
            leftSection={<IconApi size={14} />}
          >
            {categoryEndpoints.length} Endpoints
          </Badge>
          {category.children.length > 0 && (
            <Badge
              size="lg"
              variant="light"
              color="violet"
              leftSection={<IconFolder size={14} />}
            >
              {category.children.length} Sub-categories
            </Badge>
          )}
        </Group>

        {/* Description Section */}
        {category.desc && (
          <Card withBorder mb="xl" className="bg-bg-secondary">
            <Group gap="xs" mb="sm">
              <IconInfoCircle size={16} className="text-text-secondary" />
              <Text size="sm" fw={500}>
                Description
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {category.desc}
            </Text>
          </Card>
        )}

        {/* Endpoints List */}
        <Box>
          <Text size="sm" fw={500} mb="md" className="text-text-secondary">
            ENDPOINTS IN THIS CATEGORY
          </Text>
          <Stack gap="sm">
            {categoryEndpoints.length === 0 ? (
              <Text size="sm" c="dimmed">
                No endpoints in this category
              </Text>
            ) : (
              categoryEndpoints.map((endpoint) => (
                <Card
                  key={endpoint.id}
                  withBorder
                  className="bg-bg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
                  onClick={() => onSelectEndpoint(endpoint)}
                  padding="md"
                >
                  <Group justify="space-between">
                    <Group gap="md">
                      <Badge
                        color={methodColors[
                          endpoint.endpointType === 'websocket' ? 'WS'
                          : endpoint.endpointType === 'socketio' ? 'SIO'
                          : endpoint.endpointType === 'sse' ? 'SSE'
                          : (endpoint.method || 'GET')
                        ] || 'gray'}
                        variant="filled"
                        size="sm"
                      >
                        {endpoint.endpointType === 'websocket' ? 'WS'
                          : endpoint.endpointType === 'socketio' ? 'SIO'
                          : endpoint.endpointType === 'sse' ? 'SSE'
                          : (endpoint.method || 'GET')}
                      </Badge>
                      <Box>
                        <Text size="sm" fw={500}>
                          {endpoint.name || endpoint.path}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {endpoint.path}
                        </Text>
                      </Box>
                    </Group>
                    {endpoint.description && (
                      <Text size="xs" c="dimmed" maw={300} truncate>
                        {endpoint.description}
                      </Text>
                    )}
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Box>

        {/* Sub-categories */}
        {category.children.length > 0 && (
          <Box mt="xl">
            <Text size="sm" fw={500} mb="md" className="text-text-secondary">
              SUB-CATEGORIES
            </Text>
            <Stack gap="sm">
              {category.children.map((child) => {
                const childEndpoints = endpoints.filter(
                  (ep) => ep.categoryId === child.id
                );
                const childDisplayName =
                  child.name || child.id.replace(/^cat-/, '').split('-')[0];

                return (
                  <Card
                    key={child.id}
                    withBorder
                    className="bg-bg-secondary hover:bg-bg-hover cursor-pointer transition-colors"
                    padding="md"
                    onClick={() => onSelectCategory(child)}
                  >
                    <Group justify="space-between">
                      <Group gap="md">
                        <IconFolder size={20} className="text-orange-500" />
                        <Box>
                          <Text size="sm" fw={500}>
                            {childDisplayName}
                          </Text>
                          {child.desc && (
                            <Text size="xs" c="dimmed">
                              {child.desc}
                            </Text>
                          )}
                        </Box>
                      </Group>
                      <Badge variant="light" color="gray" size="sm">
                        {childEndpoints.length} endpoints
                      </Badge>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
