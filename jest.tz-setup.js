// Force UTC timezone for deterministic snapshot tests across local/CI environments.
// This file is referenced from jest.config.js `globalSetup` so it runs in the
// parent process before any workers or test environments are created.
module.exports = async () => {
  process.env.TZ = 'UTC';
};
