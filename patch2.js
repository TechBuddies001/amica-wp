const fs = require('fs');
const file = '/Users/akashyadav/Desktop/wp/wacrm/src/app/api/whatsapp/webhook/route.ts';
let content = fs.readFileSync(file, 'utf8');

// I need to change:
// async function handleStatusUpdate(status: {
// to:
// async function handleStatusUpdate(status: { ... errors?: any[] }) {

// And update the `update({ status: status.status })` part

const newFunc = `async function handleStatusUpdate(status: {
  id: string
  status: string
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string; message: string; error_data?: { details: string } }>
}) {
  let updateObj: any = { status: status.status }
  if (status.status === 'failed' && status.errors && status.errors.length > 0) {
    const err = status.errors[0];
    const errMsg = \`[Meta Error \${err.code}] \${err.title || ''}: \${err.message || ''} \${err.error_data?.details || ''}\`;
    updateObj.content_text = errMsg;
  }

  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update(updateObj)
    .eq('message_id', status.id)
`;

content = content.replace(
  /async function handleStatusUpdate\(status: \{\n  id: string\n  status: string\n  timestamp: string\n  recipient_id: string\n\}\) \{\n  \/\/ 1\) Mirror onto messages.*?\.eq\('message_id', status\.id\)/s,
  newFunc
);

fs.writeFileSync(file, content);
console.log('Patched properly!');
