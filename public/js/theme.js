'use strict';
// Runs before first paint. Storage may be blocked in private/embedded contexts.
try {
  const saved = localStorage.getItem('velox.theme.v2');
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
} catch { /* default to Studio dark */ }
