const NICKNAME_PATTERN = /^[0-9A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž_ ]+$/;

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
