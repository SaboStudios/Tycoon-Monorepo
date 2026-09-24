import { Request } from 'express';

export interface RequestWithUser extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
        iat?: number;
        exp?: number;
    };
}
