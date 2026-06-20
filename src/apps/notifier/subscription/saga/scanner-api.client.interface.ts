export const SCANNER_API_CLIENT = Symbol.for('ScannerApiClient');

export interface IScannerApiClient {
  enrollRepo(id: string, repo: string, lastSeenTag: string): Promise<void>;
  unenrollRepo(id: string): Promise<void>;
}
