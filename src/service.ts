import * as cheerio from "cheerio";
import turndown from "turndown";
import type {
	CrateInfo,
	CrateSearchResult,
	CrateVersion,
	FeatureFlag,
	RustType,
	SearchOptions,
	SymbolDefinition,
} from "./types.js";
import cratesIoClient from "./utils/crates-io-client.js";
import docsRsClient from "./utils/http-client.js";
import logger from "./utils/logger.js";

const turndownInstance = new turndown();

/**
 * Search for crates on crates.io
 */
export async function searchCrates(
	options: SearchOptions,
): Promise<CrateSearchResult> {
	try {
		logger.info(`searching for crates with query: ${options.query}`);

		const response = await cratesIoClient.get("crates", {
			params: {
				q: options.query,
				page: options.page || 1,
				per_page: options.perPage || 10,
			},
		});

		if (response.contentType !== "json") {
			throw new Error("Expected JSON response but got text");
		}

		const data = response.data as {
			crates: Array<{
				name: string;
				max_version: string;
				description?: string;
			}>;
			meta: {
				total: number;
			};
		};

		const crates: CrateInfo[] = data.crates.map((crate) => ({
			name: crate.name,
			version: crate.max_version,
			description: crate.description,
		}));

		return {
			crates,
			totalCount: data.meta.total,
		};
	} catch (error) {
		logger.error("error searching for crates", { error });
		throw new Error(`failed to search for crates: ${(error as Error).message}`);
	}
}

/**
 * Get detailed information about a crate from crates.io
 */
export async function getCrateDetails(crateName: string): Promise<{
	name: string;
	description?: string;
	versions: CrateVersion[];
	downloads: number;
	homepage?: string;
	repository?: string;
	documentation?: string;
}> {
	try {
		logger.info(`getting crate details for: ${crateName}`);

		const response = await cratesIoClient.get(`crates/${crateName}`);

		if (response.contentType !== "json") {
			throw new Error("Expected JSON response but got text");
		}

		const data = response.data as {
			crate: {
				name: string;
				description?: string;
				downloads: number;
				homepage?: string;
				repository?: string;
				documentation?: string;
			};
			versions: Array<{
				num: string;
				yanked: boolean;
				created_at: string;
			}>;
		};

		return {
			name: data.crate.name,
			description: data.crate.description,
			downloads: data.crate.downloads,
			homepage: data.crate.homepage,
			repository: data.crate.repository,
			documentation: data.crate.documentation,
			versions: data.versions.map((v) => ({
				version: v.num,
				isYanked: v.yanked,
				releaseDate: v.created_at,
			})),
		};
	} catch (error) {
		logger.error(`error getting crate details for: ${crateName}`, { error });
		throw new Error(
			`failed to get crate details for ${crateName}: ${(error as Error).message}`,
		);
	}
}

/**
 * Get documentation for a specific crate from docs.rs
 */
export async function getCrateDocumentation(
	crateName: string,
	version?: string,
): Promise<string> {
	// Validate required parameters
	if (!crateName?.trim()) {
		throw new Error("Crate name is required and cannot be empty");
	}

	try {
		logger.info(
			`getting documentation for crate: ${crateName}${version ? ` version ${version}` : ""}`,
		);

		const versionPath = version || "latest";
		const path = `${crateName}/${versionPath}/${crateName}/`;

		const response = await docsRsClient.get(path);

		if (response.contentType !== "text") {
			throw new Error("Expected HTML response but got JSON");
		}

		// Extract main content from the HTML
		const $ = cheerio.load(response.data);
		const mainContent = $("#main-content").html();

		if (!mainContent) {
			// Fallback to full document if main-content not found
			return turndownInstance.turndown(response.data);
		}

		return turndownInstance.turndown(mainContent);
	} catch (error) {
		logger.error(`error getting documentation for crate: ${crateName}`, {
			error,
		});
		throw new Error(
			`failed to get documentation for crate ${crateName}: ${(error as Error).message}`,
		);
	}
}

/**
 * Get type information for a specific item in a crate
 */
