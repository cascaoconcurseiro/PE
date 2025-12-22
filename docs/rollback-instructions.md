# Rollback Instructions

## Emergency Rollback Procedure

### If System Becomes Unstable
1. **Stop all operations immediately**
2. **Assess the damage**
3. **Choose appropriate rollback level**
4. **Execute rollback**
5. **Validate system integrity**

## Rollback Levels

### Level 1: Frontend Only Rollback
If only frontend changes are problematic:
```bash
# Revert to previous commit
git checkout HEAD~1 -- src/

# Or restore specific files
git checkout HEAD~1 -- src/hooks/useDataStore.ts
```

### Level 2: Database Schema Rollback
If new tables/columns are problematic but data is intact:
```sql
-- Drop new tables (safe if no critical data)
DROP TABLE IF EXISTS transaction_splits;
DROP TABLE IF EXISTS new_table_name;

-- Remove new columns (safe if no critical data)
ALTER TABLE accounts DROP COLUMN IF EXISTS new_column_name;
```

### Level 3: Complete Database Restore
**ONLY if data corruption is detected:**
```sql
-- Restore from backup schema
TRUNCATE accounts;
INSERT INTO accounts SELECT * FROM backup_pre_restructure.accounts;

TRUNCATE transactions;
INSERT INTO transactions SELECT * FROM backup_pre_restructure.transactions;

-- Repeat for all tables...
```

### Level 4: Full System Restore
**NUCLEAR OPTION - Only if everything is broken:**
1. Restore database from external backup
2. Revert git to last known good commit
3. Redeploy application

## Validation After Rollback

### Data Integrity Checks
```sql
-- Check account balances
SELECT account_id, COUNT(*) as tx_count, SUM(amount) as calculated_balance
FROM transactions 
WHERE NOT deleted 
GROUP BY account_id;

-- Check for orphaned records
SELECT * FROM transactions WHERE account_id NOT IN (SELECT id FROM accounts);

-- Validate family member references
SELECT * FROM transactions WHERE payer_id NOT IN (SELECT id FROM family_members);
```

### Frontend Functionality Tests
- [ ] Login/logout works
- [ ] Dashboard loads without errors
- [ ] Can create new transaction
- [ ] Can edit existing transaction
- [ ] Can delete transaction
- [ ] Month navigation works
- [ ] Charts display correctly

## Post-Rollback Actions
1. **Document what went wrong**
2. **Update rollback procedures if needed**
3. **Plan safer approach for next attempt**
4. **Test fix in staging environment first**

## Emergency Contacts
- **Database Admin**: [Your contact]
- **Lead Developer**: [Your contact]
- **System Admin**: [Your contact]