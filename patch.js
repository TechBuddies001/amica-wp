const fs = require('fs');
const file = '/Users/akashyadav/Desktop/wp/wacrm/src/app/api/whatsapp/webhook/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace context_message with content_text to avoid missing column error
content = content.replace(/context_message: errMsg/g, "content_text: errMsg");
fs.writeFileSync(file, content);
console.log('Patched!');
