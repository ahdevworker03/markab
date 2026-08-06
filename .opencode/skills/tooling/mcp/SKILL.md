---
name: mcp
description: Model Context Protocol (MCP) server integration, discovering and connecting to MCP servers (GitHub, Filesystem, PostgreSQL, Docker), tool selection and usage, server permissions and security, server discovery, best practices for agent-tool interaction, Claude Desktop configuration, and MCP server development. Applicable when connecting AI agents to external tools, configuring MCP servers, selecting tools for tasks, or developing MCP integrations.
---

# MCP

## Purpose

This skill guides the agent in using the Model Context Protocol (MCP) to connect AI assistants with external tools and services. MCP is an open protocol that standardizes how AI agents discover and interact with tools, data sources, and services. The skill covers connecting to MCP servers (GitHub, Filesystem, PostgreSQL, Docker), discovering available tools, selecting the right tools for tasks, managing permissions, and following security best practices.

---

## When to Load

- User is setting up MCP servers or connecting an AI agent to external tools.
- User mentions: `MCP`, `Model Context Protocol`, `MCP server`, `tool discovery`, `Claude Desktop`, `mcp.json`, `tool selection`, `permissions`, `tool approval`.
- User asks about integrating with GitHub, filesystem, PostgreSQL, Docker, or other external services via MCP.
- User is developing an MCP server or configuring MCP clients.

---

## When NOT to Load

- General application development without MCP integration.
- Infrastructure or deployment configuration unrelated to MCP.
- Writing application code without external tool interactions.
- Database schema design or API development without MCP context.

---

## Core Principles

1. **Tools Enable Action** – MCP servers expose tools that allow AI agents to take actions (read/write files, run queries, manage repositories). The agent must discover and select the right tool for each task.
2. **Configuration is Local** – MCP servers are configured locally on the client machine (e.g., via `claude_desktop_config.json`). Each server runs as a separate process, and the client communicates with it over stdio or HTTP.
3. **Permissions are Explicit** – Tools are capabilities exposed by the server. The client may require explicit user approval before executing certain tools. The agent must respect permission boundaries.
4. **Multiple Servers, Single Protocol** – Different servers expose different capabilities (e.g., GitHub, Filesystem, PostgreSQL, Docker). The protocol is consistent across all servers.
5. **Discovery Precedes Usage** – The agent must first discover what tools a server provides (via `tools/list`) and understand their input schemas before attempting to use them.
6. **Context is Everything** – MCP provides context to the AI. Different servers can be connected simultaneously, and the agent can use them together to solve complex tasks.

---

## Decision Rules

### Server Discovery

- **IF** you need to connect to an external service, **THEN** determine if the service provides an MCP server.
- **IF** you are working in the current environment, **THEN** discover available MCP servers by checking the MCP configuration file location (e.g., `claude_desktop_config.json` for Claude Desktop or `~/.mcp/config.json`).
- **IF** you are working with a client that supports MCP, **THEN** use the client's built-in discovery mechanism (e.g., Claude Desktop automatically discovers configured servers).
- **IF** you need to connect to a server not pre-configured, **THEN** you can manually configure it by editing the MCP configuration file.

### Tool Selection

- **IF** a task involves GitHub operations (repositories, issues, PRs, commits), **THEN** use the **GitHub MCP Server**.
- **IF** a task involves reading, writing, or manipulating local files, **THEN** use the **Filesystem MCP Server**.
- **IF** a task involves querying or modifying a PostgreSQL database, **THEN** use the **PostgreSQL MCP Server**.
- **IF** a task involves managing Docker containers, images, or Docker Compose, **THEN** use the **Docker MCP Server**.
- **IF** a task requires a tool from a specific domain, **THEN** select the server that provides that domain's capabilities.
- **ALWAYS** check the server's tool list (`tools/list`) before attempting to use a tool to confirm it exists and understand its input schema.

### Permission and Approval

- **IF** a tool modifies data (writing files, deleting data, making API calls), **THEN** the client may require explicit user approval before execution.
- **IF** a tool is read-only (reading files, listing directories, querying data), **THEN** approval may not be required (depending on server configuration).
- **ALWAYS** check if a tool requires approval by reviewing the server's tool description or configuration.
- **IF** permission is denied, **THEN** inform the user and suggest alternative approaches.

### Configuration

- **IF** you are setting up an MCP server for Claude Desktop, **THEN** add it to `claude_desktop_config.json`:
  ```json
  {
    "mcpServers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "your-token"
        }
      }
    }
  }
  ```
- **IF** you are setting up MCP server for other clients, **THEN** follow the client's specific configuration format.
- **ALWAYS** use environment variables for credentials in server configuration – never hardcode tokens in configuration files.
- **NEVER** commit configuration files containing credentials to version control.

---

## Common MCP Servers

### GitHub MCP Server

- **Purpose**: Interact with GitHub repositories, issues, pull requests, and commits.
- **Capabilities**:
  - List, create, and update issues and PRs
  - Read and write repository files
  - Manage branches and commits
  - Search code and repositories
  - Manage repository settings
- **Connection**: `npx -y @modelcontextprotocol/server-github`
- **Authentication**: Requires a GitHub Personal Access Token (`GITHUB_TOKEN`).
- **When to Use**: When you need to manage code repositories, handle issues, review PRs, or automate GitHub workflows.

### Filesystem MCP Server

- **Purpose**: Read, write, and manipulate files and directories on the local filesystem.
- **Capabilities**:
  - Read and write files
  - List directory contents
  - Create and delete directories
  - Move, copy, and rename files
  - Get file metadata
- **Connection**: `npx -y @modelcontextprotocol/server-filesystem`
- **Access Control**: Typically limited to specific directories (e.g., project root) for security.
- **When to Use**: When you need to read or write files, manage project structure, or automate file operations.

