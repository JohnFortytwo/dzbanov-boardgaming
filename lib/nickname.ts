const NICKNAME_PATTERN = /^[0-9A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž_ ]+$/;

export const missingNicknameColumnMessage =
  "V databázi ještě není sloupec pro jméno. V Supabase SQL editoru je potřeba jednou spustit skript scripts/profile-nicknames.sql.";

export function nicknameColumnMissing(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("nickname")
  );
}

export function normalizeNickname(value: string) {
  return value.trim().replace(/ +/g, " ");
}

export function nicknameError(nickname: string) {
  if (nickname.length < 2 || nickname.length > 24) {
    return "Jméno musí mít 2 až 24 znaků.";
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return "Jméno může obsahovat jen písmena, číslice, mezeru a podtržítko.";
  }
  return null;
}
