const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixPresetImages() {
  console.log('Iniciando correcao de URLs dos presets...');

  const baseStorage = 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images';

  // 1. Focal Lengths
  const focalUpdates = [
    { key: '14mm', file: 'focal/14mm.png' },
    { key: '24mm', file: 'focal/24mm.jpg' },
    { key: '35mm', file: 'focal/35mm.jpg' },
    { key: '50mm', file: 'focal/50mm.png' },
    { key: '85mm', file: 'focal/85mm.png' },
    { key: '135mm', file: 'focal/135mm.png' },
  ];

  for (const item of focalUpdates) {
    await supabase.from('preset_configs').update({ preview_image_url: `${baseStorage}/${item.file}` }).eq('preset_key', item.key).eq('preset_type', 'focal_length');
  }

  // 2. Angles
  const angleKeys = ['eye-level', 'low-angle', 'high-angle', 'dutch-angle', 'birds-eye', 'worms-eye', 'over-shoulder', 'pov', 'close-up', 'wide-shot'];
  for (const key of angleKeys) {
    const ext = key === 'over-shoulder' ? 'png' : 'jpg';
    await supabase.from('preset_configs').update({ preview_image_url: `${baseStorage}/angle/${key}.${ext}` }).eq('preset_key', key).eq('preset_type', 'camera_angle');
  }

  // 3. Film Looks
  const filmLooks = ['blade-runner-2049', 'grand-budapest-hotel', 'the-matrix', 'sin-city', 'amelie', 'mad-max-fury-road', 'moonlight', 'her', 'drive', 'the-revenant', 'joker', 'la-la-land', 'dune-2021', 'midsommar', 'the-neon-demon', 'in-the-mood-for-love', 'the-lighthouse', 'akira', 'barbie', 'suspiria'];
  for (const key of filmLooks) {
    await supabase.from('preset_configs').update({ preview_image_url: `${baseStorage}/film_look/${key}.jpg` }).eq('preset_key', key).eq('preset_type', 'film_look');
  }

  // 4. Main Camera Presets
  const cameraPresets = [
    { key: 'arri-natural', file: 'presets/preset-arri.jpg' },
    { key: 'red-commercial', file: 'presets/preset-red.jpg' },
    { key: 'sony-venice-night', file: 'presets/preset-sony.jpg' },
    { key: 'anamorphic-film', file: 'presets/preset-anamorphic.jpg' },
    { key: 'documentary-street', file: 'presets/preset-documentary.jpg' },
  ];
  for (const item of cameraPresets) {
    await supabase.from('preset_configs').update({ preview_image_url: `${baseStorage}/${item.file}` }).eq('preset_key', item.key).eq('preset_type', 'camera');
  }

  console.log('Todas as 47 URLs foram corrigidas no banco de dados!');
}

fixPresetImages();
