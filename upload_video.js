const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://bsoafrgiazduuicvpxel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb2FmcmdpYXpkdXVpY3ZweGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI3NTk5NiwiZXhwIjoyMDk3ODUxOTk2fQ.CZ2QkVKMbhmJfkfAnWYQKukdgmkv5XksPw1AKW48YwY'
);

async function uploadVideo() {
  const filePath = '/Users/akashyadav/Downloads/WhatsApp Video 2026-07-15 at 17.26.46.mp4';
  const fileName = `testimonial-${Date.now()}.mp4`;

  console.log('Uploading video... (96 MB, may take a minute)');
  const fileData = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from('flow-media')
    .upload(`videos/${fileName}`, fileData, {
      contentType: 'video/mp4',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
  } else {
    const { data: urlData } = supabase.storage.from('flow-media').getPublicUrl(`videos/${fileName}`);
    console.log('Video URL:', urlData.publicUrl);
  }
}
uploadVideo();
