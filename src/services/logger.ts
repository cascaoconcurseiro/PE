/**
 * Logger Service
 * Centralized logging with different levels and optional metadata
 * 
 * Em produção, apenas WARN e ERROR são exibidos
 * Em desenvolvimento, todos os níveis são exibidos
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
    [key: string]: unknown;
}

// Detectar ambiente de forma segura
const isDev = typeof import.meta !== 'undefined' 
    ? import.meta.env?.DEV ?? false 
    : process.env.NODE_ENV !== 'production';

const formatMessage = (level: LogLevel, message: string, metadata?: LogMetadata): string => {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
        try {
            formatted += ` | ${JSON.stringify(metadata)}`;
        } catch {
            formatted += ' | [metadata não serializável]';
        }
    }
    
    return formatted;
};

export const logger = {
    /**
     * Debug: Apenas em desenvolvimento
     */
    debug: (message: string, metadata?: LogMetadata) => {
        if (isDev) {
            console.debug(formatMessage('debug', message, metadata));
        }
    },
    
    /**
     * Info: Apenas em desenvolvimento
     */
    info: (message: string, metadata?: LogMetadata) => {
        if (isDev) {
            console.info(formatMessage('info', message, metadata));
        }
    },
    
    /**
     * Warn: Sempre exibido (dev e prod)
     */
    warn: (message: string, errorOrMetadata?: unknown, metadata?: LogMetadata) => {
        const meta = metadata || (errorOrMetadata && typeof errorOrMetadata === 'object' && !('message' in errorOrMetadata) 
            ? errorOrMetadata as LogMetadata 
            : undefined);
        
        console.warn(formatMessage('warn', message, meta));
        
        // Se for um erro, logar separadamente
        if (errorOrMetadata && typeof errorOrMetadata === 'object' && 'message' in errorOrMetadata) {
            console.warn(errorOrMetadata);
        }
    },
    
    /**
     * Error: Sempre exibido (dev e prod)
     */
    error: (message: string, errorOrMetadata?: unknown, metadata?: LogMetadata) => {
        const meta = metadata || (errorOrMetadata && typeof errorOrMetadata === 'object' && !('message' in errorOrMetadata) 
            ? errorOrMetadata as LogMetadata 
            : undefined);
        
        console.error(formatMessage('error', message, meta));
        
        // Se for um erro, logar separadamente para stack trace
        if (errorOrMetadata && typeof errorOrMetadata === 'object' && 'message' in errorOrMetadata) {
            console.error(errorOrMetadata);
        }
    }
};

export default logger;
