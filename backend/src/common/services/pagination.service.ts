import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto, SortOrder } from '../dto/pagination.dto';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable()
export class PaginationService {
    async paginate<T extends ObjectLiteral>(
        queryBuilder: SelectQueryBuilder<T>,
        paginationDto: PaginationDto,
        searchableFields?: string[],
    ): Promise<PaginatedResponse<T>> {
        const { page = 1, limit = 10, sortBy, sortOrder = SortOrder.ASC, search } = paginationDto;

        // Apply search filter
        if (search && searchableFields && searchableFields.length > 0) {
            const searchConditions = searchableFields
                .map((field) => `${queryBuilder.alias}.${field} ILIKE :search`)
                .join(' OR ');
            queryBuilder.andWhere(`(${searchConditions})`, { search: `%${search}%` });
        }

        // Apply sorting
        if (sortBy) {
            queryBuilder.orderBy(`${queryBuilder.alias}.${sortBy}`, sortOrder);
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);

        // Execute query
        const [data, totalItems] = await queryBuilder.getManyAndCount();

        const totalPages = Math.ceil(totalItems / limit);

        return {
            data,
            meta: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}
