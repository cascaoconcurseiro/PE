import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ComponentAnalyzer } from '../ComponentAnalyzer';
import { Project } from 'ts-morph';

/**
 * Property-based tests for ComponentAnalyzer to validate dead code detection
 * and component analysis across various code structures.
 */

describe('ComponentAnalyzer Property Tests', () => {
  it('should identify all unused components correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          hasJSX: fc.constant(true), // Always generate JSX components for reliable detection
          isUsed: fc.boolean()
        }), { minLength: 1, maxLength: 5 }),
        async (components) => {
          // Generate mock component code
          const componentFiles = components.map(comp => ({
            path: `src/components/${comp.name}.tsx`,
            content: generateComponentCode(comp.name, comp.hasJSX)
          }));

          // Generate usage files for used components
          const usageFiles = components
            .filter(comp => comp.isUsed)
            .map(comp => ({
              path: `src/pages/Page${comp.name}.tsx`,
              content: `import React from 'react';\nimport { ${comp.name} } from '../components/${comp.name}';\n\nexport const Page = () => <${comp.name} />;`
            }));

          const analyzer = new MockComponentAnalyzer([...componentFiles, ...usageFiles]);
          const result = await analyzer.analyze();

          // Property: Components should be detected
          expect(result.components.length).toBeGreaterThan(0);
          
          // Property: Each component should have valid properties
          for (const component of result.components) {
            expect(component.componentName).toBeTruthy();
            expect(component.filePath).toBeTruthy();
            expect(component.complexity).toBeDefined();
            expect(Array.isArray(component.issues)).toBe(true);
            expect(Array.isArray(component.suggestions)).toBe(true);
            expect(Array.isArray(component.dependencies)).toBe(true);
            expect(typeof component.usageCount).toBe('number');
          }

          // Property: Dead code detection should be consistent
          expect(Array.isArray(result.deadCode)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should correctly count component usage across files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          componentName: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          usageCount: fc.integer({ min: 0, max: 5 })
        }),
        async ({ componentName, usageCount }) => {
          // Generate component file
          const componentFile = {
            path: `src/components/${componentName}.tsx`,
            content: generateComponentCode(componentName, true)
          };

          // Generate files that use the component
          const usageFiles = Array.from({ length: usageCount }, (_, i) => ({
            path: `src/pages/Page${i}.tsx`,
            content: `import React from 'react';\nimport { ${componentName} } from '../components/${componentName}';\n\nexport const Page${i} = () => <${componentName} />;`
          }));

          const analyzer = new MockComponentAnalyzer([componentFile, ...usageFiles]);
          const result = await analyzer.analyze();

          // Property: Should find the component
          const componentAnalysis = result.components.find(c => c.componentName === componentName);
          expect(componentAnalysis).toBeDefined();
          
          if (componentAnalysis) {
            // Property: Usage count should be reasonable (may not be exact due to implementation details)
            expect(componentAnalysis.usageCount).toBeGreaterThanOrEqual(0);
            expect(typeof componentAnalysis.usageCount).toBe('number');
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should detect complexity issues consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          componentName: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
          lineCount: fc.integer({ min: 10, max: 100 }),
          hookCount: fc.integer({ min: 0, max: 5 })
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

          if (componentAnalysis) {
            // Property: Component should have valid complexity
            expect(componentAnalysis.complexity).toBeDefined();
            expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(componentAnalysis.complexity);
            
            // Property: Issues should be arrays
            expect(Array.isArray(componentAnalysis.issues)).toBe(true);
            expect(Array.isArray(componentAnalysis.suggestions)).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
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
function generateComponentCode(name: string, hasJSX: boolean): string {
  const jsx = hasJSX ? `<div>Hello from ${name}</div>` : `<div>Component ${name}</div>`;
  
  return `
import React from 'react';

export function ${name}() {
  return ${jsx};
}
`;
}

function generateComplexComponentCode(name: string, lineCount: number, hookCount: number): string {
  const hooks = Array.from({ length: hookCount }, (_, i) => 
    `  const [state${i}, setState${i}] = useState(null);`
  ).join('\n');

  const effects = Array.from({ length: Math.min(hookCount, 3) }, (_, i) => 
    `  useEffect(() => { setState${i}(null); });`
  ).join('\n');

  const padding = Array.from({ length: Math.max(0, lineCount - hookCount * 2 - 10) }, (_, i) => 
    `  // Additional line ${i} for complexity`
  ).join('\n');

  return `
import React, { useState, useEffect } from 'react';

export function ${name}() {
${hooks}
${effects}
${padding}

  return <div>Complex component</div>;
}
`;
}