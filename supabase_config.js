// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://sevgucikdjtluhlfgaha.supabase.co'; // e.g., 'https://xxxxxxxxxxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldmd1Y2lrZGp0bHVobGZnYWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDIzOTQsImV4cCI6MjA3NTQ3ODM5NH0.JzXQL2GJfdPPIwk83A6hSmDEu5wbjgNtA2E12OE-8cE'; // Your public anon key from Supabase dashboard

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY };
}