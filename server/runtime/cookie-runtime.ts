type FileSystemLike = {
  existsSync: (filePath: string) => boolean;
  readFileSync: (filePath: string, encoding: string) => string;
  writeFileSync: (filePath: string, value: string) => void;
};

export type CookieRuntimeOptions = {
  fs: FileSystemLike;
  userCookieFile: string;
  qqCookieFile: string;
  normalizeCookieHeader: (value: unknown) => string;
  rawCookieFallback: (value: unknown) => string;
};

export type CookieRuntime = {
  userCookie: () => string;
  qqCookie: () => string;
  saveCookie: (value: unknown) => void;
  saveQQCookie: (value: unknown) => void;
  reset: () => void;
};

function readCookieFile(fs: FileSystemLike, filePath: string): string {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8').trim();
  } catch (e) {}
  return '';
}

export function createCookieRuntime(options: CookieRuntimeOptions): CookieRuntime {
  let userCookie = readCookieFile(options.fs, options.userCookieFile);
  let qqCookie = readCookieFile(options.fs, options.qqCookieFile);

  function normalize(value: unknown): string {
    return options.normalizeCookieHeader(value) || options.rawCookieFallback(value);
  }

  function write(filePath: string, value: string): void {
    try {
      options.fs.writeFileSync(filePath, value);
    } catch (e) {}
  }

  return {
    userCookie(): string {
      return userCookie;
    },
    qqCookie(): string {
      return qqCookie;
    },
    saveCookie(value: unknown): void {
      userCookie = normalize(value);
      write(options.userCookieFile, userCookie);
    },
    saveQQCookie(value: unknown): void {
      qqCookie = normalize(value);
      write(options.qqCookieFile, qqCookie);
    },
    reset(): void {
      userCookie = '';
      qqCookie = '';
    },
  };
}
