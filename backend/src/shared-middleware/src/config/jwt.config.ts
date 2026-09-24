export interface JwtConfig {
    secret: string;
    expiresIn?: string | number;
    refreshSecret?: string;
    refreshExpiresIn?: string | number;
}

export const getJwtConfig = (): JwtConfig => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }

    return {
        secret,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || secret,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    };
};