### PostgreSQL MCP Server

- **Purpose**: Query and manage PostgreSQL databases.
- **Capabilities**:
  - Execute read and write queries
  - Inspect schema and metadata
  - Manage tables, indexes, and views
  - Run migrations
  - Export and import data
- **Connection**: `npx -y @modelcontextprotocol/server-postgres`
- **Configuration**: Requires connection string or host/database credentials.
- **When to Use**: When you need to query data, inspect the database schema, or run migrations from the agent.

### Docker MCP Server

- **Purpose**: Manage Docker containers, images, and Docker Compose environments.
- **Capabilities**:
  - Start, stop, and manage containers
  - Build and manage images
  - Manage Docker Compose services
  - Inspect container logs
  - Manage volumes and networks
- **Connection**: `npx -y @modelcontextprotocol/server-docker`
- **Access Control**: May require Docker socket access or specific permissions.
- **When to Use**: When you need to orchestrate containers, check service health, or automate deployment tasks.

---

## Best Practices

### Discovery and Exploration

1. **Check Available Servers** – First, discover which MCP servers are configured in the current environment.
2. **List Server Capabilities** – For each server, get the list of available tools and understand their purpose.
3. **Review Input Schemas** – Always review the `inputSchema` of a tool to understand the required and optional parameters.
4. **Test with Simple Calls** – Start with simple, read-only operations before making changes.

### Tool Selection Strategy

1. **Match the Task to the Server** – Choose the server that best matches the domain of the task.
2. **Combine Servers** – Use multiple servers together for complex tasks (e.g., GitHub + Filesystem for code changes).
3. **Read vs. Write** – Prefer read-only tools when exploring. Write operations may require approval.
4. **Check Tool Descriptions** – Tool names and descriptions are usually descriptive of their purpose.

### Security and Permissions

1. **Use Least Privilege** – Only grant permissions necessary for the task.
2. **Never Hardcode Credentials** – Use environment variables or configuration files (not in version control) for authentication.
3. **Review Before Approving** – Before approving write operations, verify the operation is correct.
4. **Audit Tool Usage** – Review tool execution logs to understand what operations were performed.
5. **Rotate Tokens Regularly** – For long-lived integrations, rotate authentication tokens periodically.

### Configuration Management

1. **Store Config in User Directory** – Keep configuration files in user-specific directories (e.g., `~/.config/mcp` or `~/.mcp`).
2. **Use `env` for Secrets** – Always use `env` field in configuration for credentials, never hardcode them in the config file.
3. **Document Required Variables** – Document which environment variables are needed for each server.
4. **Version Control Ignore** – Add configuration files with secrets to `.gitignore`.

---

## Anti-Patterns

| Anti-Pattern                                          | Why it is wrong                                               | Correct approach                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Hardcoding credentials in configuration               | Exposes secrets; cannot be rotated.                           | Use environment variables.                                           |
| Committing MCP config with secrets to version control | Credentials are exposed to all repository viewers.            | Add config files with secrets to `.gitignore`; use `.example` files. |
| Using tools without checking their schema             | Incorrect parameters cause errors.                            | Always check `inputSchema` first.                                    |
| Assuming a tool exists without discovery              | Tool calls fail.                                              | Discover available tools via `tools/list` first.                     |
| Granting permissions without review                   | Accidental or unintended operations.                          | Review read vs. write operations before approving.                   |
| Using the wrong server for a task                     | Inefficient; may fail.                                        | Select the server that best matches the domain of the task.          |
| Not handling tool errors                              | Errors are unhandled; user doesn't know why operation failed. | Handle errors gracefully and provide feedback.                       |

---

## Common Mistakes & Edge Cases

| Mistake                              | Symptom                                               | Solution                                                          |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| MCP server not starting              | Tool calls fail; "server not found" errors.           | Check command path and dependencies; verify configuration syntax. |
| Token missing or invalid             | Authentication errors.                                | Ensure `GITHUB_TOKEN` or equivalent is set in environment.        |
| Filesystem server access denied      | Cannot read/write files outside allowed directories.  | Configure allowed directories in server configuration.            |
| PostgreSQL connection string invalid | Connection refused; queries fail.                     | Verify database credentials and connection string.                |
| Docker server permission denied      | Cannot manage containers; Docker socket access issue. | Ensure user is in `docker` group or has socket access.            |
| Tool schema changed                  | Tool calls fail after server update.                  | Always check `inputSchema` before making tool calls.              |
| Using a write tool unintentionally   | Unintended changes.                                   | Use read-only tools first; review write operations carefully.     |
| Multiple servers with similar tools  | Confusion about which tool to use.                    | Check domain-specific descriptions; use the most specific tool.   |

---

## Related Skills

- `docker` – for Docker MCP server integration.
- `git` – for understanding Git concepts when using GitHub MCP server.
- `github-actions` – for automating workflows beyond simple MCP tool usage.
- `postgresql` – for database operations via PostgreSQL MCP server.
- `filesystem` – for file operations via Filesystem MCP server.
- `security` – for secure credential and permission management.

---

## Official References

- [Model Context Protocol (MCP) – Official Specification](https://modelcontextprotocol.io/)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [MCP – Server Configuration (Claude Desktop)](https://modelcontextprotocol.io/docs/installation)
- [MCP – Tool Discovery and Usage](https://modelcontextprotocol.io/docs/tools)
- [MCP – Best Practices](https://modelcontextprotocol.io/docs/best-practices)
- [MCP GitHub Server – Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [MCP Filesystem Server – Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- [MCP PostgreSQL Server – Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)
- [MCP Docker Server – Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/docker)
