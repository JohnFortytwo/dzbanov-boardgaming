export const TERMS_TITLE =
  "Všeobecné smluvní a herní podmínky Džbánov Boardgaming (Verze 42.1)";

export const TERMS_BODY = `Tímto se ustanovuje nezrušitelný, krví, pivem a potem z kostek zpečetěný pakt naší herní skupiny. Každý, kdo se přihlásí do této aplikace, stiskne tlačítko, nebo jen pohlédne na krabici s deskovkou, automaticky a bezvýhradně souhlasí s následujícími body.

Článek 1: Základní axiom webu a právo na duševní zdraví (Lex Ruiner)
Aplikace běží na křehké rovnováze kódu a magie. Jelikož je Ruiner jednoznačně nejschopnějším technickým mozkem naší party, výslovně se mu zakazuje poskytovat hlavnímu vývojáři více než tři návrhy na vylepšení databáze nebo UI za jedno herní sezení. Pokud vývojáři z jeho neustálých tipů na optimalizaci definitivně hrábne, přebírá Ruiner plnou zodpovědnost za údržbu serverů a všechny budoucí chyby se budou logovat pod jeho jménem. Pokud aplikace spadne, univerzální odpověď a jediné platné řešení problému je 42.

Článek 2: Přechodné ustanovení pro milovníky celulózy (Lex Dorian)
Uvědomujeme si, že pro Doriana je zapisování výsledků na papír posvátnou klasikou, zhruba stejně jako byla pro barbary v pravěku objevná malba uhlem na stěnu jeskyně. Tímto se však Dorian zavazuje, že překoná svůj odpor k moderním technologiím a vezme na milost jedničky a nuly v této aplikaci. Použití papíru a tužky je od nynějška povoleno pouze v případě globálního kolapsu elektrické sítě, a i tehdy to musí být zpětně nahráno do systému hned, jak naskočí nahozené generátory.

Článek 3: Železný pakt účasti a povinnost hrát
Zavádí se absolutní a nevyhnutelná povinnost účastnit se srazů. Tento bod nezná slitování a platí pro každého člena party bez výjimky. Neexistují žádné omluvy. Rodinné důvody, zlomené končetiny, svatby, invaze mimozemšťanů nebo hrozící apokalypsa se neberou v potaz. Kdo nepřijde na pořádné hraní, bude proklat k věčnému míchání karet ve tmě a dostane doživotní ban na všechny suroviny v Catanu.

Článek 4: Zákon o ochraně herního fondu a povinné hydrataci
Konzumace piva během partií je nejen plně povolena, ale přímo legislativně nařízena pro udržení optimální bojové morálky. Nicméně: kdokoli svými umaštěnými prsty zapatlá figurku, vylije ležák na herní plán nebo jinak znesvětí kartičky, propadne bez soudu do nějakého obzvlášť šťavnatého, krvavého pekla, za které by se nestyděl ani František Kotleta. Inkvizitor Glokta si už na případné hříšníky brousí své nástroje.

Článek 5: Doktrína společného dobra a Gartovy hegemonie
U kooperativních her se všichni zavazují ke striktní, bezvýhradné spolupráci a potlačení vlastního ega ve prospěch přežití lidstva. U kompetitivních her se však pravidla mění: všichni hráči se zavazují hrát tak, aby na konci slavnostně a přesvědčivě vyhrál Gart. Jakýkoli pokus o narušení tohoto přirozeného vesmírného řádu bude vnímán jako těžký zločin proti realitě samotné.

Článek 6: Klauzule o krku, který točí hlavou
Tímto se dává na vědomí všem uživatelům nezpochybnitelný fakt: Usha, jakožto manželka hlavního vývojáře, je oním pověstným krkem, který točí hlavou. Rozhoduje o všem. Disponuje absolutním právem veta nad výběrem jakékoliv hry i nad zněním těchto pravidel. Její slovo stojí nad samotným Gartem. Jakýkoliv pokus o zpochybnění její autority bude potrestán okamžitým vyhnanstvím uživatele do lokace Kyselá Prdel.

Článek 7: Paragraf o Vyšší moci (Vis Major) a dětském chaosu
Děti obecně – a jmenovitě Jana, Eva, Justýna, Lukáš, Tomáš a Erik – jsou pro účely těchto podmínek klasifikovány jako nepředvídatelné přírodní živly kosmických rozměrů. Pokud jejich kreativní projekty, náhlý přepad herního stolu, vyžadování pozornosti nebo bohapusté zabavení komponent naruší rozehranou partii, stav hry je automaticky zalogován jako „Remíza z důvodu zásahu Vyšších Entit“.

Zavřít tento text bez uctivého pokývnutí hlavou znamená okamžitý souhlas se všemi body. Kostky jsou vrženy, servery běží. Hrajeme!`;

export type TermsChoice = "accepted" | "declined";

export function parseTermsChoice(value: unknown): TermsChoice | null {
  return value === "accepted" || value === "declined" ? value : null;
}
