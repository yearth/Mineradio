export interface ServerTestRuntimePlan {
  readonly purpose: string;
}

export const serverTestRuntimePlan: ServerTestRuntimePlan = {
  purpose: 'Centralize test-only dependency injection while server.js remains the legacy runtime entry.'
};
