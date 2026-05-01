export type ApiResponse = { status: 429; retryAfterMs: number; message: string } | { status: number; message: string };

export type FailureResult = { success: false; message: string };
export type SuccessResult = { success: true };
