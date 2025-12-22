import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { FileScanner } from '../FileScanner'

describe('Simple File Test', () => {
  let tempDir: string
  let fileScanner: FileScanner

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-test-' + Date.now())
    await fs.promises.mkdir(tempDir, { recursive: true })
    fileScanner = new FileScanner(tempDir)
  })

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Could not clean up temp directory:', error)
    }
  })

  it('should find a simple file', async () => {
    // Create a simple test file
    const fileName = 'test.txt'
    const filePath = path.join(tempDir, fileName)
    await fs.promises.writeFile(filePath, 'test content')
    
    console.log('Created file at:', filePath)
    console.log('Temp dir:', tempDir)
    
    // Verify file exists
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false)
    console.log('File exists:', exists)
    
    // Scan files
    const scannedFiles = await fileScanner.scanAllFiles()
    console.log('Scanned files:', scannedFiles)
    
    // Check if our file is found
    expect(scannedFiles).toContain('test.txt')
  })
})