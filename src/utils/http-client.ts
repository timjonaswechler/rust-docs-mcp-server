import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import logger from "./logger";

// Create a configured Axios instance for docs.rs
export const createDocsRsClient = (): AxiosInstance => {
	const client = axios.create({
		baseURL: "https://docs.rs",
		timeout: 10000,
		headers: {
			Accept: "text/html,application/xhtml+xml,application/json",
			"User-Agent": "rust-docs-mcp-server/1.0.0",
		},
	});

	// Add request interceptor for logging
	client.interceptors.request.use((config) => {
		logger.debug(`Making request to ${config.url}`, {
			method: config.method,
			params: config.params,
		});
		return config;
	});

	// Add response interceptor for logging
	client.interceptors.response.use(
		(response) => {
			logger.debug(`Received response from ${response.config.url}`, {
				status: response.status,
				contentType: response.headers["content-type"],
			});
			return response;
		},
		(error) => {
			if (error.response) {
				logger.error(`HTTP error from ${error.config.url}`, {
					status: error.response.status,
					data: error.response.data,
				});
			} else if (error.request) {
				logger.error("No response received", {
					request: error.request,
				});
			} else {
				logger.error("Error making request", {
					message: error.message,
				});
			}
			return Promise.reject(error);
		},
	);

	return client;
};

// Export a default instance
export default createDocsRsClient();
