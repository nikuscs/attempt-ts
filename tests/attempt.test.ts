import { describe, it, expect } from 'vitest'
import { attempt } from '../src/index.js'
import type { ResultErrorData } from '../src/attempt.js'

describe('attempt runtime tests', () => {
  describe('try method', () => {
    it('should handle sync success', () => {
      const result = attempt.try(() => 42)
      expect(result.ok).toBe(true)
      expect(result.data).toBe(42)
      expect(result.error).toBeUndefined()
    })

    it('should handle sync error', () => {
      const result = attempt.try((): number => {
        throw new Error('test error')
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.error).toBeInstanceOf(Error)
      }
      expect(result.data).toBeUndefined()
    })

    it('should handle async success', async () => {
      const result = await attempt.try(async () => 42)
      expect(result.ok).toBe(true)
      expect(result.data).toBe(42)
      expect(result.error).toBeUndefined()
    })

    it('should handle async error', async () => {
      const result = await attempt.try(async () => {
        throw new Error('test error')
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.error).toBeInstanceOf(Error)
      }
      expect(result.data).toBeUndefined()
    })

  })

  describe('retry method', () => {
    it('should retry on failure', async () => {
      let attempts = 0
      const result = await attempt.retry(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('retry me')
        }
        return 'success'
      }, { tries: 3 })

      expect(result.ok).toBe(true)
      expect(result.data).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should fail after max retries', async () => {
      let attempts = 0
      const result = await attempt.retry(() => {
        attempts++
        throw new Error('always fails')
      }, { tries: 2 })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.error).toBeInstanceOf(Error)
      }
      expect(attempts).toBe(3) // initial + 2 retries
    })

    it('should work with async functions', async () => {
      const result = await attempt.retry(async () => 'async success')
      expect(result.ok).toBe(true)
      expect(result.data).toBe('async success')
    })
  })

  describe('edge cases', () => {
    it('should handle void functions', () => {
      let sideEffect = false
      const result = attempt.try(() => {
        sideEffect = true
      })
      expect(result.ok).toBe(true)
      expect(result.data).toBeUndefined()
      expect(sideEffect).toBe(true)
    })

    it('should handle functions returning null', () => {
      const result = attempt.try(() => null)
      expect(result.ok).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should handle functions returning undefined', () => {
      const result = attempt.try(() => undefined)
      expect(result.ok).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('should handle client errors correctly', () => {
      const result = attempt.try(() => {
        throw new Error('test error')
      }, { client: true })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect('error' in result.error).toBe(false)
        expect('normalized' in result.error).toBe(false)
        expect(result.error.client).toBeDefined()
        expect(result.error.client).toHaveProperty('code')
        expect(result.error.client).toHaveProperty('userMessage')
        expect(result.error.client).toHaveProperty('message')
      }
    })

    it('should use errors to transform errors', () => {
      const result = attempt.try(() => {
        throw new Error('specific error')
      }, {
        errors: (err) => err.message.includes('specific') ? 'VALIDATION_ERROR' : 'DEFAULT'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error).toBeInstanceOf(Error)
        expect(result.error.normalized).toBeDefined()
      }
    })

    it('should handle Promise.reject in async functions', async () => {
      const result = await attempt.try(async () => {
        await Promise.reject(new Error('rejected'))
        return 'never reached'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error).toBeInstanceOf(Error)
        if (result.error.error instanceof Error) {
          expect(result.error.error.message).toBe('rejected')
        }
      }
    })

    it('should work with ok and error helper functions', () => {
      const okResult = attempt.ok(42)
      expect(okResult.ok).toBe(true)
      expect(okResult.data).toBe(42)
      expect(okResult.error).toBeUndefined()

      const testError = new Error('test')
      const normalizedErr = {
        message: 'test',
        code: 'DEFAULT' as const,
        userMessage: 'An error occurred',
        error: {
          name: 'Error',
          message: 'test'
        }
      }
      const errorInfo: ResultErrorData = {
        error: testError,
        normalized: normalizedErr
      }
      const errorResult = attempt.error(errorInfo)
      expect(errorResult.ok).toBe(false)
      expect(errorResult.error).toBeDefined()
      expect(errorResult.error.error).toBeInstanceOf(Error)
      expect(errorResult.error.normalized).toBeDefined()
      expect(errorResult.data).toBeUndefined()
    })

    it('should handle complex objects as return values', () => {
      const complexObject = {
        nested: { value: 42 },
        array: [1, 2, 3],
        date: new Date()
      }

      const result = attempt.try(() => complexObject)
      expect(result.ok).toBe(true)
      expect(result.data).toEqual(complexObject)
    })

    it('should handle non-Error objects thrown', () => {
      const result = attempt.try(() => {
        throw 'string error'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.error).toBeDefined()
      }
    })

    it('should handle custom error types', () => {
      class CustomError extends Error {
        code = 500
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const result = attempt.try(() => {
        throw new CustomError('custom error')
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeDefined()
        expect(result.error.error).toBeInstanceOf(Error)
      }
    })

    it('should handle retry with 0 retries', async () => {
      let attempts = 0
      const result = await attempt.retry(() => {
        attempts++
        throw new Error('fail')
      }, { tries: 0 })

      expect(attempts).toBe(1)
      expect(result.ok).toBe(false)
    })

    it('should handle retry with client mode', async () => {
      const result = await attempt.retry(() => {
        throw new Error('retry error')
      }, { tries: 1, client: true })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect('error' in result.error).toBe(false)
        expect('normalized' in result.error).toBe(false)
        expect(result.error.client).toBeDefined()
        expect(result.error.client).toHaveProperty('code')
      }
    })

    it('should differentiate between client and non-client error results', () => {
      const normalResult = attempt.try(() => {
        throw new Error('normal error')
      })

      expect(normalResult.ok).toBe(false)
      if (!normalResult.ok) {
        expect('error' in normalResult.error).toBe(true)
        expect('normalized' in normalResult.error).toBe(true)
        expect('client' in normalResult.error).toBe(false)
      }

      const clientResult = attempt.try(() => {
        throw new Error('client error')
      }, { client: true })

      expect(clientResult.ok).toBe(false)
      if (!clientResult.ok) {
        expect('error' in clientResult.error).toBe(false)
        expect('normalized' in clientResult.error).toBe(false)
        expect('client' in clientResult.error).toBe(true)
      }
    })
  })

  describe('serialization tests', () => {
    it('should produce JSON serializable results', () => {
      const successResult = attempt.try(() => ({ foo: 'bar', num: 42 }))
      expect(() => JSON.stringify(successResult)).not.toThrow()
      const serialized = JSON.parse(JSON.stringify(successResult))
      expect(serialized).toEqual({
        ok: true,
        error: undefined,
        data: { foo: 'bar', num: 42 }
      })

      const errorResult = attempt.try(() => {
        throw new Error('test error')
      })
      expect(() => JSON.stringify(errorResult)).not.toThrow()
    })

    it('should only expose client property when client: true', () => {
      const result = attempt.try(() => {
        throw new Error('client mode error')
      }, { client: true })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errorKeys = Object.keys(result.error)
        expect(errorKeys).toEqual(['client'])

        expect(result.error.client).toBeDefined()
        expect(result.error.client.code).toBeDefined()
        expect(result.error.client.userMessage).toBeDefined()

        expect('error' in result.error).toBe(false)
        expect('normalized' in result.error).toBe(false)
      }
    })

    it('should serialize client results without issues', () => {
      const result = attempt.try(() => {
        throw new Error('serialization test')
      }, { client: true })

      expect(() => JSON.stringify(result)).not.toThrow()

      const serialized = JSON.parse(JSON.stringify(result))
      expect(serialized.ok).toBe(false)
      expect(serialized.error.client).toBeDefined()
      expect(serialized.error.client.message).toBe('serialization test')

      expect(serialized.error.error).toBeUndefined()
      expect(serialized.error.normalized).toBeUndefined()
    })
  })
})