import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class SoftDeleteService {
    /**
     * Apply soft delete filter to query builder
     * Excludes deleted records by default
     */
    applyActiveFilter<T>(
        query: SelectQueryBuilder<T>,
        alias: string,
    ): SelectQueryBuilder<T> {
        return query.andWhere(`${alias}.deleted_at IS NULL`);
    }

    /**
     * Apply soft delete filter to query builder
     * Includes only deleted records
     */
    applyDeletedFilter<T>(
        query: SelectQueryBuilder<T>,
        alias: string,
    ): SelectQueryBuilder<T> {
        return query.andWhere(`${alias}.deleted_at IS NOT NULL`);
    }

    /**
     * Soft delete an entity
     */
    async softDelete<T extends { deleted_at: Date | null }>(
        repository: Repository<T>,
        id: number,
    ): Promise<void> {
        await repository.update(id, {
            deleted_at: new Date(),
        } as any);
    }

    /**
     * Restore a soft-deleted entity (admin only)
     */
    async restore<T extends { deleted_at: Date | null }>(
        repository: Repository<T>,
        id: number,
    ): Promise<void> {
        await repository.update(id, {
            deleted_at: null,
        } as any);
    }

    /**
     * Permanently delete an entity (hard delete)
     */
    async hardDelete<T>(
        repository: Repository<T>,
        id: number,
    ): Promise<void> {
        await repository.delete(id);
    }
}
