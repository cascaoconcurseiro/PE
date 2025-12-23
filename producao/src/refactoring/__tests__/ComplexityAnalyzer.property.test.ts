/**
 * Property-based tests for ComplexityAnalyzer
 * Tests universal properties that should hold for any valid input
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Project } from 'ts-morph';
import { analyzeComplexity } from '../analyzers/ComplexityAnalyzer';
import { ComplexityReport, ComponentComplexity } from '../types';

describe('ComplexityAnalyzer - Property-based Tests', () => {
  /**
   * Property 4: Decomposição Válida de Componentes Complexos
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  describe('Property 4: Valid Component Decomposition', () => {
    it('should always produce valid complexity metrics for any React component', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid React component code
          fc.record({
            componentName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
            propsCount: fc.integer({ min: 0, max: 20 }),
            hooksCount: fc.integer({ min: 0, max: 15 }),
            conditionals: fc.integer({ min: 0, max: 10 }),
            jsxElements: fc.integer({ min: 1, max: 30 }),
            hasStateManagement: fc.boolean(),
            hasDataFetching: fc.boolean(),
            hasEventHandling: fc.boolean()
          }),
          async (componentSpec) => {
            // Generate React component code based on spec
            const componentCode = generateReactComponent(componentSpec);
            
            // Create temporary project with the component
            const project = new Project({ useInMemoryFileSystem: true });
            const sourceFile = project.createSourceFile('TestComponent.tsx', componentCode);
            
            // Analyze complexity
            const report = await analyzeComplexity(project);
            
            // Property 4.1: All complexity metrics should be non-negative
            for (const component of report.components) {
              expect(component.cyclomaticComplexity).toBeGreaterThanOrEqual(1); // Base complexity is 1
              expect(component.linesOfCode).toBeGreaterThanOrEqual(1);
              expect(component.numberOfProps).toBeGreaterThanOrEqual(0);
              expect(component.numberOfHooks).toBeGreaterThanOrEqual(0);
              expect(component.numberOfChildren).toBeGreaterThanOrEqual(0);
            }
            
            // Property 4.2: Average complexity should be meaningful
            if (report.components.length > 0) {
              const calculatedAverage = report.components.reduce((sum, comp) => sum + comp.cyclomaticComplexity, 0) / report.components.length;
              expect(Math.abs(report.averageComplexity - calculatedAverage)).toBeLessThan(0.01);
            } else {
              expect(report.averageComplexity).toBe(0);
            }
            
            // Property 4.3: Complex components should be correctly identified
            const actualComplexComponents = report.components.filter(comp => comp.cyclomaticComplexity > 15);
            expect(report.complexComponents).toHaveLength(actualComplexComponents.length);
            
            // Property 4.4: Decomposition suggestions should be valid for complex components
            for (const component of report.complexComponents) {
              expect(component.decompositionSuggestions).toBeDefined();
              expect(Array.isArray(component.decompositionSuggestions)).toBe(true);
              
              // Each suggestion should have required fields
              for (const suggestion of component.decompositionSuggestions) {
                expect(suggestion.type).toMatch(/^(EXTRACT_COMPONENT|EXTRACT_HOOK|SPLIT_RESPONSIBILITIES)$/);
                expect(suggestion.description).toBeTruthy();
                expect(suggestion.benefits).toBeInstanceOf(Array);
                expect(suggestion.benefits.length).toBeGreaterThan(0);
                expect(suggestion.effort).toMatch(/^(LOW|MEDIUM|HIGH)$/);
              }
            }
            
            // Property 4.5: Responsibilities should be logically consistent
            for (const component of report.components) {
              expect(component.responsibilities).toBeDefined();
              expect(Array.isArray(component.responsibilities)).toBe(true);
              
              // Should always have UI_RENDERING responsibility for React components
              const hasUIRendering = component.responsibilities.some(r => r.type === 'UI_RENDERING');
              expect(hasUIRendering).toBe(true);
              
              // Each responsibility should have valid structure
              for (const responsibility of component.responsibilities) {
                expect(responsibility.type).toMatch(/^(STATE_MANAGEMENT|DATA_FETCHING|UI_RENDERING|EVENT_HANDLING|BUSINESS_LOGIC)$/);
                expect(responsibility.description).toBeTruthy();
                expect(responsibility.linesOfCode).toBeGreaterThanOrEqual(0);
              }
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    });

    it('should generate appropriate suggestions based on complexity thresholds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            componentName: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
            cyclomaticComplexity: fc.integer({ min: 1, max: 50 }),
            numberOfChildren: fc.integer({ min: 0, max: 50 }),
            numberOfHooks: fc.integer({ min: 0, max: 20 }),
            responsibilityCount: fc.integer({ min: 1, max: 8 })
          }),
          async (spec) => {
            // Generate component with specific complexity characteristics
            const componentCode = generateComplexComponent(spec);
            
            const project = new Project({ useInMemoryFileSystem: true });
            project.createSourceFile('ComplexComponent.tsx', componentCode);
            
            const report = await analyzeComplexity(project);
            const component = report.components[0];
            
            if (!component) return; // Skip if no component found
            
            // Property 4.6: Suggestions should match complexity characteristics
            const suggestions = component.decompositionSuggestions;
            
            if (spec.numberOfChildren > 10) {
              const hasExtractComponent = suggestions.some(s => s.type === 'EXTRACT_COMPONENT' && s.description.includes('JSX'));
              expect(hasExtractComponent).toBe(true);
            }
            
            if (spec.numberOfHooks > 8) {
              const hasExtractHook = suggestions.some(s => s.type === 'EXTRACT_HOOK');
              expect(hasExtractHook).toBe(true);
            }
            
            if (spec.responsibilityCount > 3) {
              const hasSplitResponsibilities = suggestions.some(s => s.type === 'SPLIT_RESPONSIBILITIES');
              // Only expect this suggestion if the component actually has multiple responsibilities
              if (component.responsibilities.length > 3) {
                expect(hasSplitResponsibilities).toBe(true);
              }
            }
            
            if (spec.cyclomaticComplexity > 15) {
              const hasComplexityReduction = suggestions.some(s => s.description.includes('complexity'));
              expect(hasComplexityReduction).toBe(true);
            }
          }
        ),
        { numRuns: 50, timeout: 20000 }
      );
    });

    it('should maintain consistency between metrics and suggestions', async () => {
      // Simple test to verify basic consistency
      const project = new Project({ useInMemoryFileSystem: true });
      project.createSourceFile('SimpleComponent.tsx', `
        import React from 'react';
        
        export const SimpleComponent = () => {
          return <div>Simple</div>;
        };
      `);
      
      const report = await analyzeComplexity(project);
      
      expect(report.components).toHaveLength(1);
      expect(report.averageComplexity).toBeGreaterThan(0);
      expect(report.complexComponents).toHaveLength(0); // Simple component shouldn't be complex
      
      const component = report.components[0];
      expect(component.componentName).toBe('SimpleComponent');
      expect(component.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
      expect(component.responsibilities).toContainEqual(
        expect.objectContaining({ type: 'UI_RENDERING' })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty projects gracefully', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const report = await analyzeComplexity(project);
      
      expect(report.components).toHaveLength(0);
      expect(report.averageComplexity).toBe(0);
      expect(report.complexComponents).toHaveLength(0);
    });

    it('should handle non-component files gracefully', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      project.createSourceFile('utils.ts', 'export const helper = () => "test";');
      project.createSourceFile('types.ts', 'export interface User { id: string; }');
      
      const report = await analyzeComplexity(project);
      
      expect(report.components).toHaveLength(0);
      expect(report.averageComplexity).toBe(0);
      expect(report.complexComponents).toHaveLength(0);
    });

    it('should handle malformed components gracefully', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      project.createSourceFile('BadComponent.tsx', `
        // Incomplete component
        const BadComponent = () => {
          const [state
      `);
      
      // Should not throw
      const report = await analyzeComplexity(project);
      expect(report).toBeDefined();
    });
  });
});

// Helper functions for generating test components

function generateReactComponent(spec: any): string {
  const { componentName, propsCount, hooksCount, conditionals, jsxElements, hasStateManagement, hasDataFetching, hasEventHandling } = spec;
  
  let imports = "import React";
  const hooks = [];
  
  if (hasStateManagement) {
    imports += ", { useState }";
    hooks.push("const [state, setState] = useState(0);");
  }
  
  if (hasDataFetching) {
    imports += imports.includes("{") ? ", useEffect" : ", { useEffect }";
    hooks.push("useEffect(() => { fetch('/api/data'); }, []);");
  }
  
  imports += " from 'react';";
  
  // Generate props interface
  const propsInterface = propsCount > 0 ? `
interface ${componentName}Props {
  ${Array.from({ length: propsCount }, (_, i) => `prop${i}: string;`).join('\n  ')}
}` : '';

  // Generate component body
  const hooksCode = hooks.join('\n  ');
  const conditionalsCode = Array.from({ length: conditionals }, (_, i) => 
    `if (condition${i}) { /* logic */ }`
  ).join('\n  ');
  
  const jsxCode = Array.from({ length: jsxElements }, (_, i) => 
    `<div key={${i}}>Element {${i}}</div>`
  ).join('\n    ');

  const eventHandlers = hasEventHandling ? `
  const handleClick = () => { /* handle click */ };
  const handleChange = () => { /* handle change */ };` : '';

  return `${imports}

