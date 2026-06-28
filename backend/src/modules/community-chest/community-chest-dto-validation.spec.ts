import { validate } from 'class-validator';
import { CreateCommunityChestDto } from './dto/create-community-chest.dto';
import { UpdateCommunityChestDto } from './dto/update-community-chest.dto';
import { ChanceType } from '../chance/enums/chance-type.enum';

describe('Community Chest DTO Validation', () => {
  describe('CreateCommunityChestDto', () => {
    it('should pass with valid data', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Advance to Go';
      dto.type = ChanceType.MOVE;
      dto.amount = 200;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when instruction is missing', async () => {
      const dto = new CreateCommunityChestDto();
      dto.type = ChanceType.REWARD;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'instruction')).toBe(true);
    });

    it('should fail when instruction exceeds 500 characters', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'a'.repeat(501);
      dto.type = ChanceType.REWARD;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'instruction')).toBe(true);
    });

    it('should fail when type is missing', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Go to Jail';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('should fail when type is invalid', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Test';
      (dto as any).type = 'invalid_type';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('should fail when amount is negative', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Pay fine';
      dto.type = ChanceType.PENALTY;
      dto.amount = -100;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('should pass with optional fields omitted', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Draw again';
      dto.type = ChanceType.REWARD;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with amount as zero', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Move to start';
      dto.type = ChanceType.MOVE;
      dto.amount = 0;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when position is negative', async () => {
      const dto = new CreateCommunityChestDto();
      dto.instruction = 'Go back';
      dto.type = ChanceType.MOVE;
      dto.position = -1;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });
  });

  describe('UpdateCommunityChestDto', () => {
    it('should pass with valid partial data', async () => {
      const dto = new UpdateCommunityChestDto();
      dto.instruction = 'Updated instruction';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass with all fields empty (all optional)', async () => {
      const dto = new UpdateCommunityChestDto();

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when instruction exceeds max length', async () => {
      const dto = new UpdateCommunityChestDto();
      dto.instruction = 'x'.repeat(501);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'instruction')).toBe(true);
    });

    it('should fail when type is invalid', async () => {
      const dto = new UpdateCommunityChestDto();
      (dto as any).type = 'bad_type';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('should fail when amount is negative', async () => {
      const dto = new UpdateCommunityChestDto();
      dto.amount = -50;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('should pass with valid type update', async () => {
      const dto = new UpdateCommunityChestDto();
      dto.type = ChanceType.PENALTY;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
