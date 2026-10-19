export const DEFAULT_DB_PORT = 5432;

export function resolveDbPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DB_PORT;

  if (raw === undefined) {
    return DEFAULT_DB_PORT;
  }

  const port = Number(raw);

  if (Number.isNaN(port) || !Number.isInteger(port)) {
    throw new Error(
      `Invalid DB_PORT value "${raw}": expected an integer between 1 and 65535.`,
    );
  }

  if (port < 1 || port > 65535) {
    throw new Error(
      `Invalid DB_PORT value "${raw}": expected an integer between 1 and 65535.`,
    );
  }

  return port;
}
