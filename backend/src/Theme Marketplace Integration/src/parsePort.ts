export function parsePort(value: string | undefined): number {
  const raw = value === undefined || value === '' ? '3000' : value;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT "${raw}": expected an integer between 1 and 65535.`
    );
  }
  return port;
}
