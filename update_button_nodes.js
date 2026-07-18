const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://bsoafrgiazduuicvpxel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzb2FmcmdpYXpkdXVpY3ZweGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI3NTk5NiwiZXhwIjoyMDk3ODUxOTk2fQ.CZ2QkVKMbhmJfkfAnWYQKukdgmkv5XksPw1AKW48YwY'
);

const FLOW_ID = 'd55fc1e2-36e1-4364-a095-d31333ab74fd';

// Important Media URLs
const IMG_CATALOG = 'https://amicasmartlearn.com/wp-content/uploads/2025/05/b79d96b9addc4d69b3bcbb85ec7278c3-1024x550.png';
const PDF_EVOTA = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/pdfs/1784113218356-evota-ifpd.pdf';
const PDF_TEACHMINT = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/pdfs/1784113220368-teachmint-ifpd.pdf';
const PDF_MAXHUB = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/pdfs/1784113223266-maxhub-ifpd.pdf';
const PDF_BRIO = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/pdfs/1784113221564-brio-ifpd.pdf';
const INFO_PDF_URL = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/4e54249c-05e4-4738-ab28-7dcfdddb4310/1784027516523-mukhyamantri-yojana-info.pdf';
const LOAN_PDF_URL = 'https://bsoafrgiazduuicvpxel.supabase.co/storage/v1/object/public/flow-media/4e54249c-05e4-4738-ab28-7dcfdddb4310/1784027518985-loan-required-documents.pdf';

