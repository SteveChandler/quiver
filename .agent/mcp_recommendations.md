# MCP Server Recommendations

To enhance your agentic workflow in Cursor, I recommend installing the following MCP (Model Context Protocol) servers.

## 1. Playwright

- **Purpose**: Allows agents to run Playwright tests, explore the UI, and inspect DOM elements directly.
- **Why**: Critical for our "Growth Engineering" phase to verify visual changes and user flows.
- **Command**: `npx -y @playwright/mcp-server`

## 2. PostgreSQL

- **Purpose**: Allows agents to inspect your local Supabase database schema and run read-only queries.
- **Why**: Essential for verifying that your local migrations and seeds worked correctly (`supabase/ARCHITECTURE.md`).
- **Command**: `npx -y @modelcontextprotocol/server-postgres postgres://postgres:postgres@localhost:54322/postgres` (Default Supabase local port)

## 3. GitHub

- **Purpose**: Allows agents to search issues, create PRs, and read file history.
- **Why**: Useful for checking if a bug has already been reported or understanding why a line of code changed.
- **Command**: `npx -y @modelcontextprotocol/server-github` (Requires valid GITHUB_TOKEN)

## 4. Sentry

- **Purpose**: Allows reading error logs and stack traces from production/staging.
- **Why**: Great for "Debugging" tasks where you need to see the real crash data.
- **Command**: `npx -y @sentry/mcp-server`
