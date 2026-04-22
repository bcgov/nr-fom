import { PinoLogger } from "nestjs-pino";

class MockLogger extends PinoLogger {
  constructor() {
    super({} as any);
  }

  trace(..._args: any[]) {
    // This is intentional for empty body.
  }

  debug(..._args: any[]) {
    // This is intentional for empty body.
  }

  info(..._args: any[]) {
    // This is intentional for empty body.
  }

  warn(..._args: any[]) {
    // This is intentional for empty body.
  }

  error(..._args: any[]) {
    // This is intentional for empty body.
  }

  fatal(..._args: any[]) {
    // This is intentional for empty body.
  }

  setContext(_context: string) {
    // This is intentional for empty body.
  }

  assign(_props: object) {
    // This is intentional for empty body.
  }
}

export function mockLoggerFactory() {
  return new MockLogger();
}
