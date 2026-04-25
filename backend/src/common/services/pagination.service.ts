import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto, SortOrder, PAGINATION_MAX_LIMIT } from '../dto/pagination.dto';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable()
export class PaginationService {
  async paginate<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationDto,
    searchableFields?: string[],
  ): Promise<PaginatedResponse<T>> {
    const {
      page = 1,
      sortBy,
      sortOrder = SortOrder.DESC,
      search,
    } = paginationDto;

    // Clamp limit to the configured maximum to prevent unbounded queries.
    const limit = Math.min(
      Math.max(1, paginationDto.limit ?? 10),
      PAGINATION_MAX_LIMIT,
    );

    // Apply search filter
    if (search && searchableFields && searchableFields.length > 0) {
      const searchConditions = searchableFields
        .map((field) => `${queryBuilder.alias}.${field} ILIKE :search`)
        .join(' OR ');
      queryBuilder.andWhere(`(${searchConditions})`, { search: `%${search}%` });
    }

    // Apply primary sort + stable secondary sort on `id` to guarantee
    // deterministic page boundaries when rows share the same primary sort value.
    if (sortBy) {
      queryBuilder
        .orderBy(`${queryBuilder.alias}.${sortBy}`, sortOrder)
        .addOrderBy(`${queryBuilder.alias}.id`, sortOrder);
    } else {
      // Default: newest-first by id when no explicit sort is requested.
      queryBuilder.orderBy(`${queryBuilder.alias}.id`, SortOrder.DESC);
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
