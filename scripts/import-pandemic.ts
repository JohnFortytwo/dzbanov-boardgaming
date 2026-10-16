import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Chybí NEXT_PUBLIC_SUPABASE_URL nebo NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function parseCzechDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const parts = clean.split('.');
  if (parts.length !== 3) return clean;
  const day = parts[0].trim().padStart(2, '0');
  const month = parts[1].trim().padStart(2, '0');
  const year = parts[2].trim();
  return `${year}-${month}-${day}`;
}

function cleanDiseaseState(val: string | undefined): string {
  if (!val) return 'Nic';
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === '-') return 'Nic';
  return trimmed;
}

async function runImport() {
  const filePath = path.join(process.cwd(), 'scripts', 'data_pandemic_old.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Soubor nenalezen na adrese: ${filePath}`);
    process.exit(1);
  }

  const { data: dbPlayers, error: playersErr } = await supabase.from('players').select('id, name');
  if (playersErr || !dbPlayers) {
    console.error('❌ Chyba při načítání hráčů z DB:', playersErr);
    process.exit(1);
  }
  const playerMap = new Map<string, string>(dbPlayers.map(p => [p.name.trim(), p.id]));

  const rawRows: any[] = [];
  
  // Explicitní definice unikátních názvů sloupců podle přesného pořadí z CSV
  const customHeaders = [
    'datum', 'vysledek', 'hracu',
    'hrac1', 'hrac2', 'hrac3', 'hrac4', 'hrac5',
    'povol1', 'povol2', 'povol3', 'povol4', 'povol5',
    'zmena_z_1', 'zmena_do_1', 'zmena_z_2', 'zmena_do_2',
    'obtiznost', 'mod',
    'zluta', 'cervena', 'modra', 'cerna', 'fialova', 'barva_kmen'
  ];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({
        headers: customHeaders,
        skipLines: 1 // přeskočit původní řádek hlavičky
      }))
      .on('data', (data) => rawRows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`🔍 Spouštím ostrý import ${rawRows.length} her do Supabase...`);

  let importedGames = 0;
  let totalRoleChanges = 0;

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];
    if (!row.datum || !row.vysledek) continue;

    const playedAt = parseCzechDate(row.datum);

    const yellow = cleanDiseaseState(row.zluta);
    const red = cleanDiseaseState(row.cervena);
    const blue = cleanDiseaseState(row.modra);
    const black = cleanDiseaseState(row.cerna);
    const purple = row.fialova?.trim() ? cleanDiseaseState(row.fialova) : null;

    const { data: game, error: gameErr } = await supabase
      .from('pandemic_games')
      .insert({
        played_at: playedAt,
        result_code: row.vysledek.trim(),
        difficulty_code: row.obtiznost.trim(),
        game_mode_code: row.mod.trim(),
        yellow_disease: yellow,
        red_disease: red,
        blue_disease: blue,
        black_disease: black,
        purple_disease: purple,
        virulent_strain_color: row.barva_kmen?.trim() || null
      })
      .select('id')
      .single();

    if (gameErr || !game) {
      console.error(`❌ Chyba při vkládání hry na řádku ${index + 2}:`, gameErr);
      process.exit(1);
    }

    // 1. Uložení hráčů
    const gamePlayersToInsert = [];
    for (let i = 1; i <= 5; i++) {
      const playerName = row[`hrac${i}`]?.trim();
      const roleCode = row[`povol${i}`]?.trim();

      if (playerName) {
        const playerId = playerMap.get(playerName);
        if (!playerId) {
          console.error(`❌ Hráč "${playerName}" nenalezen v DB (řádek ${index + 2})`);
          process.exit(1);
        }
        gamePlayersToInsert.push({
          game_id: game.id,
          player_id: playerId,
          role_code: roleCode || null,
          player_order: i
        });
      }
    }

    if (gamePlayersToInsert.length > 0) {
      const { error: gpErr } = await supabase.from('pandemic_game_players').insert(gamePlayersToInsert);
      if (gpErr) {
        console.error(`❌ Chyba při vkládání hráčů hry na řádku ${index + 2}:`, gpErr);
        process.exit(1);
      }
    }

    // 2. Uložení změn rolí (1. i 2. změna)
    const roleChangesToInsert = [];

    // Změna 1
    const zmenaZ1 = row.zmena_z_1?.trim();
    const zmenaDo1 = row.zmena_do_1?.trim();
    if (zmenaZ1 && zmenaDo1) {
      const playerWithRole = gamePlayersToInsert.find(gp => gp.role_code === zmenaZ1);
      if (playerWithRole) {
        roleChangesToInsert.push({
          game_id: game.id,
          player_id: playerWithRole.player_id,
          from_role_code: zmenaZ1,
          to_role_code: zmenaDo1,
          change_order: 1
        });
      }
    }

    // Změna 2
    const zmenaZ2 = row.zmena_z_2?.trim();
    const zmenaDo2 = row.zmena_do_2?.trim();
    if (zmenaZ2 && zmenaDo2) {
      const playerWithRole = gamePlayersToInsert.find(gp => gp.role_code === zmenaZ2);
      if (playerWithRole) {
        roleChangesToInsert.push({
          game_id: game.id,
          player_id: playerWithRole.player_id,
          from_role_code: zmenaZ2,
          to_role_code: zmenaDo2,
          change_order: 2
        });
      }
    }

    if (roleChangesToInsert.length > 0) {
      const { error: rcErr } = await supabase.from('pandemic_game_role_changes').insert(roleChangesToInsert);
      if (rcErr) {
        console.error(`❌ Chyba při vkládání změny role hry na řádku ${index + 2}:`, rcErr);
        process.exit(1);
      }
      totalRoleChanges += roleChangesToInsert.length;
    }

    importedGames++;
  }

  console.log(`\n🎉 HOTOVO! Úspěšně naimportováno ${importedGames} her a ${totalRoleChanges} změn rolí do Supabase.`);
}

runImport().catch(console.error);