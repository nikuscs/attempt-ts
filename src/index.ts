import { createAttempt } from './attempt'

export * from './attempt'

interface SimpleError {
  message: string
  code: string
  userMessage: string
  toClient: () => { message: string; code: string; userMessage: string }
}

export const defaultNormalizer = (error: unknown): SimpleError => {
  const message = error instanceof Error ? error.message : String(error)
  const userMessage = 'An error occurred'
  const code = 'UNKNOWN_ERROR'

  return {
    message,
    code,
    userMessage,
    toClient: () => ({
      message,
      code,
      userMessage
    })
  }
}

export const attempt = createAttempt<SimpleError>({
  normalizeError: defaultNormalizer,
  logger: console
})