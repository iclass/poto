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
  port: 3001,
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

export type ImageSize = {
  width: number;
  height: number;
}

export type ImageResponseUint8 = {
  width: number;
  height: number;
  imageData: Uint8Array;  // Echo back Uint8Array
  originalSize: number;
  dataType: 'Uint8Array';
}

export type ImageResponseArrayBuffer = {
  width: number;
  height: number;
  imageData: ArrayBuffer;  // Echo back ArrayBuffer
  originalSize: number;
  dataType: 'ArrayBuffer';
}

export type ImageResponseFile = {
  width: number;
  height: number;
  imageData: File;  // Echo back File
  originalSize: number;
  dataType: 'File';
}

export type ImageResponse = ImageResponseUint8 | ImageResponseArrayBuffer | ImageResponseFile;
