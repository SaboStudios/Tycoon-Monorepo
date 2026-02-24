import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CouponsService, PaginatedCoupons } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { FilterCouponsDto } from './dto/filter-coupons.dto';
import { ValidateCouponDto, CouponValidationResult } from './dto/validate-coupon.dto';
import { Coupon } from './entities/coupon.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new coupon (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Coupon created successfully.',
    type: Coupon,
  })
  create(@Body() createCouponDto: CreateCouponDto): Promise<Coupon> {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all coupons with optional filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of coupons.',
  })
  findAll(@Query() filterDto: FilterCouponsDto): Promise<PaginatedCoupons> {
    return this.couponsService.findAll(filterDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific coupon by ID' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coupon details.',
    type: Coupon,
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Coupon> {
    return this.couponsService.findOne(id);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon code' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coupon validation result.',
    type: CouponValidationResult,
  })
  validate(@Body() validateDto: ValidateCouponDto): Promise<CouponValidationResult> {
    return this.couponsService.validateCoupon(validateDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a coupon (Admin only)' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coupon updated successfully.',
    type: Coupon,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCouponDto: UpdateCouponDto,
  ): Promise<Coupon> {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coupon (Admin only)' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Coupon deleted successfully.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.couponsService.remove(id);
  }

  @Get(':id/usage-logs')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coupon usage logs (Admin only)' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coupon usage logs retrieved.',
  })
  getCouponUsageLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.couponsService.getCouponUsageLogs(id, undefined, page, limit);
  }

  @Get(':id/statistics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coupon usage statistics (Admin only)' })
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coupon statistics retrieved.',
  })
  getCouponStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.getCouponStatistics(id);
  }

  @Get('my/usage-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my coupon usage history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User coupon usage logs retrieved.',
  })
  getMyUsageLogs(
    @CurrentUser() user: { id: number },
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.couponsService.getCouponUsageLogs(undefined, user.id, page, limit);
  }
}
