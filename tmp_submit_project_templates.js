const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const crypto = require('crypto');

const supabase = createClient(
  'https://bsoafrgiazduuicvpxel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb2FmcmdpYXpkdXVpY3ZweGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI3NTk5NiwiZXhwIjoyMDk3ODUxOTk2fQ.CZ2QkVKMbhmJfkfAnWYQKukdgmkv5XksPw1AKW48YwY'
);

const KEY = 'fd27c5023b837e070ebde4fc27c372dca90fe2195404d14cfd294664af48e353';

function decryptToken(enc) {
  const parts = enc.split(':');
  const dec = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KEY,'hex'), Buffer.from(parts[0],'hex'));
  dec.setAuthTag(Buffer.from(parts[2],'hex'));
  let tok = dec.update(parts[1],'hex','utf8'); tok += dec.final('utf8');
  return tok;
}

function postJson(url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Meta requires: NO variable at start, NO variable at end
// Also "— Team {{5}}" at end counts as ending with variable → not allowed
const templates = [
  {
    name: 'project_created',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Greetings {{1}}! A new project has been created.\n\n📁 Project: {{2}}\n🗓️ Start Date: {{3}}\n🏢 Client: {{4}}\n\nPlease log in to your client portal to view the full project details and next steps.',
        example: {
          body_text: [['John', 'Website Redesign', '10 Jul 2025', 'Amica Corp']]
        }
      }
    ]
  },
  {
    name: 'project_updated',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Project update notification! Your project {{1}} has been updated.\n\n📋 Change: {{2}}\n\nPlease log in to your client portal to review the latest details.',
        example: {
          body_text: [['Website Redesign', 'Timeline has been revised to accommodate client feedback']]
        }
      }
    ]
  }
];

async function run() {
  const {data} = await supabase.from('whatsapp_config').select('waba_id, access_token').single();
  const wabaId = data.waba_id;
  const token = decryptToken(data.access_token);

  for (const tmpl of templates) {
    console.log('\nSubmitting:', tmpl.name, '...');
    const res = await postJson(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      tmpl,
      token
    );
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.body));
  }
}

run().catch(console.error);
