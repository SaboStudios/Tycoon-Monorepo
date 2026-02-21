export interface JwtPayload {
  sub: number;
  id?: number;
  email: string;
  role: string;
}
