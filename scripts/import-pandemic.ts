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
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return dateStr;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

// Pomocná funkce pro očatu stavů nemocí
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
  const playerMap = new Map<string, string>(dbPlayers.map(p => [p.name, p.id]));

  const rawRows: any[] = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rawRows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`🔍 Spouštím ostrý import ${rawRows.length} her do Supabase...`);

  let importedGames = 0;

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];
    const playedAt = parseCzechDate(row.Datum);

    const yellow = cleanDiseaseState(row.žlutá);
    const red = cleanDiseaseState(row.Červená);
    const blue = cleanDiseaseState(row.Modrá);
    const black = cleanDiseaseState(row.Černá);
    const purple = row.Fialová?.trim() ? cleanDiseaseState(row.Fialová) : null;

    const { data: game, error: gameErr } = await supabase
      .from('pandemic_games')
      .insert({
        played_at: playedAt,
        result_code: row.Výsledek.trim(),
        difficulty_code: row.Obtížnost.trim(),
        game_mode_code: row.Mod.trim(),
        yellow_disease: yellow,
        red_disease: red,
        blue_disease: blue,
        black_disease: black,
        purple_disease: purple,
        virulent_strain_color: row['Barva kmen']?.trim() || null
      })
      .select('id')
      .single();

    if (gameErr || !game) {
      console.error(`❌ Chyba při vkládání hry na řádku ${index + 2}:`, gameErr);
      console.error(`Detail dat řádku: yellow="${yellow}", red="${red}", blue="${blue}", black="${black}"`);
      process.exit(1);
    }

    const gamePlayersToInsert = [];
    for (let i = 1; i <= 5; i++) {
      const playerName = row[`Hráč ${i}`]?.trim();
      const roleCode = row[`Povol ${i}`]?.trim();

      if (playerName) {
        const playerId = playerMap.get(playerName);
        if (!playerId) {
          console.error(`❌ Hráč "${playerName}" nenalezen v DB (řádek ${index + 2})`);
          process.exit(1);
        }
        gamePlayersToInsert.push({
          game_id: game.id,
          player_id: playerId,
          role_code: roleCode,
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

    const keys = Object.keys(row);
    const zmenaZKeys = keys.filter(k => k.trim().startsWith('Změna z'));
    const zmenaDoKeys = keys.filter(k => k.trim().startsWith('Změna do'));

    const roleChangesToInsert = [];
    for (let c = 0; c < Math.min(zmenaZKeys.length, zmenaDoKeys.length); c++) {
      const fromRole = row[zmenaZKeys[c]]?.trim();
      const toRole = row[zmenaDoKeys[c]]?.trim();

      if (fromRole && toRole) {
        const playerWithRole = gamePlayersToInsert.find(gp => gp.role_code === fromRole);
        if (playerWithRole) {
          roleChangesToInsert.push({
            game_id: game.id,
            player_id: playerWithRole.player_id,
            from_role_code: fromRole,
            to_role_code: toRole,
            change_order: c + 1
          });
        }
      }
    }

    if (roleChangesToInsert.length > 0) {
      const { error: rcErr } = await supabase.from('pandemic_game_role_changes').insert(roleChangesToInsert);
      if (rcErr) {
        console.error(`❌ Chyba při vkládání změny role hry na řádku ${index + 2}:`, rcErr);
        process.exit(1);
      }
    }

    importedGames++;
  }

  console.log(`\n🎉 HOTOVO! Úspěšně naimportováno všech ${importedGames} her do Supabase.`);
}

runImport().catch(console.error);