export async function getTypeInfo(
	crateName: string,
	path: string,
	version?: string,
): Promise<RustType> {
	try {
		logger.info(`Getting type info for ${path} in crate: ${crateName}`);

		const versionPath = version || "latest";
		const fullPath = `${crateName}/${versionPath}/${crateName}/${path}`;

		const response = await docsRsClient.get(fullPath);

		if (response.contentType !== "text") {
			throw new Error("Expected HTML response but got JSON");
		}

		const $ = cheerio.load(response.data);

		// Determine the kind of type
		let kind: RustType["kind"] = "other";
		if ($(".struct").length) kind = "struct";
		else if ($(".enum").length) kind = "enum";
		else if ($(".trait").length) kind = "trait";
		else if ($(".fn").length) kind = "function";
		else if ($(".macro").length) kind = "macro";
		else if ($(".type").length) kind = "type";
		else if ($(".mod").length) kind = "module";

		// Get description
		const description = $(".docblock").first().text().trim();

		// Get source URL if available
		const sourceUrl = $(".src").attr("href");

		const name = path.split("/").pop() || path;

		return {
			name,
			kind,
			path,
			description: description || undefined,
			sourceUrl: sourceUrl || undefined,
			documentationUrl: `https://docs.rs${fullPath}`,
		};
	} catch (error) {
		logger.error(`Error getting type info for ${path} in crate: ${crateName}`, {
			error,
		});
		throw new Error(`Failed to get type info: ${(error as Error).message}`);
	}
}

/**
 * Get feature flags for a crate
 */
export async function getFeatureFlags(
	crateName: string,
	version?: string,
): Promise<FeatureFlag[]> {
	try {
		logger.info(`Getting feature flags for crate: ${crateName}`);

		const versionPath = version || "latest";
		const response = await docsRsClient.get(
			`/crate/${crateName}/${versionPath}/features`,
		);

		if (response.contentType !== "text") {
			throw new Error("Expected HTML response but got JSON");
		}

		const $ = cheerio.load(response.data);
		const features: FeatureFlag[] = [];

		// Features are displayed as h3 headers with optional default markers
		$("h3").each((_, element) => {
			const $element = $(element);
			const name = $element.attr("id");
			if (!name) return;

			// Skip the "default" section as it's just a list of default features
			if (name === "default") return;

			const text = $element.text();
			const enabled =
				text.includes("(default)") ||
				$element.next().find(".is-default-feature").length > 0;
			const description = $element.next("p").text().trim();

			features.push({
				name,
				description: description || undefined,
				enabled,
			});
		});

		return features;
	} catch (error) {
		logger.error(`Error getting feature flags for crate: ${crateName}`, {
			error,
		});
		throw new Error(`Failed to get feature flags: ${(error as Error).message}`);
	}
}

/**
 * Get available versions for a crate from crates.io
 */
export async function getCrateVersions(
	crateName: string,
): Promise<CrateVersion[]> {
	try {
		logger.info(`getting versions for crate: ${crateName}`);

		const response = await cratesIoClient.get(`crates/${crateName}`);

		if (response.contentType !== "json") {
			throw new Error("Expected JSON response but got text");
		}

		const data = response.data as {
			versions: Array<{
				num: string;
				yanked: boolean;
				created_at: string;
			}>;
		};

		return data.versions.map((v) => ({
			version: v.num,
			isYanked: v.yanked,
			releaseDate: v.created_at,
		}));
	} catch (error) {
		logger.error(`error getting versions for crate: ${crateName}`, {
			error,
		});
		throw new Error(
			`failed to get crate versions: ${(error as Error).message}`,
		);
	}
}

/**
 * Get source code for a specific item from docs.rs source view
 */
