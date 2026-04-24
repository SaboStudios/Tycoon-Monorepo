import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for redacting sensitive information from audit logs.
 * 
 * Protects user privacy by removing or masking sensitive data such as:
 * - Passwords, tokens, API keys
 * - Wallet addresses (keeps last 4 characters)
 * - Email addresses (keeps domain)
 * - IP addresses (keeps first 2 octets)
 * 
 * Redaction is enabled by default and can be controlled via GAMES_AUDIT_REDACT_SENSITIVE env var.
 */
@Injectable()
export class SensitiveDataRedactor {
  /**
   * Regex patterns for identifying sensitive field names.
   * Fields matching these patterns will be removed entirely from audit logs.
   */
  private readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /private[_-]?key/i,
    /seed/i,
    /mnemonic/i,
    /auth/i,
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if redaction is enabled via configuration.
   * @returns true if sensitive data redaction is enabled
   */
  private isRedactionEnabled(): boolean {
    return this.configService.get<boolean>('GAMES_AUDIT_REDACT_SENSITIVE', true);
  }

  /**
   * Check if a field name matches sensitive patterns.
   * @param fieldName - The field name to check
   * @returns true if the field is considered sensitive
   */
  isFieldSensitive(fieldName: string): boolean {
    if (!fieldName) {
      return false;
    }
    return this.SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
  }

  /**
   * Recursively redact sensitive data from an object.
   * 
   * @param data - The data to redact (can be object, array, or primitive)
   * @returns Redacted copy of the data
   * 
   * @example
   * ```typescript
   * const input = { username: 'user', password: 'secret123', address: '0x1234567890abcdef' };
   * const output = redactor.redactObject(input);
   * // output: { username: 'user', address: '0x...cdef' }
   * ```
   */
  redactObject(data: any): any {
    // If redaction is disabled, return data as-is
    if (!this.isRedactionEnabled()) {
      return data;
    }

    // Handle null/undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.redactObject(item));
    }

    // Handle objects
    if (typeof data === 'object') {
      const redacted: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        // Remove sensitive fields entirely
        if (this.isFieldSensitive(key)) {
          continue; // Skip this field
        }

        // Special handling for known field names
        if (key === 'address' && typeof value === 'string') {
          redacted[key] = this.redactWalletAddress(value);
        } else if (key === 'email' && typeof value === 'string') {
          redacted[key] = this.redactEmail(value);
        } else if (key === 'ipAddress' && typeof value === 'string') {
          redacted[key] = this.redactIpAddress(value);
        } else {
          // Recursively redact nested objects
          redacted[key] = this.redactObject(value);
        }
      }

      return redacted;
    }

    // Return primitives as-is
    return data;
  }

  /**
   * Redact wallet address, keeping only the last 4 characters for identification.
   * 
   * @param address - The wallet address to redact
   * @returns Redacted address (e.g., "0x1234...5678")
   * 
   * @example
   * ```typescript
   * redactor.redactWalletAddress('0x1234567890abcdef');
   * // Returns: '0x...cdef'
   * ```
   */
  redactWalletAddress(address: string): string {
    if (!address || typeof address !== 'string') {
      return address;
    }

    // Keep prefix (0x) and last 4 characters
    if (address.length > 6) {
      const prefix = address.startsWith('0x') ? '0x' : '';
      const suffix = address.slice(-4);
      return `${prefix}...${suffix}`;
    }

    return address;
  }

  /**
   * Redact email address, keeping only the domain for identification.
   * 
   * @param email - The email address to redact
   * @returns Redacted email (e.g., "***@example.com")
   * 
   * @example
   * ```typescript
   * redactor.redactEmail('user@example.com');
   * // Returns: '***@example.com'
   * ```
   */
  redactEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return email;
    }

    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      return `***${email.substring(atIndex)}`;
    }

    return email;
  }

  /**
   * Redact IP address, keeping only the first 2 octets for identification.
   * 
   * @param ip - The IP address to redact
   * @returns Redacted IP (e.g., "192.168.*.*")
   * 
   * @example
   * ```typescript
   * redactor.redactIpAddress('192.168.1.100');
   * // Returns: '192.168.*.*'
   * ```
   */
  redactIpAddress(ip: string): string {
    if (!ip || typeof ip !== 'string') {
      return ip;
    }

    // Handle IPv4
    const ipv4Parts = ip.split('.');
    if (ipv4Parts.length === 4) {
      return `${ipv4Parts[0]}.${ipv4Parts[1]}.*.*`;
    }

    // Handle IPv6 (keep first 2 groups)
    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length > 2) {
      return `${ipv6Parts[0]}:${ipv6Parts[1]}:*:*:*:*:*:*`;
    }

    return ip;
  }
}
