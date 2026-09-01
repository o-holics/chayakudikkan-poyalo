import type { Line } from "./models";

// The line a table says to find each other — a dialogue from Malayalam cinema.
// Starter set. A native speaker should proof the spelling and grow this list;
// keep entries short and warm, nothing crude.
export const LINES: Line[] = [
  { quote: "എടാ മോനേ ദിനേശാ", translit: "Eda mone Dinesha", gloss: "Oh dear Dinesha", film: "Nadodikkattu" },
  { quote: "ഗഫൂർ കാ ദോസ്ത്", translit: "Gafoor ka dost", gloss: "Gafoor's trusty friend", film: "Nadodikkattu" },
  { quote: "പോളണ്ടിനെപ്പറ്റി ഒരക്ഷരം മിണ്ടരുത്", translit: "Polandine-ppatti oraksharam mindaruthu", gloss: "Not one word about Poland", film: "Sandesham" },
  { quote: "ഉദ്യോഗസ്ഥ ദുഷ്പ്രഭുത്വം", translit: "Udyogastha dushprabhuthwam", gloss: "Bureaucratic tyranny!", film: "Sandesham" },
  { quote: "എന്റെ പേര് ആടു തോമ", translit: "Ente per Aadu Thoma", gloss: "My name is Aadu Thoma", film: "Spadikam" },
  { quote: "മംഗലശ്ശേരി നീലകണ്ഠൻ", translit: "Mangalassery Neelakandan", gloss: "Mangalassery Neelakandan", film: "Devasuram" },
  { quote: "പൂവള്ളി ഇന്ദുചൂഡൻ", translit: "Poovalli Induchoodan", gloss: "Poovalli Induchoodan", film: "Narasimham" },
  { quote: "ബാലകൃഷ്ണാ", translit: "Balakrishnaa", gloss: "Balakrishnaaa!", film: "Ramji Rao Speaking" },
  { quote: "അപ്പുക്കുട്ടാ", translit: "Appukkuttaa", gloss: "Appukutta!", film: "In Harihar Nagar" },
  { quote: "കിറ്റുണ്ണീ", translit: "Kittunni", gloss: "Kittunni!", film: "Kilukkam" },
  { quote: "ജോസഫ് അലക്സ്", translit: "Joseph Alex", gloss: "Joseph Alex", film: "The King" },
  { quote: "ആനക്കാട്ടിൽ ചാക്കോച്ചി", translit: "Anakkattil Chackochi", gloss: "Anakkattil Chackochi", film: "Lelam" },
  { quote: "എനിക്ക് പറക്കണം", translit: "Enikku parakkanam", gloss: "I want to fly", film: "Bangalore Days" },
  { quote: "ഞാൻ ഒരു കംപ്ലീറ്റ് മാൻ ആണ്", translit: "Njan oru complete man aanu", gloss: "I am a complete man", film: "Kumbalangi Nights" },
  { quote: "ജോർജുകുട്ടി", translit: "Georgekutty", gloss: "Georgekutty", film: "Drishyam" },
  { quote: "ന്നാ താൻ കേസ് കൊട്", translit: "Nna thaan case kodu", gloss: "Fine — then go sue me", film: "Nna Thaan Case Kodu" },
  { quote: "എൻകുട്ടി ഏട്ടത്തിയമ്മ", translit: "Enkutty ettathiyamma", gloss: "Enkutty, sister-in-law", film: "Godfather" },
  { quote: "അളിയാ", translit: "Aliyaa", gloss: "Bro", film: "Aavesham" },
];

export function randomLine(): Line {
  return LINES[Math.floor(Math.random() * LINES.length)];
}
