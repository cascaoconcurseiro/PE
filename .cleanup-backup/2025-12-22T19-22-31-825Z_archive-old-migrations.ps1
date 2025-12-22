# Script para Arquivar Migrations Antigas - Windows PowerShell
# Move migrations antigas para pasta de arquivo

Write-Host "Arquivando Migrations Antigas" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Criar diretorio de arquivo
$archiveDir = "supabase\migrations\archive\2026-01-27_consolidacao"
if (-not (Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}

# Migrations que podem ser arquivadas
$migrationsToArchive = @(
    "20260101_golden_schema.sql",
    "20260102_refactor_splits_to_relational.sql",
    "20260102_verify_splits_migration.sql",
    "20260103_smart_mirroring.sql",
    "20260104_normalization_mega_pack.sql",
    "20260105_final_purification.sql",
    "20260106_strict_typing_enforcement.sql",
    "20260106_strict_typing_enforcement_v2.sql",
    "20260106_strict_typing_enforcement_v3.sql",
    "20260106_strict_typing_enforcement_v4.sql",
    "20260106_strict_typing_enforcement_v5.sql",
    "20260106_strict_typing_enforcement_v6.sql",
    "20260107_fix_family_bidirectional_link.sql",
    "20260108_prevent_duplicates.sql",
    "20260109_deep_integrity_constraints.sql",
    "20260110_account_safety.sql",
    "20260111_soft_delete_governance.sql",
    "20260112_shared_lifecycle_safety.sql",
    "20260113_audit_logging.sql",
    "20260113_balance_governance.sql",
    "20260114_cleanup_ghosts.sql",
    "20260114_fix_audit_schema.sql",
    "20260115_audit_coverage_expansion.sql",
    "20260115_deep_clean_shared_engine.sql",
    "20260115_fix_audit_entity_error.sql",
    "20260115_lock_shared_mirrors.sql",
    "20260115_master_cleanup.sql",
    "20260115_nuke_5_reais.sql",
    "20260115_prevent_shared_duplication.sql",
    "20260115_smart_reset.sql",
    "20260115_sniper_delete.sql",
    "20260116_atomic_integrity.sql",
    "20260117_diagnostic_fk_check.sql",
    "20260117_stabilization_phase.sql",
    "20260117_strict_fks.sql",
    "20260118_ledger_sovereignty.sql",
    "20260119_shared_refactor.sql",
    "20260120_reconciliation_performance.sql",
    "20260121_governance_security.sql",
    "20260122_domain_separation.sql",
    "20260123_backend_centric_rpc.sql",
    "20260123_rpc_enhanced.sql",
    "20260124_advanced_diagnostics.sql",
    "20260124_disable_triggers.sql",
    "20260124_final_auto_correct_domain.sql",
    "20260124_final_rpc_fix.sql",
    "20260124_fix_audit_trigger.sql",
    "20260124_fix_trip_mirroring.sql",
    "20260124_fix_types_and_immutability.sql",
    "20260124_fix_undo_and_mirroring_final.sql",
    "20260124_force_full_resync.sql",
    "20260124_hotfix_bridge_types.sql",
    "20260124_hotfix_domain_consistency.sql",
    "20260124_hotfix_family_rpc.sql",
    "20260124_hotfix_resync_ptbr.sql",
    "20260124_hotfix_rpc_signature.sql",
    "20260124_hotfix_rpc_types.sql",
    "20260124_omnibus_repair.sql",
    "20260124_phase5_controlled_drop.sql",
    "20260124_restore_mirroring.sql",
    "20260124_soft_delete_handler.sql",
    "20260124_step1_freeze.sql",
    "20260124_step2_audit.sql",
    "20260124_step3_infra.sql",
    "20260124_step4_replay.sql",
    "20260124_step5_snapshot_zero.sql",
    "20260124_step7_cleanup.sql",
    "20260124_step8_observability.sql",
    "20260124_trip_rpcs.sql",
    "20260124_unfreeze_system.sql",
    "20260125_fix_mirror_currency.sql",
    "20260126_fix_rpc_signature.sql"
)

$migrationsPath = "supabase\migrations"
$archivedCount = 0

Write-Host "Movendo migrations para arquivo..." -ForegroundColor Yellow
foreach ($migration in $migrationsToArchive) {
    $sourcePath = Join-Path $migrationsPath $migration
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $archiveDir $migration
        Move-Item $sourcePath $destPath -ErrorAction SilentlyContinue
        Write-Host "  OK Arquivado: $migration" -ForegroundColor Green
        $archivedCount++
    }
}

Write-Host ""
Write-Host "$archivedCount migrations arquivadas em: $archiveDir" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - Essas migrations JA FORAM APLICADAS no banco" -ForegroundColor Gray
Write-Host "   - Nao delete do banco, apenas arquive no sistema de arquivos" -ForegroundColor Gray
Write-Host "   - Mantenha apenas migrations essenciais na pasta principal" -ForegroundColor Gray
