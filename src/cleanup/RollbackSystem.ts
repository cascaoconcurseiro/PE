/**
 * Rollback System - Provides ability to undo cleanup operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { BackupSystem } from './BackupSystem'

export interface RollbackOperation {
  type: 'remove' | 'move' | 'modify'
  originalPath: string
  backupPath?: string
  newPath?: string
  timestamp: Date
  reason: string
}

export interface RollbackPoint {
  id: string
  name: string
  operations: RollbackOperation[]
  createdAt: Date
  description: string
}

export class RollbackSystem {
  private readonly projectRoot: string
  private readonly backupSystem: BackupSystem
  private readonly rollbackPoints: Map<string, RollbackPoint> = new Map()
  private currentOperations: RollbackOperation[] = []

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.backupSystem = new BackupSystem(projectRoot)
  }

  /**
   * Creates a new rollback point
   */
  createRollbackPoint(name: string, description: string): string {
    const id = `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const rollbackPoint: RollbackPoint = {
      id,
      name,
      operations: [...this.currentOperations],
      createdAt: new Date(),
      description
    }

    this.rollbackPoints.set(id, rollbackPoint)
    this.currentOperations = [] // Reset current operations

    return id
  }

  /**
   * Records a file removal operation
   */
  async recordRemoval(filePath: string, reason: string): Promise<void> {
    // Create backup before recording removal
    const backupResult = await this.backupSystem.archiveFile(filePath, reason)
    
    const operation: RollbackOperation = {
      type: 'remove',
      originalPath: filePath,
      backupPath: backupResult.success ? backupResult.archivedPath : undefined,
      timestamp: new Date(),
      reason
    }

    this.currentOperations.push(operation)
  }

  /**
   * Records a file move operation
   */
  async recordMove(fromPath: string, toPath: string, reason: string): Promise<void> {
    const operation: RollbackOperation = {
      type: 'move',
      originalPath: fromPath,
      newPath: toPath,
      timestamp: new Date(),
      reason
    }

    this.currentOperations.push(operation)
  }

  /**
   * Records a file modification operation
   */
  async recordModification(filePath: string, reason: string): Promise<void> {
    // Create backup of original file
    const backupResult = await this.backupSystem.archiveFile(filePath, reason)
    
    const operation: RollbackOperation = {
      type: 'modify',
      originalPath: filePath,
      backupPath: backupResult.success ? backupResult.archivedPath : undefined,
      timestamp: new Date(),
      reason
    }

    this.currentOperations.push(operation)
  }

  /**
   * Rolls back to a specific rollback point
   */
  async rollbackToPoint(rollbackId: string): Promise<{
    success: boolean
    restoredFiles: string[]
    errors: string[]
  }> {
    const rollbackPoint = this.rollbackPoints.get(rollbackId)
    if (!rollbackPoint) {
      return {
        success: false,
        restoredFiles: [],
        errors: ['Rollback point not found']
      }
    }

    const restoredFiles: string[] = []
    const errors: string[] = []

    // Process operations in reverse order
    const operations = [...rollbackPoint.operations].reverse()

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'remove':
            await this.restoreRemovedFile(operation)
            restoredFiles.push(operation.originalPath)
            break
          
          case 'move':
            await this.undoMoveOperation(operation)
            restoredFiles.push(operation.originalPath)
            break
          
          case 'modify':
            await this.restoreModifiedFile(operation)
            restoredFiles.push(operation.originalPath)
            break
        }
      } catch (error) {
        errors.push(`Failed to rollback ${operation.originalPath}: ${error}`)
      }
    }

    return {
      success: errors.length === 0,
      restoredFiles,
      errors
    }
  }

  /**
   * Lists all available rollback points
   */
  listRollbackPoints(): RollbackPoint[] {
    return Array.from(this.rollbackPoints.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  /**
   * Gets details of a specific rollback point
   */
  getRollbackPoint(rollbackId: string): RollbackPoint | undefined {
    return this.rollbackPoints.get(rollbackId)
  }

  /**
   * Removes old rollback points
   */
  cleanupOldRollbackPoints(daysOld: number = 7): number {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
    let removedCount = 0

    for (const [id, point] of this.rollbackPoints) {
      if (point.createdAt < cutoffDate) {
        this.rollbackPoints.delete(id)
        removedCount++
      }
    }

    return removedCount
  }

  /**
   * Saves rollback points to disk
   */
  async saveRollbackPoints(): Promise<void> {
    const rollbackDir = path.join(this.projectRoot, '.cleanup-backup', 'rollback')
    await fs.promises.mkdir(rollbackDir, { recursive: true })

    const rollbackData = {
      points: Array.from(this.rollbackPoints.entries()),
      savedAt: new Date()
    }

    const rollbackFile = path.join(rollbackDir, 'rollback-points.json')
    await fs.promises.writeFile(rollbackFile, JSON.stringify(rollbackData, null, 2))
  }

  /**
   * Loads rollback points from disk
   */
  async loadRollbackPoints(): Promise<void> {
    const rollbackFile = path.join(this.projectRoot, '.cleanup-backup', 'rollback', 'rollback-points.json')
    
    try {
      const data = await fs.promises.readFile(rollbackFile, 'utf-8')
      const rollbackData = JSON.parse(data)
      
      this.rollbackPoints.clear()
      for (const [id, point] of rollbackData.points) {
        // Convert date strings back to Date objects
        point.createdAt = new Date(point.createdAt)
        point.operations.forEach((op: RollbackOperation) => {
          op.timestamp = new Date(op.timestamp)
        })
        this.rollbackPoints.set(id, point)
      }
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.warn('Could not load rollback points:', error)
    }
  }

  /**
   * Generates a rollback report
   */
  generateRollbackReport(): string {
    const lines: string[] = []
    
    lines.push('# Rollback System Report')
    lines.push('')
    lines.push(`Total rollback points: ${this.rollbackPoints.size}`)
    lines.push(`Current operations recorded: ${this.currentOperations.length}`)
    lines.push('')

    if (this.rollbackPoints.size > 0) {
      lines.push('## Available Rollback Points')
      lines.push('')
      
      for (const point of this.listRollbackPoints()) {
        lines.push(`### ${point.name} (${point.id})`)
        lines.push(`Created: ${point.createdAt.toISOString()}`)
        lines.push(`Description: ${point.description}`)
        lines.push(`Operations: ${point.operations.length}`)
        lines.push('')
      }
    }

    if (this.currentOperations.length > 0) {
      lines.push('## Current Operations (not yet saved to rollback point)')
      lines.push('')
      
      for (const op of this.currentOperations) {
        lines.push(`- ${op.type}: ${op.originalPath} (${op.reason})`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Restores a file that was removed
   */
  private async restoreRemovedFile(operation: RollbackOperation): Promise<void> {
    if (!operation.backupPath) {
      throw new Error('No backup path available for restoration')
    }

    const backupFullPath = path.join(this.projectRoot, operation.backupPath)
    const originalFullPath = path.join(this.projectRoot, operation.originalPath)

    // Ensure target directory exists
    await fs.promises.mkdir(path.dirname(originalFullPath), { recursive: true })

    // Copy file back from backup
    await fs.promises.copyFile(backupFullPath, originalFullPath)
  }

  /**
   * Undoes a move operation
   */
  private async undoMoveOperation(operation: RollbackOperation): Promise<void> {
    if (!operation.newPath) {
      throw new Error('No new path available for move rollback')
    }

    const newFullPath = path.join(this.projectRoot, operation.newPath)
    const originalFullPath = path.join(this.projectRoot, operation.originalPath)

    // Ensure target directory exists
    await fs.promises.mkdir(path.dirname(originalFullPath), { recursive: true })

    // Move file back to original location
    await fs.promises.rename(newFullPath, originalFullPath)
  }

  /**
   * Restores a file that was modified
   */
  private async restoreModifiedFile(operation: RollbackOperation): Promise<void> {
    if (!operation.backupPath) {
      throw new Error('No backup path available for modification rollback')
    }

    const backupFullPath = path.join(this.projectRoot, operation.backupPath)
    const originalFullPath = path.join(this.projectRoot, operation.originalPath)

    // Copy original file back from backup
    await fs.promises.copyFile(backupFullPath, originalFullPath)
  }
}