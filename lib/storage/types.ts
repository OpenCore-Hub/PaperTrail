export interface StorageMetadata {
  contentType: string;
  filename: string;
  workspaceId: string;
  uploaderId: string;
}

export interface PutResult {
  key: string;
  url?: string;
  size: number;
  contentType: string;
}

export interface IStorageProvider {
  put(buffer: Buffer, metadata: StorageMetadata): Promise<PutResult>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  getStream(key: string): Promise<ReadableStream<Uint8Array> | Buffer>;
}
