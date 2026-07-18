const fs = require('fs');
const file = '/Users/akashyadav/Desktop/wp/wacrm/src/app/api/whatsapp/webhook/route.ts';
let content = fs.readFileSync(file, 'utf8');

// The replacement was messed up, so we will do it manually.
// First let's get the original file back from git
require('child_process').execSync('git checkout -- ' + file, {cwd: '/Users/akashyadav/Desktop/wp/wacrm/'});

content = fs.readFileSync(file, 'utf8');

// Replace the console.error block safely
content = content.replace(
  /if \(status\.status === 'failed' && status\.errors\?\.length\) \{[\s\S]*?\}/,
  `if (status.status === 'failed' && status.errors?.length) {
    const err = status.errors[0];
    const errMsg = \`[META ERROR] \${err.code} - \${err.title}: \${err.error_data?.details ?? err.message ?? ''}\`;
    
    // Fire and forget updating the DB with context message
    supabase.from('messages')
      .update({ 
        status: 'failed', 
        context_message: errMsg,
        updated_at: new Date().toISOString()
      })
      .eq('message_id', status.id)
      .then(() => console.log('Updated failure in DB', errMsg))
      .catch(e => console.error('Error updating DB', e));
      
    console.error(\`Webhook failed for wamid=\${status.id}. Error: \${errMsg}\`);
  }`
);

fs.writeFileSync(file, content);
console.log('Fixed route.ts successfully');
