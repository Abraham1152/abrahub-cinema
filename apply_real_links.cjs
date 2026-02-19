const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applyRealLinks() {
  console.log('Aplicando links reais de camera...');

  const realLinks = [
    { k: 'anamorphic-film', url: 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images/camera/anamorphic-film.png' },
    { k: 'arri-natural', url: 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images/camera/arri-natural.jpg' },
    { k: 'documentary-street', url: 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images/camera/documentary-street.jpg' },
    { k: 'red-commercial', url: 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images/camera/red-commercial.jpg' },
    { k: 'sony-venice-night', url: 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images/camera/sony-venice-night.jpg' }
  ];

  for (const item of realLinks) {
    await supabase
      .from('preset_configs')
      .update({ preview_image_url: item.url })
      .eq('preset_key', item.k)
      .eq('preset_type', 'camera');
  }

  console.log('✅ Links reais aplicados com sucesso!');
}

applyRealLinks();
