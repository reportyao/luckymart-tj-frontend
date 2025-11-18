import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://owyitxwxmxwbkqgzffdw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQyMzg1MywiZXhwIjoyMDc3OTk5ODUzfQ.Yqu0OluUMtVC73H_bHC6nCqEtjllzhz2HfltbffF_HA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('🔍 检查数据库表结构...\n');

  const tables = ['profiles', 'users', 'lotteries', 'orders', 'deposit_requests', 'withdrawal_requests', 'showoff_posts'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ 表 '${table}' 不存在或无法访问: ${error.message}`);
    } else {
      console.log(`✅ 表 '${table}' 存在，示例数据:`, data);
    }
  }
}

checkSchema();
