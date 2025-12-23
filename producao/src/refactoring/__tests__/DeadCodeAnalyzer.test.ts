/**
 * Unit tests for Dead Code Analyzer
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { analyzeDeadCode } from '../analyzers/DeadCodeAnalyzer';

describe('DeadCodeAnalyzer', () => {
  describe('Unused Imports Detection', () => {
    it('should detect unused named imports', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.ts', `
        import { unusedFunction, usedFunction } from './module';
        
        console.log(usedFunction());
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(1);
      expect(result.unusedImports[0].importName).toBe('unusedFunction');
      expect(result.unusedImports[0].modulePath).toBe('./module');
    });

    it('should detect unused default imports', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.ts', `
        import UnusedDefault from './module';
        import UsedDefault from './other';
        
        console.log(UsedDefault);
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(1);
      expect(result.unusedImports[0].importName).toBe('UnusedDefault');
    });

    it('should detect unused namespace imports', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.ts', `
        import * as UnusedNamespace from './module';
        import * as UsedNamespace from './other';
        
        console.log(UsedNamespace.something);
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(1);
      expect(result.unusedImports[0].importName).toBe('UnusedNamespace');
    });

    it('should handle type-only imports correctly', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.ts', `
        import type { UnusedType } from './types';
        import { type UsedType } from './types';
        
        const value: UsedType = {};
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(1);
      expect(result.unusedImports[0].importName).toBe('UnusedType');
      expect(result.unusedImports[0].isTypeOnly).toBe(true);
    });

    it('should skip test files', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.test.ts', `
        import { unusedInTest } from './module';
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(0);
    });
  });

  describe('Orphaned Components Detection', () => {
    it('should detect unused function components', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('components.tsx', `
        function UnusedComponent() {
          return <div>Unused</div>;
        }
        
        function UsedComponent() {
          return <div>Used</div>;
        }
      `);
      
      project.createSourceFile('app.tsx', `
        import { UsedComponent } from './components';
        
        function App() {
          return <UsedComponent />;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.orphanedComponents.length).toBeGreaterThanOrEqual(1);
      const unusedComponent = result.orphanedComponents.find(c => c.componentName === 'UnusedComponent');
      expect(unusedComponent).toBeDefined();
      expect(unusedComponent?.componentName).toBe('UnusedComponent');
    });

    it('should detect unused arrow function components', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('components.tsx', `
        const UnusedArrowComponent = () => {
          return <div>Unused</div>;
        };
        
        const UsedArrowComponent = () => {
          return <div>Used</div>;
        };
      `);
      
      project.createSourceFile('app.tsx', `
        import { UsedArrowComponent } from './components';
        
        function App() {
          return <UsedArrowComponent />;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.orphanedComponents.length).toBeGreaterThanOrEqual(1);
      const unusedComponent = result.orphanedComponents.find(c => c.componentName === 'UnusedArrowComponent');
      expect(unusedComponent).toBeDefined();
      expect(unusedComponent?.componentName).toBe('UnusedArrowComponent');
    });

    it('should identify components used only in tests', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('components.tsx', `
        function TestOnlyComponent() {
          return <div>Test Only</div>;
        }
      `);
      
      project.createSourceFile('components.test.tsx', `
        import { TestOnlyComponent } from './components';
        
        test('renders component', () => {
          render(<TestOnlyComponent />);
        });
      `);
      
      const result = await analyzeDeadCode(project);
      
      // Should not be marked as orphaned since it's used in tests
      expect(result.orphanedComponents).toHaveLength(0);
    });

    it('should track export status', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('components.tsx', `
        export function ExportedUnusedComponent() {
          return <div>Exported but unused</div>;
        }
        
        function InternalUnusedComponent() {
          return <div>Internal and unused</div>;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      const exportedComponent = result.orphanedComponents.find(c => c.componentName === 'ExportedUnusedComponent');
      const internalComponent = result.orphanedComponents.find(c => c.componentName === 'InternalUnusedComponent');
      
      expect(exportedComponent?.isExported).toBe(true);
      expect(internalComponent?.isExported).toBe(false);
    });
  });

  describe('Unused Hooks Detection', () => {
    it('should detect unused custom hooks', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('hooks.ts', `
        function useUnusedHook() {
          return { value: 'unused' };
        }
        
        function useUsedHook() {
          return { value: 'used' };
        }
      `);
      
      project.createSourceFile('component.tsx', `
        import { useUsedHook } from './hooks';
        
        function Component() {
          const { value } = useUsedHook();
          return <div>{value}</div>;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedHooks).toHaveLength(1);
      expect(result.unusedHooks[0].hookName).toBe('useUnusedHook');
      expect(result.unusedHooks[0].isCustomHook).toBe(true);
    });

    it('should detect unused arrow function hooks', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('hooks.ts', `
        const useUnusedArrowHook = () => {
          return { value: 'unused' };
        };
        
        const useUsedArrowHook = () => {
          return { value: 'used' };
        };
      `);
      
      project.createSourceFile('component.tsx', `
        import { useUsedArrowHook } from './hooks';
        
        function Component() {
          const { value } = useUsedArrowHook();
          return <div>{value}</div>;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedHooks).toHaveLength(1);
      expect(result.unusedHooks[0].hookName).toBe('useUnusedArrowHook');
    });

    it('should only consider functions starting with "use" and uppercase letter', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('utils.ts', `
        function user() { return 'not a hook'; }
        function useValidHook() { return 'valid hook'; }
        function useinvalidhook() { return 'invalid hook name'; }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedHooks).toHaveLength(1);
      expect(result.unusedHooks[0].hookName).toBe('useValidHook');
    });
  });

  describe('Unused Types Detection', () => {
    it('should detect unused interfaces', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('types.ts', `
        interface UnusedInterface {
          value: string;
        }
        
        interface UsedInterface {
          value: string;
        }
        
        const obj: UsedInterface = { value: 'test' };
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedTypes).toHaveLength(1);
      expect(result.unusedTypes[0].typeName).toBe('UnusedInterface');
      expect(result.unusedTypes[0].kind).toBe('interface');
    });

    it('should detect unused type aliases', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('types.ts', `
        type UnusedType = string | number;
        type UsedType = string | number;
        
        const value: UsedType = 'test';
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedTypes).toHaveLength(1);
      expect(result.unusedTypes[0].typeName).toBe('UnusedType');
      expect(result.unusedTypes[0].kind).toBe('type');
    });

    it('should detect unused enums', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('types.ts', `
        enum UnusedEnum {
          VALUE1 = 'value1',
          VALUE2 = 'value2'
        }
        
        enum UsedEnum {
          VALUE1 = 'value1',
          VALUE2 = 'value2'
        }
        
        const value = UsedEnum.VALUE1;
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedTypes.length).toBeGreaterThanOrEqual(1);
      const unusedEnum = result.unusedTypes.find(t => t.typeName === 'UnusedEnum');
      expect(unusedEnum).toBeDefined();
      expect(unusedEnum?.typeName).toBe('UnusedEnum');
      expect(unusedEnum?.kind).toBe('enum');
    });

    it('should track export status of types', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('types.ts', `
        export interface ExportedUnusedInterface {
          value: string;
        }
        
        interface InternalUnusedInterface {
          value: string;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      const exportedType = result.unusedTypes.find(t => t.typeName === 'ExportedUnusedInterface');
      const internalType = result.unusedTypes.find(t => t.typeName === 'InternalUnusedInterface');
      
      expect(exportedType?.isExported).toBe(true);
      expect(internalType?.isExported).toBe(false);
    });

    it('should skip declaration files', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('types.d.ts', `
        interface DeclarationInterface {
          value: string;
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedTypes).toHaveLength(0);
    });
  });

  describe('Savings Calculation', () => {
    it('should calculate total savings correctly', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('test.ts', `
        import { unused1, unused2 } from './module';
        
        interface UnusedInterface {}
        type UnusedType = string;
        
        function UnusedComponent() {
          return <div>unused</div>;
        }
        
        function useUnusedHook() {
          return {};
        }
      `);
      
      const result = await analyzeDeadCode(project);
      
      expect(result.totalSavings.linesOfCode).toBeGreaterThan(0);
      expect(result.totalSavings.bundleSize).toBeGreaterThan(0);
      expect(result.totalSavings.files).toBe(1);
    });

    it('should handle empty codebase', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      const result = await analyzeDeadCode(project);
      
      expect(result.unusedImports).toHaveLength(0);
      expect(result.orphanedComponents).toHaveLength(0);
      expect(result.unusedHooks).toHaveLength(0);
      expect(result.unusedTypes).toHaveLength(0);
      expect(result.totalSavings.linesOfCode).toBe(0);
      expect(result.totalSavings.bundleSize).toBe(0);
      expect(result.totalSavings.files).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with syntax errors gracefully', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      // This will create a file with syntax errors, but ts-morph should handle it
      project.createSourceFile('broken.ts', `
        import { something } from './module'
        // Missing semicolon and other syntax issues
        function broken( {
          return
        }
      `);
      
      // Should not throw an error
      await expect(analyzeDeadCode(project)).resolves.toBeDefined();
    });

    it('should handle complex import patterns', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('complex.ts', `
        import React, { useState, useEffect as useEff } from 'react';
        import * as Utils from './utils';
        import type { ComplexType } from './types';
        import { default as DefaultExport } from './default';
        
        // Only React and useState are used
        const Component = () => {
          const [state] = useState(0);
          return React.createElement('div', null, state);
        };
      `);
      
      const result = await analyzeDeadCode(project);
      
      // Should detect useEff (alias), Utils (namespace), ComplexType, and DefaultExport as unused
      expect(result.unusedImports.length).toBeGreaterThanOrEqual(3);
    });
  });
});