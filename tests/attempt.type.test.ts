import { describe, it, assertType } from 'vitest'
import { attempt } from '../src/index'
import type { Result, ClientResult, ErrorResult, ResultErrorData, ClientResultErrorData, DataResult, ClientErrorResult } from '../src/attempt'

// The default attempt uses SimpleError type (from our index.ts)
interface SimpleError {
  message: string
  code: string
  userMessage: string
  toClient: () => { message: string; code: string; userMessage: string }
}

interface SimpleClientError {
  message: string
  code: string
  userMessage: string
}

describe('attempt type tests', () => {
  describe('try method - sync vs async inference', () => {
    it('should return Result<T> for sync functions without await', () => {
      const result = attempt.try(() => 42)
      assertType<Result<number, Error, SimpleError>>(result)

      // Should be able to access properties directly without await
      if (result.ok) {
        assertType<number>(result.data)
        assertType<undefined>(result.error)
      } else {
        assertType<undefined>(result.data)
        assertType<ResultErrorData<Error, SimpleError>>(result.error)
        assertType<Error>(result.error.error)
        assertType<SimpleError>(result.error.normalized)
      }
    })

    it('should return Promise<Result<T>> for async functions requiring await', async () => {
      const result = attempt.try(async () => 42)
      assertType<Promise<Result<number, Error, SimpleError>>>(result)

      // Must await to access properties
      const awaited = await result
      if (awaited.ok) {
        assertType<number>(awaited.data)
        assertType<undefined>(awaited.error)
      } else {
        assertType<undefined>(awaited.data)
        assertType<ResultErrorData<Error, SimpleError>>(awaited.error)
      }
    })
  })

  describe('try method - functions that only throw', () => {
    it('should handle functions that always throw', () => {
      // When a function only throws, we need to provide explicit type
      const result = attempt.try((): void => {
        throw new Error('always throws')
      })
      // Now we get Result<void> which is usable
      assertType<Result<void, Error, SimpleError>>(result)
      assertType<boolean>(result.ok)

      const resultWithClient = attempt.try((): void => {
        throw new Error('always throws')
      }, { client: true })
      assertType<ClientResult<void, SimpleClientError>>(resultWithClient)
    })

    it('should respect user-provided type even for throwing functions', () => {
      // User explicitly types the return as string even though it throws
      const result = attempt.try((): string => {
        throw new Error('throws')
        // TypeScript knows this is unreachable but user typed it as string
      })
      assertType<Result<string, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<string>(result.data)
      }
    })

    it('should handle functions without explicit return type that throw', () => {
      const result = attempt.try(() => {
        if (Math.random() > 0.5) {
          throw new Error('random throw')
        }
        return 'success'
      })
      assertType<Result<string, Error, SimpleError>>(result)
    })
  })

  describe('try method - client error handling', () => {
    it('should return ClientError when client: true', () => {
      const result = attempt.try(() => 42, { client: true })
      assertType<ClientResult<number, SimpleClientError>>(result)

      if (!result.ok) {
        assertType<ClientResultErrorData<SimpleClientError>>(result.error)
        assertType<SimpleClientError>(result.error.client)
        assertType<string>(result.error.client.code)
        assertType<string>(result.error.client.userMessage)
      }
    })

    it('should return Error when client: false or not specified', () => {
      const result1 = attempt.try(() => 42)
      assertType<Result<number, Error, SimpleError>>(result1)

      const result2 = attempt.try(() => 42, { client: false })
      assertType<Result<number, Error, SimpleError>>(result2)

      const result3 = attempt.try(() => 42, { report: true })
      assertType<Result<number, Error, SimpleError>>(result3)
    })

    it('should handle async with client: true', async () => {
      const result = attempt.try(async () => 42, { client: true })
      assertType<Promise<ClientResult<number, SimpleClientError>>>(result)

      const awaited = await result
      if (!awaited.ok) {
        assertType<ClientResultErrorData<SimpleClientError>>(awaited.error)
        assertType<SimpleClientError>(awaited.error.client)
      }
    })
  })

  describe('try method - options', () => {
    it('should accept all options', () => {
      const result1 = attempt.try(() => 42, { report: true })
      assertType<Result<number, Error, SimpleError>>(result1)

      const result2 = attempt.try(() => 42, { errors: () => 'DEFAULT' as const })
      assertType<Result<number, Error, SimpleError>>(result2)

      const result3 = attempt.try(() => 42, {
        report: true,
        client: true,
        errors: () => 'DEFAULT' as const
      })
      assertType<ClientResult<number, SimpleClientError>>(result3)
    })
  })

  describe('retry method', () => {
    it('should always return Promise for sync functions', () => {
      const result = attempt.retry(() => 42)
      assertType<Promise<Result<number, Error, SimpleError>>>(result)
    })

    it('should return Promise for async functions', () => {
      const result = attempt.retry(async () => 42)
      assertType<Promise<Result<number, Error, SimpleError>>>(result)
    })

    it('should respect client: true option', () => {
      const result = attempt.retry(() => 42, { client: true })
      assertType<Promise<ClientResult<number, SimpleClientError>>>(result)
    })

    it('should accept retry count and all try options', () => {
      const result = attempt.retry(() => 42, {
        tries: 5,
        report: true,
        client: true,
        errors: () => 'DEFAULT' as const
      })
      assertType<Promise<ClientResult<number, SimpleClientError>>>(result)
    })
  })

  describe('Edge cases and type overrides', () => {
    it('should allow explicit type override for sync functions', () => {
      // Even though the function returns number, we can override to string
      const result = attempt.try<string>(() => 42 as any)
      assertType<Result<string, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<string>(result.data)
      }
    })

    it('should allow explicit type override for async functions', async () => {
      // Override Promise<number> to Promise<string>
      const result = attempt.try<Promise<string>>(async () => 42 as any)
      assertType<Promise<Result<string, Error, SimpleError>>>(result)

      const awaited = await result
      if (awaited.ok) {
        assertType<string>(awaited.data)
      }
    })

    it('should handle union types', () => {
      const result = attempt.try(() => {
        if (Math.random() > 0.5) {
          return 'string'
        }
        return 42
      })
      // The result is Result<string | number>
      assertType<boolean>(result.ok)

      if (result.ok) {
        assertType<string | number>(result.data)
      }
    })

    it('should handle nullable types', () => {
      const result = attempt.try(() => {
        if (Math.random() > 0.5) {
          return null
        }
        return 'data'
      })
      // The result is Result<string | null>
      assertType<boolean>(result.ok)

      if (result.ok) {
        assertType<string | null>(result.data)
      }
    })

    it('should handle void functions', () => {
      const result = attempt.try(() => {
        console.log('side effect')
      })
      assertType<Result<void, Error, SimpleError>>(result)
      // void is a special type that represents no data
    })

    it('should handle functions returning undefined', () => {
      const result = attempt.try(() => undefined)
      assertType<Result<undefined, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<undefined>(result.data)
      }
    })

    it('should handle retry with mixed sync/async functions', () => {
      // Sync function with retry always returns Promise
      const syncResult = attempt.retry(() => 42)
      assertType<Promise<Result<number, Error, SimpleError>>>(syncResult)

      // Async function with retry
      const asyncResult = attempt.retry(async () => 'async')
      assertType<Promise<Result<string, Error, SimpleError>>>(asyncResult)
    })

    it('should properly type error in catch blocks', async () => {
      const result = await attempt.try(async (): Promise<number> => {
        throw new Error('test')
      })

      if (!result.ok) {
        assertType<ResultErrorData<Error, SimpleError>>(result.error)
        assertType<Error>(result.error.error)
        // Error should have proper Error properties
        assertType<string>(result.error.error.message)
        assertType<string>(result.error.error.name)
      }
    })

    it('should handle complex nested promises', async () => {
      const result = attempt.try(async () => {
        const inner = await Promise.resolve(42)
        return inner.toString()
      })
      assertType<Promise<Result<string, Error, SimpleError>>>(result)
    })

    it('should work with generic functions', () => {
      function identity<T>(data: T): T {
        return data
      }

      const result = attempt.try(() => identity('hello'))
      assertType<Result<string, Error, SimpleError>>(result)

      const result2 = attempt.try(() => identity(42))
      assertType<Result<number, Error, SimpleError>>(result2)
    })

    it('should handle functions with closures', () => {
      const multiplier = 2
      const result = attempt.try(() => 21 * multiplier)
      assertType<Result<number, Error, SimpleError>>(result)
    })

    it('should work with ok and error helper functions', () => {
      const okResult = attempt.ok(42)
      assertType<{
        ok: true
        error: undefined
        data: number
      }>(okResult)

      const testError = new Error('test')
      const normalizedErr: SimpleError = {
        message: 'test',
        code: 'DEFAULT',
        userMessage: 'An error occurred',
        toClient: () => ({
          message: 'test',
          code: 'DEFAULT',
          userMessage: 'An error occurred'
        })
      }
      const errorInfo: ResultErrorData<Error, SimpleError> = {
        error: testError,
        normalized: normalizedErr
      }
      const errorResult = attempt.error(errorInfo)
      assertType<ErrorResult<Error, SimpleError>>(errorResult)
    })
  })

  describe('Additional type edge cases', () => {
    it('should handle functions returning functions', () => {
      const result = attempt.try(() => {
        return (x: number) => x * 2
      })

      assertType<Result<(x: number) => number, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<(x: number) => number>(result.data)
        const fn = result.data
        assertType<number>(fn(5))
      }
    })

    it('should handle Symbol types', () => {
      const sym = Symbol('test')
      const result = attempt.try(() => sym)

      assertType<Result<symbol, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<symbol>(result.data)
      }
    })

    it('should handle BigInt types', () => {
      const result = attempt.try(() => BigInt(123))

      assertType<Result<bigint, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<bigint>(result.data)
      }
    })

    it('should handle retry with errors and client mode', () => {
      const result = attempt.retry(
        () => {
          throw new Error('test')
        },
        {
          tries: 2,
          client: true,
          errors: (_err) => 'VALIDATION_ERROR'
        }
      )

      assertType<Promise<ClientResult<never, SimpleClientError>>>(result)
    })

    it('should handle deeply nested Result types', () => {
      const innerResult = attempt.try(() => 42)
      const outerResult = attempt.try(() => innerResult)

      // outerResult should be Result<Result<number>>
      if (outerResult.ok) {
        // outerResult.data should be Result<number>
        if (outerResult.data.ok) {
          assertType<number>(outerResult.data.data)
        }
      }
    })

    it('should handle class instance types', () => {
      class TestClass {
        constructor(public data: number) { }
        getData(): number { return this.data }
      }

      const result = attempt.try(() => new TestClass(42))
      assertType<Result<TestClass, Error, SimpleError>>(result)

      if (result.ok) {
        assertType<TestClass>(result.data)
        assertType<number>(result.data.getData())
      }
    })

    it('should handle Map and Set types', () => {
      const mapResult = attempt.try(() => new Map<string, number>())
      assertType<Result<Map<string, number>, Error, SimpleError>>(mapResult)

      const setResult = attempt.try(() => new Set<string>())
      assertType<Result<Set<string>, Error, SimpleError>>(setResult)
    })

    it('should handle WeakMap and WeakSet types', () => {
      const wmResult = attempt.try(() => new WeakMap<object, string>())
      assertType<Result<WeakMap<object, string>, Error, SimpleError>>(wmResult)

      const wsResult = attempt.try(() => new WeakSet())
      assertType<Result<WeakSet<object>, Error, SimpleError>>(wsResult)
    })
  })

  describe('Result type structure', () => {
    it('should have discriminated union properties', () => {
      const result = attempt.try(() => 'test')

      if (result.ok) {
        // When ok is true, data is defined and error is undefined
        assertType<{
          ok: true
          error: undefined
          data: string
        }>(result)
      } else {
        // When ok is false, error is defined and data is undefined
        assertType<false>(result.ok)
        assertType<ResultErrorData<Error, SimpleError>>(result.error)
        assertType<undefined>(result.data)
      }
    })
  })

  describe('Serialization type safety', () => {
    it('should ensure Result types have no Symbol properties', () => {
      type AssertNoSymbols<T> = {
        [K in keyof T]: K extends symbol ? never : T[K]
      }

      // DataResult should have no symbol keys
      type DataResultKeys = AssertNoSymbols<DataResult<string>>
      assertType<{
        ok: true
        error: undefined
        data: string
      }>({} as DataResultKeys)

      // ErrorResult should have no symbol keys
      type ErrorResultKeys = AssertNoSymbols<ErrorResult<Error, SimpleError>>
      assertType<{
        ok: false
        error: ResultErrorData<Error, SimpleError>
        data: undefined
      }>({} as ErrorResultKeys)

      // ClientErrorResult should have no symbol keys
      type ClientErrorResultKeys = AssertNoSymbols<ClientErrorResult<SimpleClientError>>
      assertType<{
        ok: false
        error: ClientResultErrorData<SimpleClientError>
        data: undefined
      }>({} as ClientErrorResultKeys)
    })

    it('should ensure ClientResultErrorData only has client property', () => {
      type ClientErrorDataKeys = keyof ClientResultErrorData<SimpleClientError>
      assertType<'client'>({} as ClientErrorDataKeys)

      // Verify the shape of ClientResultErrorData
      assertType<{
        client: SimpleClientError
      }>({} as ClientResultErrorData<SimpleClientError>)
    })

    it('should ensure all Result types are JSON serializable', () => {
      // Success result should be serializable
      type SuccessType = Result<{ foo: string }, Error, SimpleError>
      // Verify that the type structure allows JSON serialization
      const _successTest: SuccessType = {} as any
      assertType<boolean>(_successTest.ok)
      assertType<{ foo: string } | undefined>(_successTest.data)
      assertType<ResultErrorData<Error, SimpleError> | undefined>(_successTest.error)

      // Client error result should be serializable
      type ClientType = ClientResult<{ foo: string }, SimpleClientError>
      // Verify that the type structure allows JSON serialization
      const _clientTest: ClientType = {} as any
      assertType<boolean>(_clientTest.ok)
      assertType<{ foo: string } | undefined>(_clientTest.data)
      assertType<ClientResultErrorData<SimpleClientError> | undefined>(_clientTest.error)

      // Verify the types can be used in JSON.stringify context
      const _testSuccess: SuccessType = {
        ok: true,
        error: undefined,
        data: { foo: 'bar' }
      }

      const _testError: ClientType = {
        ok: false,
        error: { client: { code: 'DEFAULT', userMessage: 'Error', message: 'Error' } },
        data: undefined
      }
    })

    it('should verify ClientResult structure for server functions', () => {
      // Simulating a server function return type
      type ServerFunctionReturn = ClientResult<{ message: string; data: number[] }, SimpleClientError>

      // When successful
      type SuccessCase = Extract<ServerFunctionReturn, { ok: true }>
      assertType<{
        ok: true
        error: undefined
        data: { message: string; data: number[] }
      }>({} as SuccessCase)

      // When error
      type ErrorCase = Extract<ServerFunctionReturn, { ok: false }>
      assertType<{
        ok: false
        error: ClientResultErrorData<SimpleClientError>
        data: undefined
      }>({} as ErrorCase)

      // Ensure error case only has client property
      type ErrorData = ErrorCase['error']
      assertType<'client'>({} as keyof ErrorData)
    })
  })
})