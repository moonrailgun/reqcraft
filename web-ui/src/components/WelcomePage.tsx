import { Box, Text, Title, SimpleGrid, Paper, ThemeIcon, Stack, Badge, Group, Kbd } from '@mantine/core';
import {
  IconSend,
  IconCode,
  IconBolt,
  IconBrandGithub,
  IconTerminal2,
  IconApi,
  IconSettings,
  IconBookmark,
  IconCommand,
} from '@tabler/icons-react';

interface WelcomePageProps {
  endpointCount: number;
  mockMode: boolean;
}

const features = [
  {
    icon: IconSend,
    title: 'Send Requests',
    description: 'Select an API endpoint from the sidebar to start testing',
    color: 'orange',
  },
  {
    icon: IconCode,
    title: 'DSL Powered',
    description: 'Define your APIs using the .rqc DSL configuration',
    color: 'blue',
  },
  {
    icon: IconBolt,
    title: 'Mock Mode',
    description: 'Get instant mock responses for rapid development',
    color: 'yellow',
  },
  {
    icon: IconApi,
    title: 'Multi-Environment',
    description: 'Switch between different base URLs easily',
    color: 'green',
  },
];

const quickActions = [
  { icon: IconTerminal2, label: 'rqc init', desc: 'Initialize project' },
  { icon: IconSettings, label: 'rqc dev', desc: 'Start dev server' },
  { icon: IconBrandGithub, label: 'rqc dev --mock', desc: 'Enable mock mode' },
];

export function WelcomePage({ endpointCount, mockMode }: WelcomePageProps) {
  return (
    <Box className="flex-1 flex flex-col items-center justify-center p-8 bg-bg-primary overflow-auto">
      <Stack align="center" gap="xl" maw={800} w="100%">
        {/* Logo and Title */}
        <Box className="text-center">
          <Group justify="center" gap="sm" mb="md">
            <Box
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
              }}
            >
              R
            </Box>
          </Group>
          <Title
            order={1}
            className="text-4xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ReqCraft
          </Title>
          <Text c="dimmed" size="lg">
            A powerful API testing tool powered by DSL configuration
          </Text>
        </Box>

        {/* Status Badges */}
        <Group gap="sm">
          <Badge
            size="lg"
            variant="light"
            color="orange"
            leftSection={<IconApi size={14} />}
          >
            {endpointCount} Endpoints Loaded
          </Badge>
          {mockMode && (
            <Badge
              size="lg"
              variant="light"
              color="yellow"
              leftSection={<IconBolt size={14} />}
            >
              Mock Mode Active
            </Badge>
          )}
        </Group>

        {/* Getting Started */}
        <Paper
          p="lg"
          radius="lg"
          className="w-full"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Group gap="sm" mb="md">
            <IconBookmark size={20} className="text-orange-500" />
            <Text fw={600}>Getting Started</Text>
          </Group>
          <Text c="dimmed" size="sm" mb="lg">
            Select an API endpoint from the left sidebar to start making requests.
            You can also use the following CLI commands:
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {quickActions.map((action) => (
              <Box
                key={action.label}
                className="p-3 rounded-lg"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Group gap="xs" mb={4}>
                  <action.icon size={16} className="text-orange-500" />
                  <Text size="sm" fw={600} className="font-mono">
                    {action.label}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {action.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>

        {/* Features Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" w="100%">
          {features.map((feature) => (
            <Paper
              key={feature.title}
              p="md"
              radius="md"
              className="transition-all duration-200 hover:translate-y-[-2px]"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Group gap="md">
                <ThemeIcon
                  size={44}
                  radius="md"
                  variant="light"
                  color={feature.color}
                >
                  <feature.icon size={24} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm">
                    {feature.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {feature.description}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        {/* Quick Navigation Hint */}
        <Paper
          p="md"
          radius="md"
          className="w-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(247, 147, 30, 0.1) 100%)',
            border: '1px solid var(--color-accent)',
          }}
        >
          <Group justify="center" gap="md">
            <IconCommand size={20} className="text-accent" />
            <Group gap={6}>
              <Text size="sm" c="dimmed">Press</Text>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
              <Text size="sm" c="dimmed">to quickly search and navigate to any API</Text>
            </Group>
          </Group>
        </Paper>

        {/* Footer */}
        <Text size="xs" c="dimmed" className="text-center">
          Configure your APIs in the <code className="text-orange-400">.rqc</code> file
          and run <code className="text-orange-400">rqc dev</code> to start
        </Text>
      </Stack>
    </Box>
  );
}
