# attempt-ts

🎯 Robust error handling and retry utilities for TypeScript

## Installation

```bash
bun add attempt-ts
# or
npm install attempt-ts
```

## Usage

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
const asyncResult = await attempt.try(async () => {
  return await fetchData()
})

// Retry with backoff
const retryResult = await attempt.retry(() => {
  return unreliableOperation()
}, { tries: 3 })

// Client-safe errors
const clientResult = attempt.try(() => {
  throw new Error('Internal error')
}, { client: true })

if (!clientResult.ok) {
  // Only exposes safe client-facing error info
  console.log(clientResult.error.client.userMessage)
}
```

## Features

- ✅ Type-safe error handling with Result types
- ✅ Async/await support
- ✅ Configurable retry logic with p-retry
- ✅ Client-safe error transformation
- ✅ Custom error normalizers
- ✅ Comprehensive TypeScript types
- ✅ Zero dependencies (except retry utilities)

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