# Local Database Setup

If you want to test the system locally while we resolve the Supabase connection, you can:

## Option 1: Install PostgreSQL locally

1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install with these settings:
   - Username: `postgres` 
   - Password: `password`
   - Port: `5432`
3. Create database: `CREATE DATABASE uppal_crm;`
4. Use `.env.local` configuration

## Option 2: Use Docker

```bash
docker run --name uppal-crm-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=uppal_crm -p 5432:5432 -d postgres:13
```

## Option 3: Fix Supabase Connection

Please verify your project reference ID:
1. Go to Supabase Dashboard
2. Settings → Database
3. Copy exact connection string

Expected format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

Your current ref: `smzamnifaboqkjulrtqj` (check if this is correct)