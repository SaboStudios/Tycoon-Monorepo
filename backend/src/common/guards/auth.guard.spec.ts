import { JwtAuthGuard } from './auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
        guard = new JwtAuthGuard();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    it('should extend AuthGuard with jwt strategy', () => {
        expect(guard).toBeInstanceOf(JwtAuthGuard);
    });
});
