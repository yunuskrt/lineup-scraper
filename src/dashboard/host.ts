export const DEFAULT_PORT = 4319;
export const HOST = '127.0.0.1';

// Loopback names only: blocks DNS rebinding
export function isAllowedHost(host: string | undefined, port: number) {
  return host === `${HOST}:${port}` || host === `localhost:${port}`;
}

export function isOwnOrigin(origin: string | undefined, port: number) {
  return (
    origin === `http://${HOST}:${port}` || origin === `http://localhost:${port}`
  );
}
