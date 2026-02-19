const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixCameraPaths() {
  console.log('Corrigindo caminhos da pasta /camera/ no Storage...');

  const BASE_URL = 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images';

  const cameras = [
    { k: 'arri-natural', f: 'camera/preset-arri.jpg' },
    { k: 'red-commercial', f: 'camera/preset-red.jpg' },
    { k: 'sony-venice-night', f: 'camera/preset-sony.jpg' },
    { k: 'anamorphic-film', f: 'camera/preset-anamorphic.jpg' },
    { k: 'documentary-street', f: 'camera/preset-documentary.jpg' }
  ];

  for (const item of cameras) {
    const { error } = await supabase
      .from('preset_configs')
      .update({ preview_image_url: `${BASE_URL}/${item.f}` })
      .eq('preset_key', item.k)
      .eq('preset_type', 'camera');
    
    if (error) console.error(`Erro ao atualizar ${item.k}:`, error.message);
  }

  console.log('✅ Caminhos das câmeras corrigidos!');
}

fixCameraPaths();
