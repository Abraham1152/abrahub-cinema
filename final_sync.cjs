const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncAllImages() {
  console.log('Sincronizando imagens com o novo Storage...');

  const BASE_URL = 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images';

  // 1. Focal Length (focal/14mm.png, etc)
  const focal = [
    { k: '14mm', f: 'focal/14mm.png' }, { k: '24mm', f: 'focal/24mm.jpg' },
    { k: '35mm', f: 'focal/35mm.jpg' }, { k: '50mm', f: 'focal/50mm.png' },
    { k: '85mm', f: 'focal/85mm.png' }, { k: '135mm', f: 'focal/135mm.png' }
  ];
  for (const item of focal) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_URL}/${item.f}` }).eq('preset_key', item.k).eq('preset_type', 'focal_length');
  }

  // 2. Angles (angle/eye-level.jpg, etc)
  const angles = ['eye-level', 'low-angle', 'high-angle', 'dutch-angle', 'birds-eye', 'worms-eye', 'over-shoulder', 'pov', 'close-up', 'wide-shot'];
  for (const a of angles) {
    const ext = a === 'over-shoulder' ? 'png' : 'jpg';
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_URL}/angle/${a}.${ext}` }).eq('preset_key', a).eq('preset_type', 'camera_angle');
  }

  // 3. Film Looks (film_look/blade-runner-2049.jpg, etc)
  const looks = ['blade-runner-2049', 'grand-budapest-hotel', 'the-matrix', 'sin-city', 'amelie', 'mad-max-fury-road', 'moonlight', 'her', 'drive', 'the-revenant', 'joker', 'la-la-land', 'dune-2021', 'midsommar', 'the-neon-demon', 'in-the-mood-for-love', 'the-lighthouse', 'akira', 'barbie', 'suspiria'];
  for (const l of looks) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_URL}/film_look/${l}.jpg` }).eq('preset_key', l).eq('preset_type', 'film_look');
  }

  // 4. Camera Presets (presets/preset-arri.jpg, etc)
  const cameras = [
    { k: 'arri-natural', f: 'presets/preset-arri.jpg' },
    { k: 'red-commercial', f: 'presets/preset-red.jpg' },
    { k: 'sony-venice-night', f: 'presets/preset-sony.jpg' },
    { k: 'anamorphic-film', f: 'presets/preset-anamorphic.jpg' },
    { k: 'documentary-street', f: 'presets/preset-documentary.jpg' }
  ];
  for (const c of cameras) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_URL}/${c.f}` }).eq('preset_key', c.k).eq('preset_type', 'camera');
  }

  console.log('✅ Sincronização concluída! As imagens agora devem aparecer no site.');
}

syncAllImages();
