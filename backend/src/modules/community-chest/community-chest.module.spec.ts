import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityChestModule } from './community-chest.module';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';

describe('CommunityChestModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommunityChestModule],
    })
      .overrideProvider(getRepositoryToken(CommunityChest))
      .useValue({
        count: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(),
      })
      .compile();
  });

  it('should provide CommunityChestService', () => {
    expect(module.get(CommunityChestService)).toBeInstanceOf(
      CommunityChestService,
    );
  });

  it('should export TypeOrmModule for CommunityChest repository access', () => {
    const exported = Reflect.getMetadata('exports', CommunityChestModule) ?? [];
    expect(exported).toContain(TypeOrmModule);
  });
});