async function updateNodes() {
  await supabase.from('flow_nodes').delete().eq('flow_id', FLOW_ID);

  const nodes = [
    { flow_id: FLOW_ID, node_key: 'start', node_type: 'start', config: { next_node_key: 'welcome' } },
    
    { flow_id: FLOW_ID, node_key: 'welcome', node_type: 'send_message', config: {
      text: '*Amica Smart Learn* में आपका स्वागत है।\n\nहम आपके Digital Business को एक नई ऊँचाई पर ले जाने के लिए Complete Setup Solutions देते हैं।\n\nआगे बढ़ने के लिए, कृपया अपना *पूरा नाम* लिखें:',
      next_node_key: 'ask_name'
    }},
    { flow_id: FLOW_ID, node_key: 'ask_name', node_type: 'collect_input', config: {
      var_key: 'customer_name', prompt_text: 'आपका पूरा नाम क्या है?', next_node_key: 'ask_location_btn'
    }},
    
    { flow_id: FLOW_ID, node_key: 'ask_location_btn', node_type: 'send_buttons', config: {
      var_key: 'customer_location',
      body: '{{vars.customer_name}} जी, आप किस शहर से हैं?',
      buttons: [
        { reply_id: 'btn_dehradun', title: 'Dehradun', next_node_key: 'ask_setup_type_btn' },
        { reply_id: 'btn_lucknow', title: 'Lucknow', next_node_key: 'ask_setup_type_btn' },
        { reply_id: 'btn_other_loc', title: 'Other', next_node_key: 'ask_location_other' }
      ]
    }},
    
    { flow_id: FLOW_ID, node_key: 'ask_location_other', node_type: 'collect_input', config: {
      var_key: 'customer_location',
      prompt_text: 'कृपया अपने शहर का नाम टाइप करें:',
      next_node_key: 'ask_setup_type_btn'
    }},
    
    { flow_id: FLOW_ID, node_key: 'ask_setup_type_btn', node_type: 'send_buttons', config: {
      var_key: 'setup_type',
      body: 'आपको मुख्य रूप से किस प्रकार का Setup चाहिए?',
      buttons: [
        { reply_id: 'btn_digital_studio', title: 'Digital Studio', next_node_key: 'product_showcase' },
        { reply_id: 'btn_podcast_studio', title: 'Podcast Studio', next_node_key: 'product_showcase' },
        { reply_id: 'btn_other_setup', title: 'Other', next_node_key: 'ask_setup_type_other' }
      ]
    }},
    
    { flow_id: FLOW_ID, node_key: 'ask_setup_type_other', node_type: 'collect_input', config: {
      var_key: 'setup_type',
      prompt_text: 'कृपया अपनी requirement टाइप करें (जैसे: Sirf Camera chahiye):',
      next_node_key: 'product_showcase'
    }},

    { flow_id: FLOW_ID, node_key: 'product_showcase', node_type: 'send_media', config: {
      media_type: 'image',
      media_url: IMG_CATALOG,
      caption: '_हमारे पास Brio Touch, Maxhub, Teachmint, Evota और Aaztec जैसे Top Brands उपलब्ध हैं।_',
      next_node_key: 'ask_catalog_btn'
    }},

    { flow_id: FLOW_ID, node_key: 'ask_catalog_btn', node_type: 'send_buttons', config: {
      var_key: 'wants_catalog',
      body: 'क्या आप हमारे Top Interactive Flat Panels और Cameras का Catalog (PDF) देखना चाहेंगे?',
      buttons: [
        { reply_id: 'btn_catalog_yes', title: 'Yes (हाँ)', next_node_key: 'send_pdf_1' },
        { reply_id: 'btn_catalog_no', title: 'No (नहीं)', next_node_key: 'ask_loan_or_cash_btn' }
      ]
    }},

    { flow_id: FLOW_ID, node_key: 'send_pdf_1', node_type: 'send_media', config: {
      media_type: 'document', media_url: PDF_EVOTA, caption: 'Evota Interactive Flat Panel', next_node_key: 'send_pdf_2'
    }},
    { flow_id: FLOW_ID, node_key: 'send_pdf_2', node_type: 'send_media', config: {
      media_type: 'document', media_url: PDF_TEACHMINT, caption: 'Teachmint Interactive Panel', next_node_key: 'send_pdf_3'
    }},
    { flow_id: FLOW_ID, node_key: 'send_pdf_3', node_type: 'send_media', config: {
      media_type: 'document', media_url: PDF_MAXHUB, caption: 'Maxhub IFPD Catalog', next_node_key: 'send_pdf_4'
    }},
    { flow_id: FLOW_ID, node_key: 'send_pdf_4', node_type: 'send_media', config: {
      media_type: 'document', media_url: PDF_BRIO, caption: 'Brio Touch Catalog', next_node_key: 'ask_loan_or_cash_btn'
    }},

    { flow_id: FLOW_ID, node_key: 'ask_loan_or_cash_btn', node_type: 'send_buttons', config: {
      var_key: 'payment_type',
      body: 'Setup के लिए आप Cash payment करेंगे या Loan लेंगे?',
      buttons: [
        { reply_id: 'btn_pay_cash', title: 'Cash', next_node_key: 'thanks_cash' },
        { reply_id: 'btn_pay_loan', title: 'Loan', next_node_key: 'send_info_pdf' }
      ]
    }},

    { flow_id: FLOW_ID, node_key: 'thanks_cash', node_type: 'send_message', config: {
      text: 'धन्यवाद {{vars.customer_name}} जी!\n\nआपकी requirement हमारी Team के पास पहुँच गई है। हमारे Experts जल्द ही आपको Call करेंगे।\n\n📞 +91 78309 03663\n🌐 www.amicasmartlearn.com',
      next_node_key: 'end'
    }},
    
    { flow_id: FLOW_ID, node_key: 'send_info_pdf', node_type: 'send_media', config: {
      media_type: 'document',
      media_url: INFO_PDF_URL,
      caption: 'मुख्यमंत्री युवा उद्यमी विकास अभियान\nइस PDF में सरकारी योजना की पूरी जानकारी है।',
      next_node_key: 'send_loan_docs'
    }},
    { flow_id: FLOW_ID, node_key: 'send_loan_docs', node_type: 'send_media', config: {
      media_type: 'document',
      media_url: LOAN_PDF_URL,
      caption: 'Loan के लिए जरूरी Documents\nइन सभी दस्तावेजों को तैयार करके हमसे संपर्क करें।',
      next_node_key: 'loan_final_msg'
    }},
    { flow_id: FLOW_ID, node_key: 'loan_final_msg', node_type: 'send_message', config: {
      text: '{{vars.customer_name}} जी, Documents तैयार होने पर हमें कॉल करें:\n\n📞 +91 78309 03663\n🌐 www.amicasmartlearn.com',
      next_node_key: 'end'
    }},
    { flow_id: FLOW_ID, node_key: 'end', node_type: 'end', config: {} }
  ];

  const { error } = await supabase.from('flow_nodes').insert(nodes);
  if (error) console.error('Insert Error:', error);
  else console.log('✅ Updated all nodes to use buttons and formatting!');
}
updateNodes();
