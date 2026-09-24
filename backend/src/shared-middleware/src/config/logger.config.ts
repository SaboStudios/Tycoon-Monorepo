export interface LoggerConfig {
    level: string;
    format: string;
    excludePaths?: string[];
}

export const getLoggerConfig = (): LoggerConfig => {
    return {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        excludePaths: ['/health', '/metrics'],
    };
};
