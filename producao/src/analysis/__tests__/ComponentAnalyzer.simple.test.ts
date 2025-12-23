import { describe, it, expect } from 'vitest';
import { ComponentAnalyzer } from '../ComponentAnalyzer';
import { Project } from 'ts-morph';

describe('ComponentAnalyzer Simple Tests', () => {
  it('should create analyzer instance', () => {
    const analyzer = new ComponentAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it('should analyze empty project', async () => {
    const analyzer = new TestComponentAnalyzer([]);
    const result = await analyzer.analyze();
    
    expect(result).toBeDefined();
    expect(result.components).toEqual([]);
    expect(result.deadCode).toEqual([]);
  });

  it('should detect simple React component', async () => {
    const componentCode = `
import React from 'react';

export function TestComponent() {
  return <div>Hello World</div>;
}
`;

    const analyzer = new TestComponentAnalyzer([
      { path: 'src/TestComponent.tsx', content: componentCode }
    ]);
    
    const result = await analyzer.analyze();
    
    expect(result.components).toHaveLength(1);
    expect(result.components[0].componentName).toBe('TestComponent');
    expect(result.components[0].complexity).toBeDefined();
    expect(result.components[0].filePath).toContain('TestComponent.tsx');
  });
});

class TestComponentAnalyzer extends ComponentAnalyzer {
  constructor(private mockFiles: Array<{ path: string; content: string }>) {
    super();
    // Override project with mock files
    this.project = new Project({ useInMemoryFileSystem: true });
    
    for (const file of mockFiles) {
      this.project.createSourceFile(file.path, file.content);
    }
  }
}