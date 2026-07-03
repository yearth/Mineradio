export type NeteaseApiTable = Record<string, any>;

export interface NeteaseApiRuntime {
  readonly current: () => NeteaseApiTable;
  readonly apply: (overrides?: unknown) => void;
}

export function createNeteaseApiRuntime(defaults: NeteaseApiTable): NeteaseApiRuntime {
  let currentApi = Object.assign({}, defaults);
  return {
    current(): NeteaseApiTable {
      return currentApi;
    },
    apply(overrides?: unknown): void {
      currentApi = Object.assign({}, defaults, overrides || {});
    },
  };
}
