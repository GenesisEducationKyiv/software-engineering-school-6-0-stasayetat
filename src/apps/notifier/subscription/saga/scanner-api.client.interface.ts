export const SCANNER_API_CLIENT = Symbol.for('ScannerApiClient');

export interface IScannerApiClient {
  trackRepo(id: string, repo: string, lastSeenTag: string): Promise<void>;
  untrackRepo(id: string): Promise<void>;
}
