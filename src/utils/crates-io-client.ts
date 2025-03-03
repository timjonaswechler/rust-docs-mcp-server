import logger from "./logger";

interface RequestOptions {
	method?: string;
	params?: Record<string, string | number | boolean | undefined>;
	body?: unknown;
}

type FetchResponse =
	| {
			data: Record<string, unknown>;
			status: number;
			headers: Headers;
			contentType: "json";
	  }
	| {
			data: string;
			status: number;
			headers: Headers;
			contentType: "text";
	  };

// base configuration for crates.io requests
const BASE_CONFIG = {
	baseURL: "https://crates.io/api/v1/",
	headers: {
		Accept: "application/json",
		"User-Agent": "rust-docs-mcp-server/1.0.0",
	},
};

// helper to build full url with query params
function buildUrl(
	path: string,
	params?: Record<string, string | number | boolean | undefined>,
): string {
	const url = new URL(path, BASE_CONFIG.baseURL);
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) {
				url.searchParams.append(key, String(value));
			}
		}
	}
	return url.toString();
}

// create a configured fetch client for crates.io
export async function cratesIoFetch(
	path: string,
	options: RequestOptions = {},
): Promise<FetchResponse> {
	const { method = "GET", params, body } = options;
	const url = buildUrl(path, params);

	try {
		logger.debug(`making request to ${url}`, { method, params });

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

		const response = await fetch(url, {
			method,
			headers: BASE_CONFIG.headers,
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		logger.debug(`received response from ${url}`, {
			status: response.status,
			contentType: response.headers.get("content-type"),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const contentType = response.headers.get("content-type");
		const isJson = contentType?.includes("application/json");
		const data = isJson ? await response.json() : await response.text();

		return {
			data,
			status: response.status,
			headers: response.headers,
			contentType: isJson ? "json" : "text",
		};
	} catch (error) {
		logger.error(`error making request to ${url}`, { error });
		throw error;
	}
}

// Export a default instance
export default {
	get: (path: string, options = {}) =>
		cratesIoFetch(path, { ...options, method: "GET" }),
	post: (path: string, options = {}) =>
		cratesIoFetch(path, { ...options, method: "POST" }),
	put: (path: string, options = {}) =>
		cratesIoFetch(path, { ...options, method: "PUT" }),
	delete: (path: string, options = {}) =>
		cratesIoFetch(path, { ...options, method: "DELETE" }),
};
