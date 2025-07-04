import { describe, expect, test } from "@jest/globals";
import {
  getCrateDetails,
  getCrateVersions,
  getTypeInfo,
  searchCrates,
  searchSymbols,
} from "./service";

describe("service", () => {
  // Set longer timeout for network requests
  const timeout = 15000;

  describe("searchCrates should return results for a valid query", () => {
    test.each([
      ["serde", "serde"],
      ["tokio", "tokio"],
      ["pin-project", "pin-project"],
      ["pin_project", "pin-project"],
      ["fjall", "fjall"],
    ])(
      "%s",
      async (query: string, name: string) => {
        const result = await searchCrates({ query });
        expect(result.crates.length).toBeGreaterThan(0);
        expect(result.totalCount).toBeGreaterThan(0);
        // Check that each crate has a version
        for (const crate of result.crates) {
          expect(crate.name).toBeDefined();
          expect(crate.version).toBeDefined();
        }

        expect(result.crates.some((crate) => crate.name === name)).toBe(true);
      },
      timeout
    );
  });

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
      timeout
    );
  });

  test(
    "searchSymbols should return symbols for a valid query",
    async () => {
      const symbols = await searchSymbols("tokio", "runtime");
      expect(symbols.length).toBeGreaterThan(0);
    },
    timeout
  );

  test(
    "getTypeInfo should return information for a valid type",
    async () => {
      // This test is skipped because the path may change in docs.rs
      // In a real implementation, we would need to first find the correct path
      // by searching for the type or navigating through the documentation
      const typeInfo = await getTypeInfo(
        "tokio",
        "runtime/struct.Runtime.html"
      );

      expect(typeInfo).toBeTruthy();
      expect(typeInfo.name).toContain("Runtime");
      expect(typeInfo.kind).toBe("struct");
    },
    timeout
  );

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
      timeout
    );
  });
});
