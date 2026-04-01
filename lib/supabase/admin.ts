import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// This client uses the SERVICE_ROLE_KEY to bypass RLS.
// ONLY USE ON THE SERVER.
export function createAdminClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
