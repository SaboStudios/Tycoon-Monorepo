import { BadRequestException, Injectable } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto, SortOrder, PAGINATION_MAX_LIMIT } from '../dto/pagination.dto';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable()
export class PaginationService {
  /**
   * @param queryBuilder  TypeORM query builder to paginate.
   * @param paginationDto Validated pagination/sort/search parameters.
   * @param searchableFields  Column names that may be searched via ILIKE.
   * @param allowedSortFields Explicit allowlist of column names that may be
   *   used as the primary sort key.  When provided and `sortBy` is not in the
   *   list the method throws a 400 rather than forwarding an arbitrary column
   *   name into the SQL ORDER BY clause (SQL-injection guard).
   *   Pass an empty array to disable sorting entirely.
   *   Omit (undefined) to skip the check — only do this when the caller has
   *   already validated the field itself.
   */
  async paginate<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationDto,
    searchableFields?: string[],
    allowedSortFields?: string[],
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

    // Validate sortBy against the allowlist when one is provided.
    if (sortBy && allowedSortFields !== undefined) {
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(
          `Invalid sortBy field "${sortBy}". Allowed: ${allowedSortFields.join(', ')}`,
        );
      }
    }

    // Apply primary sort + stable secondary sort on `id` to guarantee
    // deterministic page boundaries when rows share the same primary sort value.
    if (sortBy && (allowedSortFields === undefined || allowedSortFields.includes(sortBy))) {
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
