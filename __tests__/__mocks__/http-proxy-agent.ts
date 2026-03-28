// Mock http-proxy-agent to avoid ESM incompatibility with @tootallnate/once
// in jest-environment-jsdom. The actual proxy functionality is not needed in tests.
const HttpProxyAgent = jest.fn().mockImplementation(() => ({}));
module.exports = HttpProxyAgent;
