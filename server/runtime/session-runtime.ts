import type { CookieRuntime } from './cookie-runtime';

export interface SessionRuntime {
  readonly currentUserCookie: () => string;
  readonly currentQQCookie: () => string;
  readonly saveCookie: (value: unknown) => void;
  readonly saveQQCookie: (value: unknown) => void;
  readonly reset: () => void;
}

export function createSessionRuntime(cookieRuntime: CookieRuntime): SessionRuntime {
  return {
    currentUserCookie(): string {
      return cookieRuntime.userCookie();
    },
    currentQQCookie(): string {
      return cookieRuntime.qqCookie();
    },
    saveCookie(value: unknown): void {
      cookieRuntime.saveCookie(value);
    },
    saveQQCookie(value: unknown): void {
      cookieRuntime.saveQQCookie(value);
    },
    reset(): void {
      cookieRuntime.reset();
    },
  };
}
