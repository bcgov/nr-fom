import { Controller } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DataReadOnlyService } from '@core';

@Controller()
export class BaseReadOnlyController<E, C> {
  constructor(
    // @ts-expect-error
    protected readonly service: DataReadOnlyService<E, Repository<E>>
  ) {}

  findAll(): Promise<C[]> {
    return this.service.findAll<C>();
  }

  findOne(id: number): Promise<C> {
    return this.service.findOne<C>(id);
  }
}
