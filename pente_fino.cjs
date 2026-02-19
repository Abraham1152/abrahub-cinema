const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function masterFix() {
  console.log('Iniciando Pente Fino e Reconstrucao de URLs...');

  const BASE_STORAGE = 'https://vajxjtrztwfolhnkewnq.supabase.co/storage/v1/object/public/preset-images';

  // 1. Corrigir Focal Length (Usando nomes reais encontrados no Storage)
  const focal = [
    { k: '14mm', f: 'focal/14mm.png' }, { k: '24mm', f: 'focal/24mm.jpg' },
    { k: '35mm', f: 'focal/35mm.jpg' }, { k: '50mm', f: 'focal/50mm.png' },
    { k: '85mm', f: 'focal/85mm.png' }, { k: '135mm', f: 'focal/135mm.png' }
  ];
  for (const item of focal) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_STORAGE}/${item.f}` }).eq('preset_key', item.k).eq('preset_type', 'focal');
  }

  // 2. Corrigir Angles (Usando nomes reais encontrados no Storage)
  const angles = [
    { k: 'eye-level', f: 'angle/eye-level.jpg' },
    { k: 'low-angle', f: 'angle/low-angle.jpg' },
    { k: 'high-angle', f: 'angle/high-angle.jpg' },
    { k: 'dutch-angle', f: 'angle/dutch-angle.jpg' },
    { k: 'birds-eye', f: 'angle/birds-eye.jpg' },
    { k: 'worms-eye', f: 'angle/worms-eye.jpg' },
    { k: 'over-shoulder', f: 'angle/over-shoulder.png' },
    { k: 'pov', f: 'angle/pov.jpg' },
    { k: 'close-up', f: 'angle/close-up.jpg' },
    { k: 'wide-shot', f: 'angle/wide-shot.jpg' }
  ];
  for (const item of angles) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_STORAGE}/${item.f}` }).eq('preset_key', item.k).eq('preset_type', 'angle');
  }

  // 3. Corrigir Aperture (Usando caminho relativo para o GitHub Pages)
  const aperture = ['f1.4', 'f2.0', 'f2.8', 'f4.0', 'f5.6', 'f8.0'];
  for (const k of aperture) {
    const fileName = k.replace('f', 'aperture-f').replace('.', '') + '.jpg';
    await supabase.from('preset_configs').update({ preview_image_url: `presets/${fileName}` }).eq('preset_key', k).eq('preset_type', 'aperture');
  }

  // 4. Corrigir Câmeras (Assumindo que você vai subir os arquivos na pasta presets/)
  const cameras = [
    { k: 'arri-natural', f: 'presets/preset-arri.jpg' },
    { k: 'red-commercial', f: 'presets/preset-red.jpg' },
    { k: 'sony-venice-night', f: 'presets/preset-sony.jpg' },
    { k: 'anamorphic-film', f: 'presets/preset-anamorphic.jpg' },
    { k: 'documentary-street', f: 'presets/preset-documentary.jpg' }
  ];
  for (const item of cameras) {
    await supabase.from('preset_configs').update({ preview_image_url: `${BASE_STORAGE}/${item.f}` }).eq('preset_key', item.k).eq('preset_type', 'camera');
  }

  console.log('✅ Pente fino concluído! Banco de dados sincronizado.');
}

masterFix();
