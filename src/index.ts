#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as cheerio from "cheerio";
import { z } from "zod";
import {
  getCrateDocumentation,
  getCrateVersions,
  getFeatureFlags,
  getSourceCode,
  getTypeInfo,
  searchCrates,
  searchSymbols,
} from "./service.js";
import logger from "./utils/logger.js";

/**
 * Rust Docs MCP Server
 *
 * This server provides tools for accessing Rust documentation from docs.rs.
 * It allows searching for crates, viewing documentation, type information,
 * feature flags, version numbers, and source code.
 */
class RustDocsMcpServer {
  private server: McpServer;

  constructor() {
    // Create the MCP server
    this.server = new McpServer({
      name: "rust-docs",
      version: "1.0.0",
    });

    // Set up tools
    this.setupTools();

    // Error handling
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", { error });
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", { reason });
    });
  }

  /**
   * Set up the MCP tools
   */
  private setupTools() {
    // Tool: Search for crates
    this.server.tool(
      "search_crates",
      {
        query: z.string().min(1).describe("Search query for crates"),
        page: z.number().optional().describe("Page number (starts at 1)"),
        perPage: z.number().optional().describe("Results per page"),
      },
      async ({ query, page, perPage }) => {
        try {
          const result = await searchCrates({
            query,
            page,
            perPage,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Error in search_crates tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error searching for crates: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Get crate documentation
    this.server.tool(
      "get_crate_documentation",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
        version: z
          .string()
          .optional()
          .describe("Specific version (defaults to latest)"),
      },
      async ({ crateName, version }) => {
        try {
          const html = await getCrateDocumentation(crateName, version);

          // Use cheerio to parse the HTML and extract the content
          const $ = cheerio.load(html);

          // Try different selectors to find the main content
          let content = "Documentation content not found";
          let contentFound = false;

          // First try the main docs.rs content selectors
          const selectors = [
            `#${crateName}`, // Primary content section (e.g., #serde)
            "#main-content", // Alternative main content
            "main", // HTML5 main element
            ".docblock", // Documentation blocks
            ".rustdoc", // Rustdoc container
            ".content", // General content
          ];

          for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
              content = element.html() || content;
              contentFound = true;
              break;
            }
          }

          // Log the extraction result
          if (!contentFound) {
            logger.warn(`Failed to extract content for crate: ${crateName}`);
          } else {
            logger.info(
              `Successfully extracted content for crate: ${crateName}`
            );
          }

          return {
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          };
        } catch (error) {
          logger.error("Error in get_crate_documentation tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error getting documentation: ${
                  (error as Error).message
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Get type information
    this.server.tool(
      "get_type_info",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
        path: z
          .string()
          .min(1)
          .describe('Path to the type (e.g., "std/vec/struct.Vec.html")'),
        version: z
          .string()
          .optional()
          .describe("Specific version (defaults to latest)"),
      },
      async ({ crateName, path, version }) => {
        try {
          const typeInfo = await getTypeInfo(crateName, path, version);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(typeInfo, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Error in get_type_info tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error getting type information: ${
                  (error as Error).message
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Get feature flags
    this.server.tool(
      "get_feature_flags",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
        version: z
          .string()
          .optional()
          .describe("Specific version (defaults to latest)"),
      },
      async ({ crateName, version }) => {
        try {
          const features = await getFeatureFlags(crateName, version);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(features, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Error in get_feature_flags tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error getting feature flags: ${
                  (error as Error).message
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Get crate versions
    this.server.tool(
      "get_crate_versions",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
      },
      async ({ crateName }) => {
        try {
          const versions = await getCrateVersions(crateName);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(versions, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Error in get_crate_versions tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error getting crate versions: ${
                  (error as Error).message
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Get source code
    this.server.tool(
      "get_source_code",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
        path: z.string().min(1).describe("Path to the source file"),
        version: z
          .string()
          .optional()
          .describe("Specific version (defaults to latest)"),
      },
      async ({ crateName, path, version }) => {
        try {
          const sourceCode = await getSourceCode(crateName, path, version);
          return {
            content: [
              {
                type: "text",
                text: sourceCode,
              },
            ],
          };
        } catch (error) {
          logger.error("Error in get_source_code tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error getting source code: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool: Search for symbols
    this.server.tool(
      "search_symbols",
      {
        crateName: z.string().min(1).describe("Name of the crate"),
        query: z.string().min(1).describe("Search query for symbols"),
        version: z
          .string()
          .optional()
          .describe("Specific version (defaults to latest)"),
      },
      async ({ crateName, query, version }) => {
        try {
          const symbols = await searchSymbols(crateName, query, version);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(symbols, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Error in search_symbols tool", { error });
          return {
            content: [
              {
                type: "text",
                text: `Error searching for symbols: ${
                  (error as Error).message
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Start the server
   */
  async start() {
    try {
      logger.info("Starting Rust Docs MCP Server");
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info("Server connected via stdio");
    } catch (error) {
      logger.error("Failed to start server", { error });
      process.exit(1);
    }
  }
}

// Create and start the server
const server = new RustDocsMcpServer();
server.start().catch((error) => {
  logger.error("Error starting server", { error });
  process.exit(1);
});
