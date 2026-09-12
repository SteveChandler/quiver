const base = require('./jest.config');
module.exports = async () => ({ ...(await base()), roots: ['<rootDir>'], setupFiles: ['<rootDir>/contracts/email-system/capture-fetch.cjs'], testMatch: ['<rootDir>/contracts/email-system/*.http-contract.ts'], testTimeout: 30000 });
