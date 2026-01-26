/**
 * Standard response format for all API endpoints.
 * Ensures consistent and predictable response structure across the backend.
 */
export interface StandardResponse<T> {
    /**
     * Indicates whether the operation was successful
     */
    success: boolean;

    /**
     * Human-readable message describing the result
     */
    message: string;

    /**
     * The response payload, null if no data is returned
     */
    data: T | null;

    /**
     * HTTP status code of the response
     */
    statusCode: number;
}
