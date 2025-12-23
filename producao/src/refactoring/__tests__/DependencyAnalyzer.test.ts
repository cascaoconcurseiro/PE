/**
 * Unit tests for DependencyAnalyzer
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { analyzeDependencies } from '../analyzers/DependencyAnalyzer';

describe('DependencyAnalyzer', () => {
  describe('Basic Dependency Analysis', () => {
    it('should analyze empty project', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const report = await analyzeDependencies(project);
      
      expect(report.totalFiles).toBe(0);
      expect(report.totalDependencies).toBe(0);
      expect(report.circularDependencies).toHaveLength(0);
      expect(report.unusedDependencies).toHaveLength(0);
      expect(report.externalDependencies).toHaveLength(0);
    });

    it('should detect simple dependencies', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('src/utils.ts', `
        export const helper = () => 'test';
      `);
      
      project.createSourceFile('src/component.tsx', `
        import React from 'react';
        import { helper } from './utils';
        
        export const Component = () => {
          return <div>{helper()}</div>;
        };
      `);
      
      const report = await analyzeDependencies(project);
      
      expect(report.totalFiles).toBe(2);
      expect(report.totalDependencies).toBe(2);
      expect(report.externalDependencies).toContainEqual(
        expect.objectContaining({ name: 'react' })
      );
    });

    it('should detect unused imports', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('src/component.tsx', `
        import React from 'react';
        import { useState, useEffect } from 'react';
        
        export const Component = () => {
          const [state] = useState(0);
          return <div>{state}</div>;
        };
      `);
      
      const report = await analyzeDependencies(project);
      
      expect(report.unusedDependencies).toContainEqual(
        expect.objectContaining({
          importName: 'useEffect',
          reason: expect.stringContaining('never used')
        })
      );
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependency', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('src/a.ts', `
        import { b } from './b';
        export const a = () => b();
      `);
      
      project.createSourceFile('src/b.ts', `
        import { a } from './a';
        export const b = () => a();
      `);
      
      const report = await analyzeDependencies(project);
      
      expect(report.circularDependencies).toHaveLength(1);
      expect(report.circularDependencies[0].files).toContain('/src/a.ts');
      expect(report.circularDependencies[0].files).toContain('/src/b.ts');
    });

    it('should not detect false positives', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('src/utils.ts', `
        export const helper = () => 'test';
      `);
      
      project.createSourceFile('src/component.tsx', `
        import { helper } from './utils';
        export const Component = () => helper();
      `);
      
      const report = await analyzeDependencies(project);
      
      expect(report.circularDependencies).toHaveLength(0);
    });
  });

  describe('External Dependencies', () => {
    it('should track external package usage', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      
      project.createSourceFile('src/component.tsx', `
        import React from 'react';
        import { Button } from '@mui/material';
        import axios from 'axios';
        
        export const Component = () => <Button>Test</Button>;
      `);
      
      const report = await analyzeDependencies(project);
      
      expect(report.externalDependencies).toContainEqual(
        expect.objectContaining({ name: 'react' })
      );
      expect(report.externalDependencies).toContainEqual(
        expect.objectContaining({ name: '@mui/material' })
      );
      expect(report.externalDependencies).toContainEqual(
        expect.objectContaining({ name: 'axios' })
      );
    });
  });
});