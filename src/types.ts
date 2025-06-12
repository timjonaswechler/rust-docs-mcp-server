/**
 * Types for docs.rs integration
 */

export interface CrateInfo {
	name: string;
	version: string;
	description?: string;
}

export interface CrateSearchResult {
	crates: CrateInfo[];
	totalCount: number;
}

export interface RustType {
	name: string;
	kind:
		| "struct"
		| "enum"
		| "trait"
		| "function"
		| "macro"
		| "type"
		| "module"
		| "other";
	path: string;
	description?: string;
	sourceUrl?: string;
	documentationUrl: string;
}

export interface FeatureFlag {
	name: string;
	description?: string;
	enabled: boolean;
}

export interface CrateVersion {
	version: string;
	isYanked: boolean;
	releaseDate?: string;
}

export interface SymbolDefinition {
	name: string;
	kind: string;
	path: string;
	documentationUrl?: string;
	sourceCode?: string;
	documentationHtml?: string;
}

export interface SearchOptions {
	query: string;
	page?: number;
	perPage?: number;
}
