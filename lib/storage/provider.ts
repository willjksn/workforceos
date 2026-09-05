export type StoredFileMetadata = {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
};

export type StorageProvider = {
  name: string;
  upload(params: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<StoredFileMetadata>;
  download(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  metadata(key: string): Promise<StoredFileMetadata | null>;
};
