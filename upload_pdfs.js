const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://bsoafrgiazduuicvpxel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb2FmcmdpYXpkdXVpY3ZweGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI3NTk5NiwiZXhwIjoyMDk3ODUxOTk2fQ.CZ2QkVKMbhmJfkfAnWYQKukdgmkv5XksPw1AKW48YwY'
);

const files = [
  { path: '/Users/akashyadav/Downloads/75 (octa core).pdf', name: 'evota-ifpd.pdf' },
  { path: '/Users/akashyadav/Downloads/75-20Star-SpecSheet-compressed.pdf.pdf', name: 'teachmint-ifpd.pdf' },
  { path: '/Users/akashyadav/Downloads/amica pdf 2026 (1).pdf', name: 'brio-ifpd.pdf' },
  { path: '/Users/akashyadav/Downloads/DOC-20250216-WA0003..pdf.pdf', name: 'maxhub-ifpd.pdf' },
  { path: '/Users/akashyadav/Downloads/EKIN 1130 UP.pdf.pdf', name: 'ekin-camera.pdf' },
  { path: '/Users/akashyadav/Downloads/IFPD.V100.pdf', name: 'aaztec-ifpd.pdf' }
];

async function uploadFiles() {
  const urls = {};
  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      console.log(`Missing file: ${file.path}`);
      continue;
    }
    const fileData = fs.readFileSync(file.path);
    const fileName = `${Date.now()}-${file.name}`;
    console.log(`Uploading ${fileName}...`);
    
    const { data, error } = await supabase.storage
      .from('flow-media')
      .upload(`pdfs/${fileName}`, fileData, {
        contentType: 'application/pdf',
        upsert: false
      });
      
    if (error) {
      console.error(`Error uploading ${file.name}:`, error);
    } else {
      const { data: publicUrlData } = supabase.storage.from('flow-media').getPublicUrl(`pdfs/${fileName}`);
      urls[file.name] = publicUrlData.publicUrl;
      console.log(`Uploaded ${file.name} -> ${publicUrlData.publicUrl}`);
    }
  }
  
  fs.writeFileSync('uploaded_urls.json', JSON.stringify(urls, null, 2));
  console.log('Saved URLs to uploaded_urls.json');
}

uploadFiles();
