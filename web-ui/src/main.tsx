import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import './index.css';
import App from './App.tsx';

const theme = createTheme({
  primaryColor: 'orange',
  colors: {
    dark: [
      '#e4e4e4',
      '#9d9d9d',
      '#6d6d6d',
      '#505050',
      '#404040',
      '#2d2d2d',
      '#252526',
      '#1c1c1c',
      '#141414',
      '#0a0a0a',
    ],
  },
  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
  defaultRadius: 'md',
  focusRing: 'never',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>
);
