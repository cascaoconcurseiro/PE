import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ComponentAnalyzer } from '../ComponentAnalyzer';
import { Project } from 'ts-morph';

/**
 * Feature: sistema-financeiro-reestruturacao, Property 1: Detecção Abrangente de Código Morto
 * 
 * Property-based tests for ComponentAnalyzer to validate dead code detection
 * and component analysis across various code structures.
 */

describe('ComponentAnalyzer Property Tests', () => {
  it('should identify all unused components correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          hasJSX: fc.boolean(),
          isUsed: fc.boolean(),
          complexity: fc.integer({ min: 1, max: 100 })
        }), { minLength: 1, maxLength: 10 }),
        async (components) => {
          // Generate mock component code
          const componentFiles = components.map(comp => ({
            path: `src/components/${comp.name}.tsx`,
            content: generateComponentCode(comp.name, comp.hasJSX, comp.complexity)
          }));

          // Generate usage files
          const usageFiles = components
            .filter(comp => comp.isUsed)
            .map(comp => ({
              path: `src/pages/Page${comp.name}.tsx`,
              content: `import { ${comp.name} } from '../components/${comp.name}';\n\nexport const Page = () => <${comp.name} />;`
            }));

          const analyzer = new MockComponentAnalyzer([...componentFiles, ...usageFiles]);
          const result = await analyzer.analyze();

          // Property: All unused components should be detected as dead code
          const unusedComponents = components.filter(comp => !comp.isUsed);
          const detectedDeadComponents = result.deadCode.filter(dc => dc.type === 'COMPONENT');

          // Every unused component should be detected
          for (const unusedComp of unusedComponents) {
            const isDetected = detectedDeadComponents.some(dc => dc.name === unusedComp.name);
            expect(isDetected).toBe(true);
          }

          // No used components should be marked as dead
          const usedComponents = components.filter(comp => comp.isUsed);
          for (const usedComp of usedComponents) {
            const isMarkedDead = detectedDeadComponents.some(dc => dc.name === usedComp.name);
            expect(isMarkedDead).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly count component usage across files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          componentName: fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          usageCount: fc.integer({ min: 0, max: 10 })
        }),
        async ({ componentName, usageCount }) => {
          // Generate component file
          const componentFile = {
            path: `src/components/${componentName}.tsx`,
            content: generateComponentCode(componentName, true, 10)
          };

          // Generate files that use the component
          const usageFiles = Array.from({ length: usageCount }, (_, i) => ({
            path: `src/pages/Page${i}.tsx`,
            content: `import { ${componentName} } from '../components/${componentName}';\n\nexport const Page${i} = () => <${componentName} />;`
          }));

          const analyzer = new MockComponentAnalyzer([componentFile, ...usageFiles]);
          const result = await analyzer.analyze();

          // Property: Usage count should match actual usage
          const componentAnalysis = result.components.find(c => c.componentName === componentName);
          expect(componentAnalysis).toBeDefined();
          expect(componentAnalysis!.usageCount).toBe(usageCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect complexity issues consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          componentName: fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          lineCount: fc.integer({ min: 10, max: 200 }),
          hookCount: fc.integer({ min: 0, max: 10 })
        }),
        async ({ componentName, lineCount, hookCount }) => {
          const componentFile = {
            path: `src/components/${componentName}.tsx`,
            content: generateComplexComponentCode(componentName, lineCount, hookCount)
          };

          const analyzer = new MockComponentAnalyzer([componentFile]);
          const result = await analyzer.analyze();

          const componentAnalysis = result.components.find(c => c.componentName === componentName);
          expect(componentAnalysis).toBeDefined();

          // Property: High complexity should generate appropriate issues
          if (lineCount > 100) {
            const hasComplexityIssue = componentAnalysis!.issues.some(
              issue => issue.type === 'OVER_ENGINEERING' && issue.description.includes('overly complex')
            );
            expect(hasComplexityIssue).toBe(true);
          }

          // Property: Many hooks should generate performance warnings
          if (hookCount > 3) {
            const hasPerformanceIssue = componentAnalysis!.issues.some(
              issue => issue.type === 'PERFORMANCE'
            );
            expect(hasPerformanceIssue).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Mock analyzer for testing
class MockComponentAnalyzer extends ComponentAnalyzer {
  constructor(private mockFiles: Array<{ path: string; content: string }>) {
    super();
    // Override project with mock files
    this.project = new Project({ useInMemoryFileSystem: true });
    
    for (const file of mockFiles) {
      this.project.createSourceFile(file.path, file.content);
    }
  }
}

// Helper functions to generate test code
function generateComponentCode(name: string, hasJSX: boolean, complexity: number): string {
  const hooks = Array.from({ length: Math.min(complexity / 20, 5) }, (_, i) => 
    `  const [state${i}, setState${i}] = useState(null);`
  ).join('\n');

  const jsx = hasJSX ? `<div>{state0}</div>` : `null`;
  
  return `
import React, { useState } from 'react';

export const ${name}: React.FC = () => {
${hooks}

  return ${jsx};
};
`.repeat(Math.max(1, Math.floor(complexity / 50)));
}

function generateComplexComponentCode(name: string, lineCount: number, hookCount: number): string {
  const hooks = Array.from({ length: hookCount }, (_, i) => 
    `  const [state${i}, setState${i}] = useState(null);`
  ).join('\n');

  const effects = Array.from({ length: Math.floor(hookCount / 2) }, (_, i) => 
    `  useEffect(() => { setState${i}(null); });`
  ).join('\n');

  const padding = Array.from({ length: Math.max(0, lineCount - hookCount * 2 - 10) }, () => 
    '  // Additional line for complexity'
  ).join('\n');

  return `
import React, { useState, useEffect } from 'react';

export const ${name}: React.FC = () => {
${hooks}
${effects}
${padding}

  return <div>Complex component</div>;
};
`;
}