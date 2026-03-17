import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Import tool modules
import * as fsTools from "./tools/fsTools.js";
import * as spiderTools from "./tools/spiderTools.js";
import * as dbTools from "./tools/dbTools.js";
import * as systemTools from "./tools/systemTools.js";
import * as apiTools from "./tools/apiTools.js";

const server = new Server(
  {
    name: "drpy-node-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Map tool names to handler functions
const toolHandlers = {
    // FS Tools
    list_directory: fsTools.list_directory,
    read_file: fsTools.read_file,
    write_file: fsTools.write_file,
    delete_file: fsTools.delete_file,
    
    // Spider Tools
    list_sources: spiderTools.list_sources,
    get_routes_info: spiderTools.get_routes_info,
    fetch_spider_url: spiderTools.fetch_spider_url,
    debug_spider_rule: spiderTools.debug_spider_rule,
    get_spider_template: spiderTools.get_spider_template,
    get_drpy_libs_info: spiderTools.get_drpy_libs_info,
    validate_spider: spiderTools.validate_spider,
    check_syntax: spiderTools.check_syntax,
    
    // API Tools
    get_drpy_api_list: apiTools.get_drpy_api_list,

    // DB Tools
    sql_query: dbTools.sql_query,
    
    // System Tools
    read_logs: systemTools.read_logs,
    manage_config: systemTools.manage_config,
    restart_service: systemTools.restart_service,
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_directory",
        description: "List files and directories in the project",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path relative to project root (default: '.')",
            },
          },
        },
      },
      {
        name: "read_file",
        description: "Read the content of a file (automatically decodes DS sources)",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to project root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "Write content to a file (creates directories if needed)",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to project root",
            },
            content: {
              type: "string",
              description: "Content to write",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "delete_file",
        description: "Delete a file or directory",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "list_sources",
        description: "List all spider sources (js and catvod)",
        inputSchema: {
            type: "object",
            properties: {}
        },
      },
      {
        name: "get_routes_info",
        description: "Get information about registered routes/controllers",
        inputSchema: {
            type: "object",
            properties: {}
        },
      },
      {
        name: "get_drpy_api_list",
        description: "Get the full list of drpy-node API interfaces with parameters and return examples",
        inputSchema: {
            type: "object",
            properties: {}
        },
      },
      {
        name: "fetch_spider_url",
        description: "Fetch a URL using drpy-node's request library to debug connectivity and anti-crawling measures (UA/headers).",
        inputSchema: zodToJsonSchema(
          z.object({
            url: z.string().describe("URL to fetch"),
            options: z.object({
              method: z.string().optional().describe("HTTP method (GET, POST, etc.)"),
              headers: z.record(z.string()).optional().describe("HTTP headers (User-Agent, Cookie, Referer, etc.)"),
              data: z.any().optional().describe("Request body for POST/PUT"),
            }).optional().describe("Request options"),
          })
        ),
      },
      {
        name: "debug_spider_rule",
        description: "Debug drpy spider rules by parsing HTML or fetching URL",
        inputSchema: zodToJsonSchema(
          z.object({
            html: z.string().optional().describe("HTML content to parse"),
            url: z.string().optional().describe("URL to fetch and parse"),
            rule: z.string().describe("The drpy rule to apply (e.g. '.list li', 'a&&href')"),
            mode: z.enum(["pdfa", "pdfh", "pd"]).describe("Parsing mode: pdfa (list), pdfh (html), pd (url)"),
            baseUrl: z.string().optional().describe("Base URL for resolving relative links"),
            options: z.object({
              method: z.string().optional(),
              headers: z.record(z.string()).optional(),
              data: z.any().optional(),
            }).optional().describe("Request options for URL fetch"),
          })
        ),
      },
      {
        name: "get_spider_template",
        description: "Get a standard template for creating a new drpy JS source",
        inputSchema: {
            type: "object",
            properties: {}
        },
      },
      {
        name: "get_drpy_libs_info",
        description: "Get information about available global helper functions and libraries in drpy environment",
        inputSchema: {
            type: "object",
            properties: {}
        },
      },
      {
        name: "read_logs",
        description: "Read the latest application logs",
        inputSchema: {
          type: "object",
          properties: {
            lines: { type: "number", description: "Number of lines to read (default: 50)" }
          }
        }
      },
      {
        name: "sql_query",
        description: "Execute a read-only SQL query on the project database",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "SQL query to execute" }
          },
          required: ["query"]
        }
      },
      {
        name: "manage_config",
        description: "Read or update the project configuration (config/env.json)",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["get", "set"], description: "Action to perform" },
            key: { type: "string", description: "Config key (dot notation supported for nested keys, optional for 'get')" },
            value: { type: "string", description: "Value to set (required for 'set', JSON string supported)" }
          },
          required: ["action"]
        }
      },
      {
        name: "validate_spider",
        description: "Validate a drpy spider file (syntax check + structure validation)",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to project root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "check_syntax",
        description: "Check syntax of a JavaScript file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to project root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "restart_service",
        description: "Restart the drpy-node service (assumes PM2 is used with name 'drpys')",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers[name];

  if (!handler) {
    throw new Error(`Tool not found: ${name}`);
  }

  try {
      return await handler(args);
  } catch (error) {
      return {
          isError: true,
          content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }]
      };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Drpy Node MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
