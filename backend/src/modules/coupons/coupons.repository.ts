import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';

@Injectable()
  constructor(
    @InjectRepository(Coupon)
    private readonly repository: Repository<Coupon>,
  ) {}

  async findById(id: string): Promise<Coupon | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.repository.findOne({ where: { code } });
  }

  async increment(id: string): Promise<void> {
    await this.repository.increment({ id }, 'current_usage', 1);
  }

  /**
   * Atomically consumes one use of the coupon, but only if it is still below
   * its usage limit. Runs a conditional update (`current_usage < max_usage`)
   * and reports whether a row was actually affected, so concurrent applies
   * cannot both succeed past the limit.
   *
   * When an `EntityManager` is supplied the update participates in that
   * transaction, so a rolled-back purchase does not consume the use.
   */
  async incrementIfBelowLimit(
    id: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager ? manager.getRepository(Coupon) : this.repository;
    const result = await repo
      .createQueryBuilder()
      .update(Coupon)
      .set({ current_usage: () => 'current_usage + 1' })
      .where('id = :id', { id })
      .andWhere('current_usage < max_usage')
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
