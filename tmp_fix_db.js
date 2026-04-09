
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zuyqjhpiskokhtuuqltu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eXFqaHBpc2tva2h0dXVxbHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM4Mzc2OSwiZXhwIjoyMDg5OTU5NzY5fQ.4vZogebrvPbkdO5AIgkeJaS2ForGLUWpRy4Z7k4QjZM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('Running migration...');
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: 'ALTER TABLE comedor_campos_reporte ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0;'
    });

    if (error) {
        if (error.message.includes('function "execute_sql" does not exist')) {
            console.log('RPC execute_sql not found. This is expected if it was not pre-created.');
            console.log('Trying alternative: updating code to be defensive since I cannot run DDL directly without a proper tool.');
        } else {
            console.error('Error:', error);
        }
    } else {
        console.log('Migration successful!');
    }
}

runMigration();
