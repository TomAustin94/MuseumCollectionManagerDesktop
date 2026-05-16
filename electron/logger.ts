import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let logStream: fs.WriteStream | null = null

function getLogPath(): string {
  return path.join(app.getPath('userData'), 'app.log')
}

export function initLogger(): void {
  const logPath = getLogPath()
  logStream = fs.createWriteStream(logPath, { flags: 'a' })

  const line = `\n${'='.repeat(60)}\n[${new Date().toISOString()}] App started (v${app.getVersion()})\n`
  logStream.write(line)

  // Redirect console to file
  const orig = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...args) => { write('INFO', args); orig.log(...args) }
  console.warn = (...args) => { write('WARN', args); orig.warn(...args) }
  console.error = (...args) => { write('ERROR', args); orig.error(...args) }

  process.on('uncaughtException', (err) => {
    write('UNCAUGHT', [err.stack ?? err.message])
  })
  process.on('unhandledRejection', (reason) => {
    write('UNHANDLED', [String(reason)])
  })
}

export function write(level: string, args: unknown[]): void {
  if (!logStream) return
  const msg = args.map((a) => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  logStream.write(`[${new Date().toISOString()}] [${level}] ${msg}\n`)
}

export function getLogFilePath(): string {
  return getLogPath()
}
