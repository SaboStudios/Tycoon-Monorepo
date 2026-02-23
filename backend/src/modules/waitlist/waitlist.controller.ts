import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { Waitlist } from './entities/waitlist.entity';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register interest in the waitlist' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Successfully added to the waitlist.',
        type: Waitlist,
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Wallet address or email already on the waitlist.',
    })
    create(@Body() createWaitlistDto: CreateWaitlistDto): Promise<Waitlist> {
        return this.waitlistService.create(createWaitlistDto);
    }

    @Get()
    @ApiOperation({ summary: 'Retrieve all waitlist entries' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'List of all waitlist entries.',
        type: [Waitlist],
    })
    findAll(): Promise<Waitlist[]> {
        return this.waitlistService.findAll();
    }
}
