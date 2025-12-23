import { SystemAnalyzer } from './SystemAnalyzer';
import * as fs from 'fs';

async function runSystemAnalysis() {
  try {
    const analyzer = new SystemAnalyzer('./src');
    const result = await analyzer.analyzeSystem();
    
    // Salvar relatório
    const reportPath = './analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    
    console.log('\n📊 RELATÓRIO DE ANÁLISE DO SISTEMA FINANCEIRO');
    console.log('='.repeat(50));
    
    console.log(`\n📈 RESUMO:`);
    console.log(`• Total de problemas encontrados: ${result.summary.totalIssues}`);
    console.log(`• Problemas críticos: ${result.summary.criticalIssues}`);
    console.log(`• Potencial de redução de código: ${result.summary.codeReductionPotential}%`);
    console.log(`• Potencial de melhoria de performance: ${result.summary.performanceImprovementPotential}%`);
    console.log(`• Score de manutenibilidade: ${result.summary.maintainabilityScore}/10`);
    
    console.log(`\n🗑️ CÓDIGO MORTO (${result.frontend.deadCode.length} itens):`);
    result.frontend.deadCode.forEach(item => {
      console.log(`• ${item.type}: ${item.name} - ${item.reason}`);
    });
    
    console.log(`\n💡 RECOMENDAÇÕES PRIORITÁRIAS (${result.recommendations.length} itens):`);
    result.recommendations
      .filter(r => r.priority === 'HIGH')
      .forEach(rec => {
        console.log(`• ${rec.title} (${rec.effort} esforço, ${rec.impact} impacto)`);
        console.log(`  ${rec.description}`);
      });
    
    console.log(`\n📄 Relatório completo salvo em: ${reportPath}`);
    
    return result;
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runSystemAnalysis();
}

export { runSystemAnalysis };