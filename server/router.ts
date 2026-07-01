export interface RouteDescriptor {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly owner: string;
}

export const routeDescriptors: RouteDescriptor[] = [];
