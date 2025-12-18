/**
 * Logger Service
 * Centralized logging with different levels and optional metadata
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
    [key: string]: unknown;
}

const formatMessage = (level: LogLevel, message: string, error?: unknown, metadata?: LogMetadata): string => {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (metadata) {
        formatted += ` | ${JSON.stringify(metadata)}`;
    }
    
    return formatted;
};

export const logger = {
    debug: (message: string, error?: unknown, metadata?: LogMetadata) => {
        if (import.meta.env.DEV) {
            console.debug(formatMessage('debug', message, error, metadata));
        }
    },
    
    info: (message: string, error?: unknown, metadata?: LogMetadata) => {
        console.info(formatMessage('info', message, error, metadata));
    },
    
    warn: (message: string, error?: unknown, metadata?: LogMetadata) => {
        console.warn(formatMessage('warn', message, error, metadata));
        if (error) console.warn(error);
    },
    
    error: (message: string, error?: unknown, metadata?: LogMetadata) => {
        console.error(formatMessage('error', message, error, metadata));
        if (error) console.error(error);
    }
};

export default logger;
