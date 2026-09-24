export interface ErrorResponse {
    statusCode: number;
    message: string;
    error: string;
    timestamp: string;
    path?: string;
    details?: Record<string, any>;
}
