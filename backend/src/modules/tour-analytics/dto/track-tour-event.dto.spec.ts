import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TOUR_EVENT_NAMES, TrackTourEventDto } from './track-tour-event.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(TrackTourEventDto, plain);
  return validate(dto);
}

describe('TrackTourEventDto', () => {
  it.each(TOUR_EVENT_NAMES)('accepts known event name %s', async (event) => {
    const errors = await validateDto({ event, data: { step: 1 } });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown event name', async () => {
    const errors = await validateDto({
      event: 'tour_hacked',
      data: {},
    });
    expect(errors.some((e) => e.property === 'event')).toBe(true);
  });

  it('rejects a missing event name', async () => {
    const errors = await validateDto({ data: {} });
    expect(errors.some((e) => e.property === 'event')).toBe(true);
  });

  it('rejects non-integer step values in data', async () => {
    const errors = await validateDto({
      event: 'tour_step_viewed',
      data: { step: 'not-a-number' },
    });
    const dataError = errors.find((e) => e.property === 'data');
    expect(dataError).toBeDefined();
  });

  it('rejects a malformed timestamp', async () => {
    const errors = await validateDto({
      event: 'tour_completed',
      data: { timestamp: 'not-a-date' },
    });
    const dataError = errors.find((e) => e.property === 'data');
    expect(dataError).toBeDefined();
  });
});
