import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum UserSortField {
  ID = 'id',
  EMAIL = 'email',
  CREATED_AT = 'created_at',
  GAMES_PLAYED = 'games_played',
  GAME_WON = 'game_won',
}

export enum GameSortField {
  ID = 'id',
  STATUS = 'status',
  CREATED_AT = 'created_at',
  MODE = 'mode',
}

export class PaginatedUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: UserSortField,
    description: 'Field to sort users by',
  })
  @IsOptional()
  @IsEnum(UserSortField)
  sortBy?: UserSortField = UserSortField.CREATED_AT;
}

export class PaginatedGamesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: GameSortField,
    description: 'Field to sort games by',
  })
  @IsOptional()
  @IsEnum(GameSortField)
  sortBy?: GameSortField = GameSortField.CREATED_AT;
}
