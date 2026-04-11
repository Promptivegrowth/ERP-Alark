const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eXFqaHBpc2tva2h0dXVxbHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM4Mzc2OSwiZXhwIjoyMDg5OTU5NzY5fQ.4vZogebrvPbkdO5AIgkeJaS2ForGLUWpRy4Z7k4QjZM';
const SUPABASE_URL = 'https://zuyqjhpiskokhtuuqltu.supabase.co';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const mappings = [
    { old: 'comedor.totttuscdf@almarkperu.com', new: 'comedor.tottuscdf@almarkperu.com' },
    { old: 'comedor.totttuscds@almarkperu.com', new: 'comedor.tottuscds@almarkperu.com' },
    { old: 'comedor.totttusppa@almarkperu.com', new: 'comedor.tottusppa@almarkperu.com' }
];

async function fixTypos() {
    console.log('--- Fixing Tottus Email Typos ---');

    // 1. Get all users to find their IDs
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error listing users:', authError.message);
        return;
    }

    for (const mapping of mappings) {
        const user = authUsers.users.find(u => u.email === mapping.old);
        if (user) {
            console.log(`Processing user: ${mapping.old} (ID: ${user.id})`);

            // Update Auth
            const { error: updateAuthError } = await supabase.auth.admin.updateUserById(user.id, {
                email: mapping.new,
                email_confirm: true // Ensure it stays confirmed
            });

            if (updateAuthError) {
                console.error(`Error updating Auth for ${mapping.old}:`, updateAuthError.message);
            } else {
                console.log(`Auth updated: ${mapping.old} -> ${mapping.new}`);

                // Update Public Profiles
                const { error: updateProfileError } = await supabase
                    .from('usuarios')
                    .update({ email: mapping.new })
                    .eq('id', user.id);

                if (updateProfileError) {
                    console.error(`Error updating Profile for ${user.id}:`, updateProfileError.message);
                } else {
                    console.log(`Profile updated for ${user.id}`);
                }
            }
        } else {
            console.log(`User ${mapping.old} not found in Auth.`);
        }
    }
    console.log('--- Finished Fixing Typos ---');
}

fixTypos();
