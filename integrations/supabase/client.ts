import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scXplaWh1a2V6bG96b29xaGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NDUzNTIsImV4cCI6MjA3ODUyMTM1Mn0.a5c7KqOcW3PVG8HpSoRXXkTX2x1ziHlTW0fmlatWGZg';

export const supabase = createClient(supabaseUrl, supabaseKey);