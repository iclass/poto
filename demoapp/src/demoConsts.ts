export const Constants = {
  serverModuleName: 'demo',
  demoUser: 'demoUser',
  demoPassword: 'demo123',
  adminUser: 'admin',
  adminPassword: 'admin123',
  roles: {
    user: 'user',
    admin: 'admin',
  },
  sessionKey: 'a',
}

export type GenData = {
  step: number;
  total: number;
  message: string;
  timestamp: string;
  user: string;
}

export type ServerInfo = {
  serverName: string;
  version: string;
  user: string;
  timestamp: string;
  features: string[];
}
