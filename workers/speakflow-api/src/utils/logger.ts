/**
 * Minimal JSON logger for Cloudflare Workers.
 * Wraps console.{log,info,warn,error} with structured fields and a stable prefix.
 * Output is line-delimited JSON — easy to grep and parse from `wrangler tail`.
 */

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

export function createLogger(scope: string): Logger {
  const emit = (level: string, msg: string, fields?: LogFields): void => {
    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg,
      ...(fields ?? {}),
    };
    // Workers console.* is captured by wrangler tail and CF dashboard logs.
    if (level === 'error') console.error(JSON.stringify(payload));
    else if (level === 'warn') console.warn(JSON.stringify(payload));
    else if (level === 'debug') console.debug(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  };

  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  };
}
