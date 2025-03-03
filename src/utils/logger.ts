import pino from "pino";

// Create a logger instance with appropriate configuration
export const logger = pino({
	level: process.env.LOG_LEVEL || "warn",
	transport: {
		target: "pino/file",
		options: { destination: 2 }, // stderr
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
});

// Export convenience methods
export default {
	debug: (msg: string, obj?: object) => logger.debug(obj || {}, msg),
	info: (msg: string, obj?: object) => logger.info(obj || {}, msg),
	warn: (msg: string, obj?: object) => logger.warn(obj || {}, msg),
	error: (msg: string, obj?: object) => logger.error(obj || {}, msg),
	fatal: (msg: string, obj?: object) => logger.fatal(obj || {}, msg),
};