export async function getSourceCode(
	crateName: string,
	path: string,
	version?: string,
): Promise<string> {
	// Validate required parameters
	if (!crateName?.trim()) {
		throw new Error("Crate name is required and cannot be empty");
	}
	if (!path?.trim()) {
		throw new Error("Path is required and cannot be empty. Use format like 'lib.rs' or 'src/main.rs'");
	}

	try {
		logger.info(`Getting source code for ${path} in crate: ${crateName}`);

		const versionPath = version || "latest";
		// Try different URL patterns for source code access
		let response;
		const possibleUrls = [
			`/${crateName}/${versionPath}/src/${crateName}/${path}`,
			`/crate/${crateName}/${versionPath}/source/${path}`,
			`/${crateName}/${versionPath}/source/${path}`,
		];

		for (const url of possibleUrls) {
			try {
				response = await docsRsClient.get(url);
				break;
			} catch (error) {
				// Try next URL pattern
				continue;
			}
		}

		if (!response) {
			throw new Error(`Could not find source code at any of the attempted URLs: ${possibleUrls.join(', ')}`);
		}

		if (typeof response.data !== "string") {
			throw new Error("Expected HTML response but got JSON");
		}

		const $ = cheerio.load(response.data);
		// Source code is contained in a pre.rust element on docs.rs source pages
		const sourceCode = $("pre.rust").text();

		// If no source found with pre.rust, try alternative selectors
		if (!sourceCode) {
			// Try code element as fallback
			const codeElement = $("code").text();
			if (codeElement) return codeElement;
		}

		return sourceCode;
	} catch (error) {
		logger.error(
			`Error getting source code for ${path} in crate: ${crateName}`,
			{ error },
		);
		throw new Error(`Failed to get source code: ${(error as Error).message}`);
	}
}

/**
 * Search for symbols within a crate using the /all.html endpoint
 * This approach fetches all symbols from the crate and filters them client-side
 */
export async function searchSymbols(
	crateName: string,
	query: string,
	version: string,
): Promise<SymbolDefinition[]> {
	// Validate required parameters
	if (!crateName?.trim()) {
		throw new Error("Crate name is required and cannot be empty");
	}
	if (!query?.trim()) {
		throw new Error("Search query is required and cannot be empty");
	}
	if (!version?.trim()) {
		throw new Error("Version is required for symbol search. Please specify a version (e.g., '1.0.0')");
	}

	try {
		logger.info(
			`searching for symbols in crate: ${crateName} with query: ${query} version: ${version}`,
		);

		const versionPath = version;
		const response = await docsRsClient.get(
			`${crateName}/${versionPath}/${crateName}/all.html`,
		);

		if (typeof response.data !== "string") {
			throw new Error("Expected HTML response but got JSON");
		}

		const $ = cheerio.load(response.data);
		const symbols: SymbolDefinition[] = [];

		// Parse each section (structs, enums, traits, etc.)
		$("h3").each((_, element) => {
			const sectionTitle = $(element).text().toLowerCase();
			const sectionId = $(element).attr("id");

			// Skip if no section ID (not a symbol section)
			if (!sectionId) return;

			// Get the symbol kind from section ID
			const kind =
				sectionId === "structs"
					? "struct"
					: sectionId === "enums"
						? "enum"
						: sectionId === "traits"
							? "trait"
							: sectionId === "functions"
								? "function"
								: sectionId === "macros"
									? "macro"
									: sectionId === "derives"
										? "derive"
										: sectionId === "modules"
											? "module"
											: "other";

			// Parse symbols in this section
			$(element)
				.next("ul.all-items")
				.find("li a")
				.each((_, link) => {
					const fullName = $(link).text().trim();
					const path = $(link).attr("href") || "";

					// Extract just the symbol name (last part after ::)
					const symbolName = fullName.split("::").pop() || fullName;

					// Filter by query (case-insensitive)
					if (
						symbolName.toLowerCase().includes(query.toLowerCase()) ||
						fullName.toLowerCase().includes(query.toLowerCase())
					) {
						symbols.push({
							name: symbolName,
							kind,
							path: fullName, // Full path including module
							documentationUrl: `https://docs.rs/${crateName}/${versionPath}/${crateName}/${path}`,
						});
					}
				});
		});

		logger.info(`Found ${symbols.length} symbols matching query: ${query}`);
		return symbols;
	} catch (error) {
		logger.error(`Error searching for symbols in crate: ${crateName}`, {
			error,
		});
		throw new Error(
			`Failed to search for symbols: ${(error as Error).message}`,
		);
	}
}
