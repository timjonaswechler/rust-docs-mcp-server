import { spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
	console.log("Starting test client for Rust Docs MCP Server...");

	// Start the server process
	const serverProcess = spawn("bun", ["run", "src/index.ts"], {
		stdio: ["pipe", "pipe", "inherit"],
	});

	// Create a transport that connects to the server
	const transport = new StdioClientTransport({
		command: "bun",
		args: ["run", "src/index.ts"],
	});

	// Create the client
	const client = new Client(
		{
			name: "test-client",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	try {
		// Connect to the server
		console.log("Connecting to server...");
		await client.connect(transport);
		console.log("Connected to server!");

		// List available tools
		console.log("\nListing available tools:");
		const tools = await client.listTools();
		console.log(JSON.stringify(tools, null, 2));

		// Test search_crates tool
		console.log("\nTesting search_crates tool:");
		const searchResult = await client.callTool({
			name: "search_crates",
			arguments: {
				query: "serde",
			},
		});
		if (
			searchResult.content &&
			Array.isArray(searchResult.content) &&
			searchResult.content.length > 0
		) {
			console.log(searchResult.content[0].text);
		}

		// Test get_crate_versions tool
		console.log("\nTesting get_crate_versions tool:");
		const versionsResult = await client.callTool({
			name: "get_crate_versions",
			arguments: {
				crateName: "tokio",
			},
		});
		if (
			versionsResult.content &&
			Array.isArray(versionsResult.content) &&
			versionsResult.content.length > 0
		) {
			console.log(versionsResult.content[0].text);
		}

		// Test search_symbols tool
		console.log("\nTesting search_symbols tool:");
		const symbolsResult = await client.callTool({
			name: "search_symbols",
			arguments: {
				crateName: "tokio",
				query: "runtime",
			},
		});
		if (
			symbolsResult.content &&
			Array.isArray(symbolsResult.content) &&
			symbolsResult.content.length > 0
		) {
			console.log(symbolsResult.content[0].text);
		}

		console.log("\nAll tests completed successfully!");
	} catch (error) {
		console.error("Error:", error);
	} finally {
		// Close the connection and kill the server process
		await client.close();
		serverProcess.kill();
	}
}

main().catch(console.error);
