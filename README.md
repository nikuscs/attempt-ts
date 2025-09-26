# attempt-ts

🎯 Robust error handling and retry utilities for TypeScript

## Installation

```bash
bun add attempt-ts
# or
npm install attempt-ts
```

## Quick Start

```typescript
import { attempt } from 'attempt-ts'

// Basic error handling
const result = attempt.try(() => {
  return riskyOperation()
})

if (result.ok) {
  console.log(result.data)
} else {
  console.error(result.error.error.message)
}

// Async operations
const result = await attempt.try(async () => {
  return await fetchData()
})

// Retry with backoff
const result = await attempt.retry(() => {
  return unreliableOperation()
}, { tries: 3 })

// Client-safe errors
const result = attempt.try(() => {
  throw new Error('Internal error')
}, { client: true })

if (!result.ok) {
  // Only exposes safe client-facing error info
  console.log(result.error.client.userMessage)
}
```

## Server & Client for Easy report boundaries

```typescript
// attempt.server.ts
export const attempt = createAttempt<ErrorNormalized>({
  logger: (error) => logger.error(error),
  reporter: (_error) => {
    // Report to sentry with Node SDK
  }
})

// attempt.client.ts
export const attempt = createAttempt<ErrorNormalized>({
  logger: (error) => logger.error(error),
  reporter: (_error) => {
    // Repor with Sentry React / NextJS / Vue / etc.
  }
})
```

## Normalize errors

```typescript
interface ErrorNormalized {
  message: string
  code: string
  userMessage: string
}

function toNormalizedError(error: unknown, options?: any): ErrorNormalized {
  return {
    message: error.message,
    code: error.code,
    userMessage: error.userMessage,
    // Add a toClient method to the normalized error to client only error info, anything else is ommited ( stack-trace, etc. )
    toClient: () => ({
      message: error.message,
      code: error.code,
      userMessage: error.userMessage
    })
  }
}

export const attempt = createAttempt<ErrorNormalized>({
  normalizeError: toNormalizedError,
  logger: (error) => logger.error(error),
  reporter: (_error) => {
    // Report to sentry with Node SDK
  }
})

// Client-safe errors
const result = attempt.try(() => {
  throw new Error('Internal error')
}, { client: true })

if (!result.ok) {
  // Only exposes safe client-facing error info
  console.log(result.error.client.userMessage)
}
```

## Mapping Errors to Client-safe errors

```typescript
const result = attempt.try(() => {
  if(Math.random() > 0.5) {
    throw new Error('specific error')
  }
  return {
    foo: 'bar' 
  }
},
{ 
  client: true,
  // Error is typed from your interface ErrorNormalized
  errors: (error) => {
    if (error.message.includes('specific')) {
      return 'VALIDATION_ERROR'
    }
    return 'DEFAULT'
  }
})

if (!result.ok) {
  // result.error.error is typed from your interface ErrorNormalized
  console.log(result.error.error.userMessage)
}

// Fully typed result
console.log(result.data.foo === 'bar')

```

## Features

- Type-safe error handling with Result types
- Async/await support
- Configurable retry logic with p-retry
- Client-safe error transformation
- Custom error normalizers
- Comprehensive TypeScript types
- Nearly zero dependencies (except retry utilities)

## API

### `attempt.try(fn, options?)`

Safely execute a function and return a Result type.

### `attempt.retry(fn, options?)`

Execute a function with retry logic.

### `attempt.ok(data)`

Create a successful result.

### `attempt.error(errorInfo)`

Create an error result.

## License

MIT