${propsInterface}

export const ${componentName} = (${propsCount > 0 ? `props: ${componentName}Props` : ''}) => {
  ${hooksCode}
  ${eventHandlers}
  
  ${conditionalsCode}
  
  return (
    <div>
      ${jsxCode}
    </div>
  );
};`;
}

function generateComplexComponent(spec: any): string {
  const { componentName, cyclomaticComplexity, numberOfChildren, numberOfHooks, responsibilityCount } = spec;
  
  // Generate hooks
  const hooks = Array.from({ length: numberOfHooks }, (_, i) => {
    const hookTypes = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'];
    const hookType = hookTypes[i % hookTypes.length];
    switch (hookType) {
      case 'useState':
        return `const [state${i}, setState${i}] = useState(0);`;
      case 'useEffect':
        return `useEffect(() => { /* effect ${i} */ }, []);`;
      case 'useCallback':
        return `const callback${i} = useCallback(() => {}, []);`;
      case 'useMemo':
        return `const memo${i} = useMemo(() => ({}), []);`;
      case 'useRef':
        return `const ref${i} = useRef(null);`;
      default:
        return `const hook${i} = ${hookType}(() => {});`;
    }
  }).join('\n  ');
  
  // Generate conditional logic to reach target complexity
  const conditionals = Array.from({ length: Math.max(0, cyclomaticComplexity - 1) }, (_, i) => 
    `if (condition${i}) { 
      console.log('Condition ${i}'); 
    } else if (condition${i + 100}) {
      console.log('Alternative ${i}');
    }`
  ).join('\n  ');
  
  // Generate JSX children
  const children = Array.from({ length: numberOfChildren }, (_, i) => 
    `<div key={${i}}>Child {i}</div>`
  ).join('\n      ');
  
  // Generate event handlers for responsibilities
  const eventHandlers = responsibilityCount > 2 ? `
  const handleClick = () => { /* handle click */ };
  const handleChange = () => { /* handle change */ };` : '';
  
  // Generate business logic for responsibilities
  const businessLogic = responsibilityCount > 1 ? `
  const calculateValue = () => { return Math.random() * 100; };
  const validateInput = (input: string) => { return input.length > 0; };` : '';
  
  return `import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export const ${componentName} = () => {
  ${hooks}
  ${eventHandlers}
  ${businessLogic}
  
  // Add some variables to trigger conditions
  const condition0 = true;
  const condition1 = false;
  const condition100 = Math.random() > 0.5;
  const condition101 = Math.random() > 0.7;
  
  ${conditionals}
  
  return (
    <div>
      ${children}
    </div>
  );
};`;
}

function generateComponentWithFeatures(spec: any): string {
  const { componentName, complexity, features } = spec;
  
  const imports = features.length > 0 ? 
    `import React, { ${features.join(', ')} } from 'react';` : 
    `import React from 'react';`;
  
  const hooksCode = features.map((feature, i) => {
    switch (feature) {
      case 'useState':
        return `const [state${i}, setState${i}] = useState(0);`;
      case 'useEffect':
        return `useEffect(() => { /* effect ${i} */ }, []);`;
      case 'useCallback':
        return `const callback${i} = useCallback(() => {}, []);`;
      case 'useMemo':
        return `const memo${i} = useMemo(() => ({}), []);`;
      default:
        return `const ${feature}${i} = ${feature}(() => {});`;
    }
  }).join('\n  ');
  
  // Add complexity through conditionals
  const conditionals = Array.from({ length: Math.max(0, complexity - 1) }, (_, i) => 
    `if (condition${i}) { /* logic ${i} */ }`
  ).join('\n  ');
  
  return `${imports}

export const ${componentName} = () => {
  ${hooksCode}
  
  ${conditionals}
  
  return <div>{componentName}</div>;
};`;
}