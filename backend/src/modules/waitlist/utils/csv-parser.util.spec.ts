import { parseCsv } from './csv-parser.util';
import { BadRequestException } from '@nestjs/common';

describe('parseCsv', () => {
  it('should parse a valid CSV with all three columns', () => {
    const csv = Buffer.from(
      'wallet_address,email_address,telegram_username\n' +
        '0xabc,user@example.com,myuser\n' +
        '0xdef,other@example.com,otheruser\n',
    );

    const result = parseCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      wallet_address: '0xabc',
      email_address: 'user@example.com',
      telegram_username: 'myuser',
    });
  });

  it('should handle header variations (email, wallet, telegram)', () => {
    const csv = Buffer.from(
      'wallet,email,telegram\n0xabc,user@example.com,myuser\n',
    );

    const result = parseCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0].wallet_address).toBe('0xabc');
    expect(result[0].email_address).toBe('user@example.com');
    expect(result[0].telegram_username).toBe('myuser');
  });

  it('should lowercase all values', () => {
    const csv = Buffer.from('email_address\nUSER@EXAMPLE.COM\n');

    const result = parseCsv(csv);

    expect(result[0].email_address).toBe('user@example.com');
  });

  it('should skip blank lines', () => {
    const csv = Buffer.from(
      'email_address\nuser@example.com\n\n\nother@example.com\n',
    );

    const result = parseCsv(csv);

    expect(result).toHaveLength(2);
  });

  it('should skip rows with no recognized fields', () => {
    const csv = Buffer.from(
      'email_address,wallet_address\n,\nuser@example.com,\n',
    );

    const result = parseCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0].email_address).toBe('user@example.com');
  });

  it('should throw if CSV has no header or data rows', () => {
    const csv = Buffer.from('email_address\n');

    expect(() => parseCsv(csv)).toThrow(BadRequestException);
  });

  it('should throw if CSV is empty', () => {
    const csv = Buffer.from('');

    expect(() => parseCsv(csv)).toThrow(BadRequestException);
  });

  it('should throw if no recognized columns in header', () => {
    const csv = Buffer.from('foo,bar\nval1,val2\n');

    expect(() => parseCsv(csv)).toThrow(BadRequestException);
  });

  it('should handle Windows-style line endings (\\r\\n)', () => {
    const csv = Buffer.from('email_address\r\nuser@example.com\r\n');

    const result = parseCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0].email_address).toBe('user@example.com');
  });

  it('should handle partial columns (only email present)', () => {
    const csv = Buffer.from('email_address\nuser@example.com\n');

    const result = parseCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0].email_address).toBe('user@example.com');
    expect(result[0].wallet_address).toBeUndefined();
  });

  it('should ignore unrecognized columns', () => {
    const csv = Buffer.from(
      'email_address,random_col,wallet_address\nuser@example.com,ignored,0xabc\n',
    );

    const result = parseCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0].email_address).toBe('user@example.com');
    expect(result[0].wallet_address).toBe('0xabc');
  });
});
