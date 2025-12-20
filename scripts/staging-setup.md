# Staging Environment Setup

## Overview
Este documento descreve como configurar um ambiente de staging idêntico ao produção para testar a reestruturação com segurança.

## Prerequisites
- Acesso ao Supabase Dashboard
- Node.js e npm/pnpm instalados
- Git configurado

## Step 1: Create Staging Database

### Option A: Supabase Dashboard
1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Crie novo projeto: "pe-de-meia-staging"
3. Anote as credenciais (URL e anon key)

### Option B: Supabase CLI (Recommended)
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Initialize local development
supabase init

# Start local Supabase (Docker required)
supabase start

# This will give you local URLs for testing
```

## Step 2: Environment Configuration

### Create staging environment file
```bash
# Copy production env
cp .env.local .env.staging

# Edit .env.staging with staging credentials
# VITE_SUPABASE_URL=your-staging-url
# VITE_SUPABASE_ANON_KEY=your-staging-anon-key
```

### Update package.json scripts
```json
{
  "scripts": {
    "dev:staging": "vite --mode staging",
    "build:staging": "vite build --mode staging"
  }
}
```

## Step 3: Database Migration to Staging

### Copy production schema
```sql
-- Run this in production to export schema
pg_dump --schema-only --no-owner --no-privileges your_prod_db > schema.sql

-- Run this in staging to import schema
psql your_staging_db < schema.sql
```

### Copy sample data (optional)
```sql
-- Export sample data (limit to avoid large datasets)
pg_dump --data-only --no-owner --no-privileges \
  --where="created_at > NOW() - INTERVAL '30 days'" \
  your_prod_db > sample_data.sql

-- Import to staging
psql your_staging_db < sample_data.sql
```

## Step 4: Frontend Configuration

### Create staging configuration
```typescript
// src/config/staging.ts
export const stagingConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL_STAGING,
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY_STAGING,
  environment: 'staging',
  debugMode: true
};
```

### Update Supabase client for staging
```typescript
// src/integrations/supabase/client.staging.ts
import { createClient } from '@supabase/supabase-js';
import { stagingConfig } from '../config/staging';

export const supabaseStaging = createClient(
  stagingConfig.supabaseUrl,
  stagingConfig.supabaseKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);
```

## Step 5: Testing Procedures

### Automated Tests
```bash
# Run tests against staging
npm run test -- --env=staging

# Run integration tests
npm run test:integration -- --env=staging
```

### Manual Testing Checklist
- [ ] User authentication works
- [ ] Dashboard loads correctly
- [ ] Can create/edit/delete transactions
- [ ] Account balances are correct
- [ ] Shared transactions work
- [ ] Month navigation works
- [ ] Charts display properly

## Step 6: Deployment Pipeline

### Staging deployment
```bash
# Build for staging
npm run build:staging

# Deploy to staging environment
# (Configure your preferred deployment method)
```

### Continuous Integration
```yaml
# .github/workflows/staging.yml
name: Staging Deployment
on:
  push:
    branches: [staging]
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test
      - name: Build staging
        run: npm run build:staging
      - name: Deploy to staging
        run: # Your deployment command
```

## Safety Guidelines

### Before Testing Changes
1. **Always backup staging database**
2. **Document current state**
3. **Prepare rollback plan**

### During Testing
1. **Test one change at a time**
2. **Validate data integrity after each change**
3. **Monitor for errors and performance issues**

### After Testing
1. **Document results**
2. **Update procedures if needed**
3. **Plan production deployment**

## Troubleshooting

### Common Issues
- **Environment variables not loading**: Check .env.staging file
- **Database connection fails**: Verify Supabase credentials
- **Migration errors**: Check for schema differences
- **Authentication issues**: Verify auth configuration

### Debug Mode
```typescript
// Enable debug logging in staging
if (import.meta.env.MODE === 'staging') {
  console.log('Staging mode enabled');
  // Add debug logging
}
```