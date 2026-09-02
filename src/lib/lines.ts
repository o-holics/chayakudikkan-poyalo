import type { Line } from "./models";

// The line a table says to find each other — a dialogue from Malayalam cinema.
// Short, warm, instantly recognizable pop-culture lines across eras.
export const LINES: Line[] = [
  // --- Original entries ---
  {
    quote: "നീ പോ മോനേ ദിനേശാ",
    translit: "Nee po mone Dinesha",
    gloss: "Beat it, kid (Go away, Dinesha)",
    film: "Narasimham",
  },
  {
    quote: "ഗഫൂർ കാ ദോസ്ത്",
    translit: "Gafoor ka dost",
    gloss: "Gafoor's friend",
    film: "Nadodikkattu",
  },
  {
    quote: "പോളണ്ടിനെപ്പറ്റി ഒരക്ഷരം മിണ്ടരുത്",
    translit: "Polandineppatti oraksharam mindaruthu",
    gloss: "Don't say a word about Poland",
    film: "Sandesham",
  },
  {
    quote: "ഉദ്യോഗസ്ഥ ദുഷ്പ്രഭുത്വം",
    translit: "Udyogastha dushprabhuthwam",
    gloss: "Bureaucratic tyranny",
    film: "Aaraattu",
  },
  {
    quote: "അപ്പുക്കുട്ടാ ഓവറാക്കി ചളമാക്കണ്ട",
    translit: "Appukuttaa overaakki chalamakkanda",
    gloss: "Appukutta, don't overdo it and ruin it",
    film: "In Harihar Nagar",
  },
  {
    quote: "എന്റെ കുരിശുപള്ളി മാതാവേ",
    translit: "Ente Kurishupalli Mathave",
    gloss: "Mother Mary of Kurishupally!",
    film: "Lelam",
  },
  {
    quote: "ന്നാ താൻ കേസ് കൊട്",
    translit: "Nna thaan case kodu",
    gloss: "Fine, then sue me",
    film: "Nna Thaan Case Kodu",
  },

  // --- New additions ---
  {
    quote: "സാധനം കയ്യിലുണ്ടോ?",
    translit: "Saadhanam kayyilundo?",
    gloss: "Do you have the stuff?",
    film: "Nadodikkattu",
  },
  {
    quote: "എല്ലാത്തിനും അതിന്റേതായ സമയമുണ്ട് ദാസാ",
    translit: "Ellaathinum athintethaya samayamundu Dasa",
    gloss: "There is a right time for everything, Dasa",
    film: "Nadodikkattu",
  },
  {
    quote: "എന്താല്ലേ...",
    translit: "Enthalle...",
    gloss: "Quite something, isn't it?",
    film: "Manichitrathazhu",
  },
  {
    quote: "വിടമാട്ടേ!",
    translit: "Vidamaatte!",
    gloss: "I won't leave!",
    film: "Manichitrathazhu",
  },
  {
    quote: "സവാരി ഗിരി ഗിരി",
    translit: "Savaari giri giri",
    gloss: "Smooth sailing / All chill",
    film: "Kilukkam",
  },
  {
    quote: "തള്ളേ, കലിപ്പടക്കണല്ലോ!",
    translit: "Thalle, kalippadakkanallo!",
    gloss: "Man, gotta blow off some steam!",
    film: "Aavesham",
  },
  {
    quote: "അലോസരം... തികച്ചും അലോസരം!",
    translit: "Alocharam... thikachum alocharam!",
    gloss: "Nuisance... pure nuisance!",
    film: "Chithram",
  },
  {
    quote: "ഉപദേശം കൊള്ളാം, പക്ഷേ തന്റെ തന്തയല്ല എന്റെ തന്ത",
    translit: "Upadesham kollam, pakshe thante thanthayalla ente thantha",
    gloss: "Good advice, but your father isn't my father",
    film: "Lucifer",
  },
  {
    quote: "ധൈര്യമായി മുന്നോട്ട് പോവുക",
    translit: "Dhairyamayi munnottu povuka",
    gloss: "Move forward with courage",
    film: "Sandesham",
  },
  {
    quote: "ഓർമ്മയുണ്ടോ ഈ മുഖം?",
    translit: "Ormmayundo ee mukham?",
    gloss: "Remember this face?",
    film: "Commissioner",
  },
];

export function randomLine(): Line {
  return LINES[Math.floor(Math.random() * LINES.length)];
}