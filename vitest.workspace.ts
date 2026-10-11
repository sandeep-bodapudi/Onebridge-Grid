import vitest from 'vitest/config';

export default vitest.defineWorkspace([
  'apps/*',
  'services/*',
  'packages/*',
  'edge/*',
  'tests/*'
]);
