export interface ServerBootstrapPlan {
  readonly legacyEntry: string;
  readonly routeTable: string;
}

export const serverBootstrapPlan: ServerBootstrapPlan = {
  legacyEntry: 'server.js',
  routeTable: 'server/router.ts'
};
