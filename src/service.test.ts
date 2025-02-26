import { describe, expect, test } from "bun:test";
import docsRsService from "./services/docs-rs-service";

describe("DocsRsService", () => {
	// Set longer timeout for network requests
	const timeout = 10000;

	test(
		"searchCrates should return results for a valid query",
		async () => {
			const result = await docsRsService.searchCrates({ query: "serde" });
			expect(result.crates.length).toBeGreaterThan(0);
			expect(result.totalCount).toBeGreaterThan(0);
		},
		timeout,
	);

	test(
		"getCrateVersions should return versions for a valid crate",
		async () => {
			const versions = await docsRsService.getCrateVersions("tokio");
			expect(versions.length).toBeGreaterThan(0);
			expect(versions[0].version).toBeTruthy();
		},
		timeout,
	);

	test(
		"searchSymbols should return symbols for a valid query",
		async () => {
			const symbols = await docsRsService.searchSymbols("tokio", "runtime");
			expect(symbols.length).toBeGreaterThan(0);
		},
		timeout,
	);
});
