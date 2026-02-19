const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixPaths() {
  const BASE = 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images';
  
  console.log('Corrigindo Focal Lengths...');
  const focal = [
    { k: '14mm', f: 'focal/14mm.png' }, { k: '24mm', f: 'focal/24mm.jpg' },
    { k: '35mm', f: 'focal/35mm.jpg' }, { k: '50mm', f: 'focal/50mm.png' },
    { k: '85mm', f: 'focal/85mm.png' }, { k: '135mm', f: 'focal/135mm.png' }
  ];
  for (const item of focal) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE}/${item.f}` }).eq('preset_key', item.k).eq('preset_type', 'focal_length');
  }

  console.log('Corrigindo Angles...');
  const angles = ['eye-level', 'low-angle', 'high-angle', 'dutch-angle', 'birds-eye', 'worms-eye', 'over-shoulder', 'pov', 'close-up', 'wide-shot'];
  for (const a of angles) {
    const ext = a === 'over-shoulder' ? 'png' : 'jpg';
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE}/angle/${a}.${ext}` }).eq('preset_key', a).eq('preset_type', 'camera_angle');
  }

  console.log('Sincronizacao concluida!');
}

fixPaths();
