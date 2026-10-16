import { clsNamespace, getRequestId, setRequestId } from './correlation.context';

describe('correlation.context', () => {
  it('exposes a namespace named "request"', () => {
    expect(clsNamespace.name).toBe('request');
  });

  it('round-trips a request id set inside an active context', () => {
    clsNamespace.run(() => {
      setRequestId('abc');
      expect(getRequestId()).toBe('abc');
    });
  });

  it('returns undefined when no id was set in the active context', () => {
    clsNamespace.run(() => {
      expect(getRequestId()).toBeUndefined();
    });
  });
});
