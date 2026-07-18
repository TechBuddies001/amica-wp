const fs = require('fs');
const file = '/Users/akashyadav/Desktop/wp/wacrm/src/app/api/whatsapp/webhook/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace the console.error block with DB update
content = content.replace(
  /if \(status\.status === 'failed' && status\.errors\?\.length\) \{[\s\S]*?\}/,
  `if (status.status === 'failed' && status.errors?.length) {
    const err = status.errors[0];
    const errMsg = \`[META ERROR] \${err.code} - \${err.title}: \${err.error_data?.details ?? err.message ?? ''}\`;
    
    // Update Supabase with the exact error message in a new column or just overwrite context_message
    await supabase.from('messages')
      .update({ 
        status: 'failed', 
        context_message: errMsg,
        updated_at: new Date().toISOString()
      })
      .eq('message_id', status.id);
      
    console.error(\`Webhook failed for wamid=\${status.id}. Error: \${errMsg}\`);
  }`
);

fs.writeFileSync(file, content);
console.log('Updated route.ts successfully');
