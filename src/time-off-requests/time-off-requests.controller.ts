import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { toHttpError } from '../common/errors';
import { CreateTimeOffRequestDto } from './dto';
import { TimeOffRequestsService } from './time-off-requests.service';

@Controller('time-off-requests')
export class TimeOffRequestsController {
  constructor(private readonly requests: TimeOffRequestsService) {}

  @Post()
  async create(@Body() body: CreateTimeOffRequestDto) {
    try {
      return await this.requests.create(body);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    try {
      return await this.requests.get(id);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    try {
      return await this.requests.approve(id);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    try {
      return await this.requests.reject(id);
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
