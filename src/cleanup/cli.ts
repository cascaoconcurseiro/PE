#!/usr/bin/env node

/**
 * CLI for the cleanup system
 */

import { CleanupEngine } from './CleanupEngine'
import { CleanupExecutor } from './CleanupExecutor'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'analyze'
  
  const engine = new CleanupEngine()

  try {
    switch (command) {
      case 'analyze':
        await runAnalysis(engine)
        break
      case 'plan':
        await generatePlan(engine)
        break
      case 'validate':
        await validateFiles(engine, args.slice(1))
        break
      case 'execute':
        await executeCleanup(engine, args.slice(1))
        break
      case 'scan':
        await scanOnly(engine)
        break
      default:
        console.log('Usage: cleanup-cli [analyze|plan|validate|execute|scan]')
        console.log('  analyze  - Full analysis and report generation')
        console.log('  plan     - Generate cleanup plan')
        console.log('  validate - Validate files for safe removal')
        console.log('  execute  - Execute cleanup phases')
        console.log('  scan     - Scan files only')
        process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

async function runAnalysis(engine: CleanupEngine) {
  console.log('🚀 Starting comprehensive project analysis...\n')
  
  const report = await engine.scanProject()
  
  console.log('\n📊 Analysis Results:')
  console.log('='.repeat(50))
  console.log(`Total files: ${report.totalFiles}`)
  console.log(`Obsolete files: ${report.obsoleteFiles.length}`)
  console.log(`Duplicate groups: ${report.duplicateFiles.length}`)
  console.log(`Large files (>1MB): ${report.largeFiles.length}`)
  
  console.log('\n📂 File Categories:')
  Object.entries(report.categorizedFiles).forEach(([category, files]) => {
    console.log(`  ${category.padEnd(15)}: ${files.length.toString().padStart(4)} files`)
  })

  if (report.obsoleteFiles.length > 0) {
    console.log('\n🗑️  Obsolete Files:')
    report.obsoleteFiles.slice(0, 10).forEach(file => {
      console.log(`  - ${file}`)
    })
    if (report.obsoleteFiles.length > 10) {
      console.log(`  ... and ${report.obsoleteFiles.length - 10} more`)
    }
  }

  if (report.largeFiles.length > 0) {
    console.log('\n📊 Large Files:')
    report.largeFiles.slice(0, 5).forEach(file => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      console.log(`  - ${file.path} (${sizeMB} MB)`)
    })
  }

  // Save report to file
  const reportPath = 'cleanup-analysis-report.json'
  await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n💾 Report saved to: ${reportPath}`)
}

async function generatePlan(engine: CleanupEngine) {
  console.log('📋 Generating cleanup plan...\n')
  
  const plan = await engine.generateCleanupPlan()
  
  console.log('🎯 Cleanup Plan:')
  console.log('='.repeat(50))
  console.log(`Risk Level: ${plan.riskLevel.toUpperCase()}`)
  console.log(`Estimated Space Saved: ${(plan.estimatedSpaceSaved / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`Phases: ${plan.phases.length}`)
  
  console.log('\n📋 Cleanup Phases:')
  plan.phases.forEach((phase, index) => {
    console.log(`\n${index + 1}. ${phase.name}`)
    console.log(`   ${phase.description}`)
    console.log(`   Files to remove: ${phase.filesToRemove.length}`)
    console.log(`   Files to archive: ${phase.filesToArchive.length}`)
    console.log(`   Files to move: ${phase.filesToMove.length}`)
    console.log(`   Validation required: ${phase.validationRequired ? 'Yes' : 'No'}`)
  })

  console.log('\n✅ Validation Steps:')
  plan.validationSteps.forEach((step, index) => {
    console.log(`${index + 1}. ${step.description} ${step.required ? '(Required)' : '(Optional)'}`)
  })

  // Save plan to file
  const planPath = 'cleanup-plan.json'
  await fs.promises.writeFile(planPath, JSON.stringify(plan, null, 2))
  console.log(`\n💾 Plan saved to: ${planPath}`)
}

async function scanOnly(engine: CleanupEngine) {
  console.log('🔍 Scanning project files...\n')
  
  // Note: Need to access fileScanner through engine
  console.log('Scan functionality will be implemented in the next iteration')
}

// Run main function
main()

async function validateFiles(engine: CleanupEngine, filePaths: string[]) {
  console.log('🔍 Validating files for safe removal...\n')
  
  let files: string[]
  
  if (filePaths.length > 0) {
    // Use provided file paths
    files = filePaths
  } else {
    // Get obsolete files from analysis
    const report = await engine.scanProject()
    files = report.obsoleteFiles.slice(0, 20) // Limit to first 20 for demo
  }

  if (files.length === 0) {
    console.log('No files to validate')
    return
  }

  console.log(`Validating ${files.length} files...`)
  
  // Analyze dependencies first
  const allFiles = await engine.scanProject()
  await engine.analyzeDependencies(Object.values(allFiles.categorizedFiles).flat())
  
  // Validate files
  const validation = await engine.validateCleanup(files)
  
  console.log('\n📊 Validation Results:')
  console.log('='.repeat(50))
  console.log(`Safe to remove: ${validation.safe.length}`)
  console.log(`Unsafe to remove: ${validation.unsafe.length}`)
  
  if (validation.unsafe.length > 0) {
    console.log('\n⚠️  Unsafe Files:')
    validation.unsafe.forEach(file => {
      console.log(`  - ${file}`)
      const warnings = validation.warnings.get(file)
      if (warnings) {
        warnings.forEach(warning => {
          console.log(`    ⚠️  ${warning}`)
        })
      }
    })
  }

  if (validation.safe.length > 0) {
    console.log('\n✅ Safe Files:')
    validation.safe.slice(0, 10).forEach(file => {
      console.log(`  - ${file}`)
    })
    if (validation.safe.length > 10) {
      console.log(`  ... and ${validation.safe.length - 10} more`)
    }
  }

  // Generate validation report
  const validationEngine = engine.getValidationEngine()
  const report = validationEngine.generateValidationReport(validation)
  const reportPath = 'validation-report.md'
  await fs.promises.writeFile(reportPath, report)
  console.log(`\n💾 Validation report saved to: ${reportPath}`)
}
async function executeCleanup(engine: CleanupEngine, phases: string[]) {
  console.log('🚀 Starting system cleanup execution...\n')
  
  const executor = new CleanupExecutor()
  const results: any[] = []

  try {
    // Determine which phases to run
    const phasesToRun = phases.length > 0 ? phases : ['1', '2', '3', '4']
    
    for (const phase of phasesToRun) {
      let result
      
      switch (phase) {
        case '1':
          result = await executor.executePhase1()
          break
        case '2':
          result = await executor.executePhase2()
          break
        case '3':
          result = await executor.executePhase3()
          break
        case '4':
          result = await executor.executePhase4()
          break
        default:
          console.log(`Unknown phase: ${phase}`)
          continue
      }
      
      results.push(result)
      
      // Run integrity tests after each phase
      console.log('\n🔍 Running integrity tests...')
      const integrityPassed = await executor.runIntegrityTests()
      
      if (!integrityPassed) {
        console.log('❌ Integrity tests failed. Stopping cleanup.')
        break
      }
      
      console.log('✅ Integrity tests passed. Continuing...\n')
    }

    // Generate final report
    await executor.generateFinalReport(results)
    
    console.log('\n🎉 Cleanup execution completed!')
    console.log('📄 Check cleanup-final-report.md for detailed results')
    
  } catch (error) {
    console.error('❌ Cleanup execution failed:', error)
    process.exit(1)
  }
}