import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

/**
 * Virus scan stub backed by ClamAV (clamd INSTREAM protocol).
 *
 * When CLAMAV_HOST is not set, the scan is skipped with a warning so that
 * the service works in environments where ClamAV is not available (dev/CI).
 * In production, set CLAMAV_HOST + CLAMAV_PORT to enforce scanning.
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private static readonly SCAN_TIMEOUT_MS = 15_000;

  constructor(private readonly config: ConfigService) {}

  async scan(buffer: Buffer, filename: string): Promise<void> {
    const host = this.config.get<string>('upload.clamavHost');

    if (!host) {
      this.logger.warn(
        `Virus scan skipped for "${filename}" – set CLAMAV_HOST to enable ClamAV scanning`,
      );
      return;
    }

    const port = this.config.get<number>('upload.clamavPort') ?? 3310;
    this.logger.debug(`Scanning "${filename}" via clamd at ${host}:${port}`);
    await this.instream(buffer, host, port, filename);
    this.logger.debug(`"${filename}" passed virus scan`);
  }

  /** Streams the buffer to clamd using the INSTREAM command. */
  private instream(
    buffer: Buffer,
    host: string,
    port: number,
    filename: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host, port }, () => {
        // clamd INSTREAM: command + chunk length (BE uint32) + data + zero-length chunk
        const sizeHeader = Buffer.allocUnsafe(4);
        sizeHeader.writeUInt32BE(buffer.length, 0);
        const terminator = Buffer.alloc(4, 0);

        client.write('zINSTREAM\0');
        client.write(sizeHeader);
        client.write(buffer);
        client.write(terminator);
      });

      let response = '';
      client.on('data', (chunk) => {
        response += chunk.toString();
      });

      client.on('end', () => {
        if (response.includes('FOUND')) {
          reject(
            new InternalServerErrorException(
              `Malware detected in "${filename}": ${response.trim()}`,
            ),
          );
        } else if (response.includes('ERROR')) {
          this.logger.error(`ClamAV error for "${filename}": ${response.trim()}`);
          reject(new InternalServerErrorException('Virus scan returned an error'));
        } else {
          resolve();
        }
      });

      client.on('error', (err) => {
        this.logger.error(`ClamAV connection error: ${err.message}`);
        reject(new InternalServerErrorException('Virus scan service unavailable'));
      });

      client.setTimeout(VirusScanService.SCAN_TIMEOUT_MS, () => {
        client.destroy();
        reject(new InternalServerErrorException('Virus scan timed out'));
      });
    });
  }
}
