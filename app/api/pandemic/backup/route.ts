import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildBackupZip, loadPandemicBackup } from "@/lib/pandemic/backup";

export async function GET() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return Response.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  try {
    const { filename, bytes } = buildBackupZip(await loadPandemicBackup());
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zálohu se nepodařilo vytvořit.";
    return Response.json({ error: message }, { status: 500 });
  }
}
