import pRetry from 'p-retry'
import type { RetryContext } from 'p-retry'
import type { WrapOptions } from 'retry'

type PRetryOptions = {
  readonly onFailedAttempt?: (context: RetryContext) => void | Promise<void>;
  readonly shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>;
  readonly signal?: AbortSignal;
} & WrapOptions

type MaybePromise<T> = T | Promise<T>

export type ErrorNormalizer<TNormalized> = (error: unknown, options?: any) => TNormalized

export interface Logger {
  error: (error: unknown) => void
}

export type Reporter = (error: unknown) => void

export interface AttemptDependencies<TNormalized> {
  normalizeError: ErrorNormalizer<TNormalized>
  logger?: Logger | ((error: unknown) => void)
  reporter?: Reporter
}

export interface ResultErrorData<TError = Error, TNormalized = any> {
  error: TError
  normalized: TNormalized
  client?: any
}

export interface ClientResultErrorData<TClientError = any> {
  client: TClientError
}

export interface DataResult<TData> {
  ok: true
  error: undefined
  data: TData
}

export interface ErrorResult<TError = Error, TNormalized = any> {
  ok: false
  error: ResultErrorData<TError, TNormalized>
  data: undefined
}

export interface ClientErrorResult<TClientError = any> {
  ok: false
  error: ClientResultErrorData<TClientError>
  data: undefined
}

export type Result<TData, TError = Error, TNormalized = any> =
  | DataResult<TData>
  | ErrorResult<TError, TNormalized>

export type ClientResult<TData, TClientError = any> =
  | DataResult<TData>
  | ClientErrorResult<TClientError>

export interface TryOptions {
  report?: boolean
  client?: boolean
  errors?: (error: Error) => any
}

export interface TryWithRetryOptions extends TryOptions {
  tries?: number
  retry?: PRetryOptions
}

export function createAttempt<TNormalized>(deps: AttemptDependencies<TNormalized>) {
  class Attempt {
    static ok<TData>(data: TData): DataResult<TData> {
      return {
        ok: true as const,
        error: undefined,
        data
      }
    }

    static error<TError = Error>(errorInfo: ResultErrorData<TError, TNormalized>): ErrorResult<TError, TNormalized>
    static error<TClientError = any>(errorInfo: ClientResultErrorData<TClientError>): ClientErrorResult<TClientError>
    static error<TError = Error, TClientError = any>(errorInfo: ResultErrorData<TError, TNormalized> | ClientResultErrorData<TClientError>): ErrorResult<TError, TNormalized> | ClientErrorResult<TClientError> {
      return {
        ok: false as const,
        error: errorInfo,
        data: undefined
      } as any
    }

    private static handleError<TError extends Error = Error>(
      error: unknown,
      options: { report?: boolean; client?: boolean; errors?: (error: Error) => any }
    ): ErrorResult<TError, TNormalized> | ClientErrorResult {
      const { report: shouldReport = true, client = false, errors } = options

      const normalized = deps.normalizeError(error, errors ? { when: errors } : undefined)

      if (shouldReport) {
        if (typeof deps.logger === 'function') {
          deps.logger(error)
        } else {
          deps.logger?.error(error)
        }
        deps.reporter?.(error)
      }

      if (client) {
        const clientError = (normalized as any).toClient()
        const clientErrorInfo: ClientResultErrorData = {
          client: clientError
        }
        return Attempt.error(clientErrorInfo)
      }

      const originalError = error instanceof Error ? error : new Error(String(error))
      const errorInfo: ResultErrorData<TError, TNormalized> = {
        error: originalError as TError,
        normalized
      }

      return Attempt.error(errorInfo)
    }

    static try(fn: () => never, options: TryOptions & { client: true }): ClientResult<never>
    static try(fn: () => never, options?: TryOptions): Result<never, Error, TNormalized>
    static try<T = unknown>(fn: () => T, options: TryOptions & { client: true }): T extends Promise<infer R> ? Promise<ClientResult<R>> : ClientResult<T>
    static try<T = unknown>(fn: () => T, options?: TryOptions): T extends Promise<infer R> ? Promise<Result<R, Error, TNormalized>> : Result<T, Error, TNormalized>
    static try<T>(fn: () => T, options: TryOptions = {}) {
      try {
        const result = fn()

        if (result instanceof Promise) {
          return result
            .then((data) => Attempt.ok(data))
            .catch((error: unknown) => Attempt.handleError(error, options))
        }

        return Attempt.ok(result)
      } catch (error: unknown) {
        return Attempt.handleError(error, options)
      }
    }

    static retry<T>(fn: () => MaybePromise<T>, options: TryWithRetryOptions & { client: true }): Promise<ClientResult<Awaited<T>>>
    static retry<T>(fn: () => MaybePromise<T>, options?: TryWithRetryOptions): Promise<Result<Awaited<T>, Error, TNormalized>>
    static retry<T>(fn: () => MaybePromise<T>, options: TryWithRetryOptions = {}) {
      const {
        tries: retries = 3,
        retry: retryOptions,
        ...tryOptions
      } = options
      return pRetry(fn, { retries, ...retryOptions })
        .then((data) => Attempt.ok(data))
        .catch((error: unknown) => Attempt.handleError(error, tryOptions))
    }
  }

  return {
    try: Attempt.try,
    retry: Attempt.retry,
    ok: Attempt.ok,
    error: Attempt.error
  }
}