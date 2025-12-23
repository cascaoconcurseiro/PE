#!/usr/bin/env node
/**
 * CLI tool for running refactoring analysis
 */

import { createRefactoringEngine } from './RefactoringEngine';
import { analyzeComplexity } from './analyzers/ComplexityAnalyzer';
import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: npm run refactor <command>');
    console.log('Commands:');
    console.log('  complexity - Analyze component complexity');
    console.log('  full - Run full analysis');
    process.exit(1);
  }

  const rootPath = process.cwd();
  console.log(`🔍 Analyzing codebase at: ${rootPath}`);

  try {
    if (command === 'complexity') {
      await runComplexityAnalysis(rootPath);
    } else if (command === 'full') {
      await runFullAnalysis(rootPath);
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

async function runComplexityAnalysis(rootPath: string) {
  console.log('📊 Running complexity analysis...');
  
  const project = new Project({
    tsConfigFilePath: path.join(rootPath, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  // Add all TypeScript files to the project
  project.addSourceFilesAtPaths(`${rootPath}/src/**/*.{ts,tsx}`);
  
  const report = await analyzeComplexity(project);
  
  console.log('\n📈 Complexity Analysis Results:');
  console.log(`  Total components analyzed: ${report.components.length}`);
  console.log(`  Average complexity: ${report.averageComplexity.toFixed(2)}`);
  console.log(`  Complex components (>15): ${report.complexComponents.length}`);
  
  if (report.complexComponents.length > 0) {
    console.log('\n🚨 Most Complex Components:');
    const sortedComplex = report.complexComponents
      .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
      .slice(0, 10);
    
    for (const component of sortedComplex) {
      console.log(`  ${component.componentName} (${component.cyclomaticComplexity})`);
      console.log(`    📁 ${component.location.filePath}`);
      console.log(`    📏 ${component.linesOfCode} lines, ${component.numberOfProps} props, ${component.numberOfHooks} hooks`);
      console.log(`    🔧 ${component.decompositionSuggestions.length} suggestions`);
      
      if (component.decompositionSuggestions.length > 0) {
        for (const suggestion of component.decompositionSuggestions.slice(0, 2)) {
          console.log(`      • ${suggestion.description}`);
        }
      }
      console.log('');
    }
  }
  
  // Save detailed report
  const reportPath = path.join(rootPath, `complexity-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

async function runFullAnalysis(rootPath: string) {
  console.log('🔍 Running full refactoring analysis...');
  
  const engine = createRefactoringEngine();
  const analysis = await engine.analyzeCodebase(rootPath);
  const report = engine.generateReport(analysis);
  
  console.log('\n📊 Full Analysis Results:');
  console.log(`  Total files: ${report.codebaseSnapshot.totalFiles}`);
  console.log(`  Total lines of code: ${report.codebaseSnapshot.totalLinesOfCode}`);
  console.log(`  Bundle size estimate: ${(report.codebaseSnapshot.bundleSize / 1024).toFixed(2)} KB`);
  console.log(`  Average complexity: ${report.codebaseSnapshot.averageComplexity.toFixed(2)}`);
  
  console.log('\n🎯 Recommendations:');
  const topRecommendations = report.recommendations
    .sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 10);
  
  for (const rec of topRecommendations) {
    console.log(`  ${rec.priority} - ${rec.title}`);
    console.log(`    ${rec.description}`);
    console.log(`    Impact: ${rec.impact}, Effort: ${rec.effort}`);
    console.log('');
  }
  
  // Save detailed report
  const reportPath = path.join(rootPath, `refactoring-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

// Run main function
main();