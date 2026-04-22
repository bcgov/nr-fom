import { Controller, Get } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CodeTableService } from '@core';

@Controller()
export class CodeTableController<E> {
  // @ts-expect-error
  constructor(protected readonly service: CodeTableService<E, Repository<E>>) {}

  @Get()
  async findAll(): Promise<E[]> {
    return this.service.findAll<E>();
  }

}
