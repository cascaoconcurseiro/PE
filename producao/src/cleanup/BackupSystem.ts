/**
 * Backup System - Creates backups of critical files before removal
 */

import * as fs from 'fs'
import * as path from 'path'
import { ArchiveSystem as IArchiveSystem } from './interfaces'
import {
  ArchiveResult,
  ArchiveIndex,
  MetadataRecord,
  ArchiveReport,
  ArchiveEntry
} from './types'

export class BackupSystem implements IArchiveSystem {
  private readonly projectRoot: string
  private readonly backupRoot: string
  private readonly archiveEntries: ArchiveEntry[] = []

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.backupRoot = path.join(projectRoot, '.cleanup-backup')
  }

  /**
   * Archives a file with reason for backup
   */
  async archiveFile(filePath: string, reason: string): Promise<ArchiveResult> {
    try {
      // Ensure backup directory exists
      await fs.promises.mkdir(this.backupRoot, { recursive: true })

      const fullPath = path.join(this.projectRoot, filePath)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const archiveFileName = `${timestamp}_${path.basename(filePath)}`
      const archivedPath = path.join(this.backupRoot, archiveFileName)

      // Copy file to backup location
      await fs.promises.copyFile(fullPath, archivedPath)

      // Get file stats for metadata
      const stats = await fs.promises.stat(fullPath)

      // Record archive entry
      const entry: ArchiveEntry = {
        originalPath: filePath,
        archivedPath: path.relative(this.projectRoot, archivedPath),
        reason,
        archivedAt: new Date(),
        size: stats.size
      }

      this.archiveEntries.push(entry)

      return {
        success: true,
        archivedPath: path.relative(this.projectRoot, archivedPath),
        originalPath: filePath,
        reason
      }

    } catch (error) {
      return {
        success: false,
        archivedPath: '',
        originalPath: filePath,
        reason: `Failed to archive: ${error}`
      }
    }
  }

  /**
   * Creates an index of all archived files
   */
  async createArchiveIndex(): Promise<ArchiveIndex> {
    const totalSize = this.archiveEntries.reduce((sum, entry) => sum + entry.size, 0)

    const index: ArchiveIndex = {
      entries: [...this.archiveEntries],
      createdAt: new Date(),
      totalSize
    }

    // Save index to file
    const indexPath = path.join(this.backupRoot, 'archive-index.json')
    await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2))

    return index
  }

  /**
   * Preserves metadata for a file
   */
  async preserveMetadata(filePath: string): Promise<MetadataRecord> {
    const fullPath = path.join(this.projectRoot, filePath)
    const stats = await fs.promises.stat(fullPath)

    // Calculate checksum (simple hash for now)
    const content = await fs.promises.readFile(fullPath)
    const checksum = this.calculateChecksum(content)

    const metadata: MetadataRecord = {
      filePath,
      size: stats.size,
      lastModified: stats.mtime,
      permissions: stats.mode.toString(8),
      checksum,
      tags: this.generateTags(filePath)
    }

    // Save metadata
    const metadataPath = path.join(this.backupRoot, `${path.basename(filePath)}.metadata.json`)
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    return metadata
  }

  /**
   * Generates an archive report
   */
  async generateArchiveReport(): Promise<ArchiveReport> {
    const categories: Record<string, number> = {}
    let totalSize = 0

    for (const entry of this.archiveEntries) {
      const ext = path.extname(entry.originalPath) || 'no-extension'
      categories[ext] = (categories[ext] || 0) + 1
      totalSize += entry.size
    }

    const recommendations = this.generateRecommendations()

    return {
      totalArchived: this.archiveEntries.length,
      totalSize,
      categories,
      recommendations
    }
  }

  /**
   * Restores a file from backup
   */
  async restoreFile(originalPath: string): Promise<boolean> {
    const entry = this.archiveEntries.find(e => e.originalPath === originalPath)
    if (!entry) {
      return false
    }

    try {
      const archivedFullPath = path.join(this.projectRoot, entry.archivedPath)
      const originalFullPath = path.join(this.projectRoot, originalPath)

      // Ensure target directory exists
      await fs.promises.mkdir(path.dirname(originalFullPath), { recursive: true })

      // Copy file back
      await fs.promises.copyFile(archivedFullPath, originalFullPath)

      return true
    } catch (error) {
      console.error(`Failed to restore ${originalPath}:`, error)
      return false
    }
  }

  /**
   * Lists all archived files
   */
  getArchivedFiles(): ArchiveEntry[] {
    return [...this.archiveEntries]
  }

  /**
   * Cleans up old backups (older than specified days)
   */
  async cleanupOldBackups(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
    let cleanedCount = 0

    const toRemove = this.archiveEntries.filter(entry => entry.archivedAt < cutoffDate)

    for (const entry of toRemove) {
      try {
        const archivedFullPath = path.join(this.projectRoot, entry.archivedPath)
        await fs.promises.unlink(archivedFullPath)
        
        // Remove from entries
        const index = this.archiveEntries.indexOf(entry)
        if (index > -1) {
          this.archiveEntries.splice(index, 1)
        }
        
        cleanedCount++
      } catch (error) {
        console.warn(`Could not remove old backup ${entry.archivedPath}:`, error)
      }
    }

    return cleanedCount
  }

  /**
   * Calculates a simple checksum for file content
   */
  private calculateChecksum(content: Buffer): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Generates tags for a file based on its path and type
   */
  private generateTags(filePath: string): string[] {
    const tags: string[] = []
    const ext = path.extname(filePath).toLowerCase()
    const dirname = path.dirname(filePath).toLowerCase()
    const basename = path.basename(filePath).toLowerCase()

    // Extension-based tags
    if (ext === '.md') tags.push('documentation')
    if (ext === '.js' || ext === '.ts') tags.push('script')
    if (ext === '.json') tags.push('configuration')
    if (ext === '.log') tags.push('log')

    // Directory-based tags
    if (dirname.includes('scripts')) tags.push('script')
    if (dirname.includes('docs')) tags.push('documentation')
    if (dirname.includes('test')) tags.push('test')

    // Content-based tags
    if (basename.includes('config')) tags.push('configuration')
    if (basename.includes('deploy')) tags.push('deployment')
    if (basename.includes('backup')) tags.push('backup')
    if (basename.includes('old') || basename.includes('deprecated')) tags.push('obsolete')

    return tags
  }

  /**
   * Generates recommendations for backup management
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.archiveEntries.length > 100) {
      recommendations.push('Consider cleaning up old backups to save space')
    }

    const totalSizeMB = this.archiveEntries.reduce((sum, entry) => sum + entry.size, 0) / (1024 * 1024)
    if (totalSizeMB > 100) {
      recommendations.push(`Backup size is ${totalSizeMB.toFixed(2)}MB - consider archiving to external storage`)
    }

    const oldEntries = this.archiveEntries.filter(entry => 
      entry.archivedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )
    if (oldEntries.length > 0) {
      recommendations.push(`${oldEntries.length} backups are older than 30 days`)
    }

    return recommendations
  }
}