import { describe, expect, test, beforeAll } from "bun:test";
import * as cheerio from "cheerio";
import {
	searchCrates,
	getCrateDocumentation,
	getCrateVersions,
	searchSymbols,
	getTypeInfo,
	getCrateDetails,
} from "./service";

describe("service", () => {
	// Set longer timeout for network requests
	const timeout = 15000;

	describe("searchCrates should return results for a valid query", () => {
		test(
			"serde",
			async () => {
				const result = await searchCrates({ query: "serde" });
				expect(result.crates.length).toBeGreaterThan(0);
				expect(result.totalCount).toBeGreaterThan(0);
				// Check that each crate has a version
				for (const crate of result.crates) {
					expect(crate.name).toBeDefined();
					expect(crate.version).toBeDefined();
				}
			},
			timeout,
		);

		test(
			"tokio",
			async () => {
				const result = await searchCrates({ query: "tokio" });
				expect(result.crates.length).toBeGreaterThan(0);
				expect(result.totalCount).toBeGreaterThan(0);
				// Check that each crate has a version
				for (const crate of result.crates) {
					expect(crate.name).toBeDefined();
					expect(crate.version).toBeDefined();
				}
			},
			timeout,
		);

		test(
			"fjall",
			async () => {
				const result = await searchCrates({ query: "fjall" });
				expect(result.crates.length).toBeGreaterThan(0);
				expect(result.totalCount).toBeGreaterThan(0);
			},
			timeout,
		);

		test(
			"pin-project",
			async () => {
				const result = await searchCrates({ query: "pin-project" });
				expect(result.crates.length).toBeGreaterThan(0);
				expect(result.totalCount).toBeGreaterThan(0);
			},
			timeout,
		);

		test(
			"pin_project",
			async () => {
				const result = await searchCrates({ query: "pin_project" });
				expect(result.crates.length).toBeGreaterThan(0);
				expect(result.totalCount).toBeGreaterThan(0);
			},
			timeout,
		);
	});

	test(
		"getCrateDocumentation should return HTML content for a valid crate",
		async () => {
			const html = await getCrateDocumentation("tokio");

			// Verify that we got HTML content back
			expect(html).toBeTruthy();
			expect(html.includes("<!DOCTYPE html>")).toBe(true);

			// Test HTML parsing with cheerio
			const $ = cheerio.load(html);

			// Check for key elements that should be present in the documentation
			expect($("title").text()).toContain("tokio");

			// Check for the main content element
			const mainElement = $("#main");
			expect(mainElement.length).toBeGreaterThan(0);

			// Verify that the main content contains useful information
			const mainContent = mainElement.text();
			expect(mainContent.length).toBeGreaterThan(100);
			expect(mainContent).toContain("Tokio");
		},
		timeout,
	);

	describe("getCrateVersions", () => {
		test(
			"should return versions for a valid crate",
			async () => {
				const versions = await getCrateVersions("tokio");
				expect(versions.length).toBeGreaterThan(0);
				
				// Check that each version has the expected properties
				for (const version of versions) {
					expect(version.version).toBeDefined();
					expect(typeof version.isYanked).toBe("boolean");
					expect(version.releaseDate).toBeDefined();
				}
			},
			timeout,
		);
	});

	test(
		"searchSymbols should return symbols for a valid query",
		async () => {
			const symbols = await searchSymbols("tokio", "runtime");
			expect(symbols.length).toBeGreaterThan(0);
		},
		timeout,
	);

	test(
		"getTypeInfo should return information for a valid type",
		async () => {
			// This test is skipped because the path may change in docs.rs
			// In a real implementation, we would need to first find the correct path
			// by searching for the type or navigating through the documentation
			const typeInfo = await getTypeInfo(
				"tokio",
				"runtime/struct.Runtime.html",
			);

			expect(typeInfo).toBeTruthy();
			expect(typeInfo.name).toContain("Runtime");
			expect(typeInfo.kind).toBe("struct");
		},
		timeout,
	);

	// Test the HTML extraction in the MCP server
	describe("html content extraction", () => {
		let html: string;
		let $: cheerio.CheerioAPI;

		beforeAll(async () => {
			// Fetch HTML once for all tests in this describe block
			html = await getCrateDocumentation("tokio");
			$ = cheerio.load(html);
		});

		test("should find main content with #main selector", () => {
			const mainElement = $("#main");
			expect(mainElement.length).toBeGreaterThan(0);

			const content = mainElement.html();
			expect(content).toBeTruthy();
			expect(content?.length).toBeGreaterThan(100);
		});

		test("should extract content with alternative selectors if needed", () => {
			const alternativeSelectors = [
				"main",
				".container.package-page-container",
				".rustdoc",
				".information",
				".crate-info",
			];

			// At least one of these selectors should find content
			let contentFound = false;

			for (const selector of alternativeSelectors) {
				const element = $(selector);
				if (element.length > 0) {
					const content = element.html();
					if (content && content.length > 0) {
						contentFound = true;
						break;
					}
				}
			}

			// Either #main or at least one alternative selector should find content
			const mainElement = $("#main");
			expect(mainElement.length > 0 || contentFound).toBe(true);
		});
	});

	describe("getCrateDetails", () => {
		test(
			"should return details for a valid crate",
			async () => {
				const details = await getCrateDetails("tokio");
				expect(details.name).toBe("tokio");
				expect(details.description).toBeDefined();
				expect(details.versions.length).toBeGreaterThan(0);
				expect(details.downloads).toBeGreaterThan(0);
			},
			timeout,
		);
	});
});
