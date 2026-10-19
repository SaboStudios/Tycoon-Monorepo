/** Minimal @nestjs/swagger stub for unit tests. */
const noop = () => () => {};
const noopClass = () => class {};

export const ApiPropertyOptional = noop;
export const ApiProperty = noop;
export const ApiTags = noop;
export const ApiOperation = noop;
export const ApiResponse = noop;
export const ApiOkResponse = noop;
export const ApiCreatedResponse = noop;
export const ApiBadRequestResponse = noop;
export const ApiForbiddenResponse = noop;
export const ApiNotFoundResponse = noop;
export const ApiUnauthorizedResponse = noop;
export const ApiBearerAuth = noop;
export const ApiQuery = noop;
export const ApiParam = noop;
export const ApiBody = noop;
export const ApiHeader = noop;
export const ApiConsumes = noop;
export const ApiExcludeController = noop;

// Mapped types — return the input class unchanged
export const PartialType = (cls: unknown) => cls;
export const OmitType = (cls: unknown, _keys: unknown) => cls;
export const PickType = (cls: unknown, _keys: unknown) => cls;
export const IntersectionType = (...classes: unknown[]) => classes[0];

export const DocumentBuilder = noopClass;
export const SwaggerModule = { createDocument: () => ({}), setup: () => {} };
