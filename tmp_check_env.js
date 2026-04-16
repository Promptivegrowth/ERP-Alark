const { Client } = require('pg');
const fs = require('fs');

// Supabase Postgres connection
// Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
// We need the DB password - it's different from the service role key
// Let's read from env and try the db URL format Supabase uses

const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

// Check for DATABASE_URL or POSTGRES_URL
const dbUrl = envConfig.DATABASE_URL || envConfig.POSTGRES_URL || envConfig.SUPABASE_DB_URL;
if (dbUrl) {
    console.log('Found DB URL:', dbUrl.substring(0, 40) + '...');
} else {
    console.log('No DATABASE_URL found. Available keys:', Object.keys(envConfig).join(', '));
}
