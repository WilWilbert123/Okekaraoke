// ============================================================
// OKEKARAOKE: Curated Banner Jokes, Quotes & Inuman Banter
// Tagalog, English, and Dark Humor for Live TV Karaoke Banners
// Focus: Alak, Beer, Tagayan, Pulutan & Barkada Videoke Nights
// ============================================================

export interface BannerPreset {
  id: string;
  category: 'tagalog' | 'english' | 'dark_joke' | 'inuman';
  categoryLabel: string;
  label: string;
  text: string;
}

export const BANNER_PRESETS: BannerPreset[] = [
  // ─── TAGALOG & INUMAN JOKES ─────────────────────────────
  {
    id: 'tagay-inuugat',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Inuugat na ang baso',
    text: 'Ano sino na tatagay ? inuugat na yang baso haha',
  },
  {
    id: 'sick-leave',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Sick leave sa Monday',
    text: "Wala na, sick leave na sa Monday 'to! Cheers mga tol!",
  },
  {
    id: 'bawal-sintunado',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Karaoke',
    label: 'Bawal Sintunado',
    text: 'Bawal sintunado dito! Pero kung ikaw ang taya sa alak at beer, sige birit mo lang sagad!',
  },
  {
    id: 'my-way-iyak',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Videoke',
    label: 'My Way Warning',
    text: 'Pakibilisan kumanta, may iiyak pa sa "My Way" mamaya haha.',
  },
  {
    id: 'boses-banyo',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Karaoke',
    label: 'Boses Pang-Banyo',
    text: 'Yung boses mo pang-banyo lang, pero ramdam namin yung hinagpis mo pre!',
  },
  {
    id: 'text-sa-ex',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Huwag Mag-text sa Ex',
    text: 'Uminom para makalimot, hindi para mag-text sa ex habang kumakanta ng Luha!',
  },
  {
    id: 'awa-ng-atay',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Inuman',
    label: 'Sabi ng Atay Mo',
    text: "Sabi ng atay mo: 'Parang awa mo na, tubig naman kahit isang baso lang!'",
  },
  {
    id: 'walang-ambag',
    category: 'inuman',
    categoryLabel: 'Tagalog / Videoke',
    label: 'Walang Ambag sa Alak',
    text: 'Kung sino pa yung walang ambag sa alak at pulutan, siya pa laging humahawak ng mic!',
  },
  {
    id: 'diretso-icu',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Inuman',
    label: 'Tubig Bago Pulutan',
    text: 'Tubig muna bago pulutan tol, baka bukas ICU na diretso mo haha!',
  },
  {
    id: 'walang-uuwi',
    category: 'inuman',
    categoryLabel: 'Tagalog / Videoke',
    label: 'Walang Uuwi Rule',
    text: 'Walang uuwi hangga\'t may laman pa ang baso at hindi nakaka-100 score sa karaoke!',
  },
  {
    id: 'pulutan-ubos',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Pulutan Police',
    text: 'Pang-lima mo nang pulutan yan pre, uminom ka naman kahit kalahating shot ng alak!',
  },
  {
    id: 'tulog-sa-sofa',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Huwag Tulog sa Tagayan',
    text: 'Walang aalis kapag ubos na ang beer, bawal magpanggap na tulog sa sofa haha!',
  },
  {
    id: 'bayad-utang',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Karaoke',
    label: 'Lakas ng Boses vs Utang',
    text: 'Kung gaano kalakas boses mo kumanta, sana ganun din kalakas loob mong magbayad ng utang haha!',
  },
  {
    id: 'moonstar88-iyak',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Karaoke',
    label: 'Umiiyak sa Sulat',
    text: 'May umiiyak na naman sa Torete at Luha... sino na naman nanakit sa\'yo pre?',
  },
  {
    id: 'radyo-walang-signal',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Karaoke',
    label: 'Radyong Walang Signal',
    text: 'Yung boses mo parang radyong walang signal, pero ramdam namin yung pait ng nakaraan mo.',
  },
  {
    id: 'floor-tiles-usap',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Kausap ang Floor Tiles',
    text: 'Si kumpare kanina pa tahimik sa sulok, mukhang nakikipag-usap na sa floor tiles haha!',
  },
  {
    id: 'one-bottle-bucket',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'One Bottle Scam',
    text: 'Sabi mo kanina "one bottle lang tayo tol", bakit pang-anim na bucket ng beer na \'to ngayon?!',
  },
  {
    id: 'record-label',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Karaoke',
    label: 'Walang Record Label',
    text: 'Reminder: Walang talent scout o record label na pipirma sa\'yo ngayong gabi, tagay ka na lang ng alak.',
  },
  {
    id: 'araneta-score-68',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Videoke',
    label: 'Araneta Concert Vibes',
    text: 'Kala mo may concert sa Araneta kung makahawak sa mic, pagtingin sa score 68 lang pala haha!',
  },
  {
    id: 'atay-resignation',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Inuman',
    label: 'Atay Resignation',
    text: 'Yung atay mo nagre-ready na mag-file ng immediate resignation letter sa HR mamaya haha!',
  },
  {
    id: 'facebook-live-lasing',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Bawal Mag-FB Live',
    text: 'Bawal magdrama kapag lasing na tol! Itulog mo na yan bago ka pa mag-Facebook Live!',
  },
  {
    id: 'gigil-facial-expression',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Videoke',
    label: 'High Note Gigil',
    text: 'Kung hindi mo maabot yung high note, daanin mo na lang sa gigil at matinding facial expression!',
  },
  {
    id: 'humihinga-pa-ba',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Inuman',
    label: 'Check Kung Humihinga Pa',
    text: 'Paki-check nga kung humihinga pa si pre sa ilalim ng lamesa haha!',
  },
  {
    id: 'sagot-ko-first-round',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Sagot Ko First Round',
    text: 'Yung tropa mong sumigaw ng "sagot ko first round" pero biglang nawala nung bibili na ng beer haha!',
  },
  {
    id: 'emergency-siren',
    category: 'tagalog',
    categoryLabel: 'Tagalog / Karaoke',
    label: 'Emergency Siren Vocals',
    text: 'Yung birit mo parang emergency siren sa barangay, pero tuloy mo lang pre, tagay mo na yan!',
  },
  {
    id: 'sanay-masaktan',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Karaoke',
    label: 'Sanay Na Masaktan',
    text: 'Wag kang mahiya sa boses mo tol, sanay na kaming masaktan araw-araw. Tagay na!',
  },
  {
    id: 'tricycle-pauwi',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Pamasahe sa Tricycle',
    text: 'Inom lang nang inom! Basta siguraduhin mong may natira pang bente para sa tricycle pauwi.',
  },
  {
    id: 'cr-buong-araw',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Inuman',
    label: 'CR Resident Bukas',
    text: 'Tagay pa more mga tol! Bukas buong araw kayong magkikita ng inodoro sa banyo haha!',
  },
  {
    id: 'buksan-ang-beer',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Buksan ang Beer',
    text: 'Paki-buksan na ang susunod na case ng beer, nauuhaw na yung mga back-up singer dito haha!',
  },
  {
    id: 'yelo-at-beer',
    category: 'inuman',
    categoryLabel: 'Tagalog / Inuman',
    label: 'Taga-Bili ng Yelo at Beer',
    text: 'Sino ba taga-bili ng yelo at beer dyan? Kanina pa umiinit yung lalamunan namin!',
  },

  // ─── ENGLISH & DARK HUMOR / KARAOKE BANTER ───────────────
  {
    id: 'nobody-listening',
    category: 'english',
    categoryLabel: 'English / Banter',
    label: 'Nobody Is Listening',
    text: "Sing like nobody is listening... because trust us, we're really trying not to.",
  },
  {
    id: 'cheaper-than-therapy',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Drinks',
    label: 'Cheaper Than Therapy',
    text: 'Cold beer and karaoke are cheaper than therapy, and your singing proves you need both.',
  },
  {
    id: 'alcohol-water',
    category: 'english',
    categoryLabel: 'English / Bar Joke',
    label: 'Alcohol vs Water',
    text: "Alcohol doesn't solve your problems, but neither does water. Cheers!",
  },
  {
    id: 'nine-minute-song',
    category: 'english',
    categoryLabel: 'English / Karaoke',
    label: '9-Minute Ballad Crime',
    text: 'Whoever queued a 9-minute rock ballad without knowing the lyrics: straight to jail.',
  },
  {
    id: 'hangover-forecast',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Regret',
    label: 'Hangover Forecast',
    text: "Tonight's forecast: 99% chance of hangover and deep emotional regret tomorrow morning.",
  },
  {
    id: 'restraining-order',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Vocals',
    label: 'Vocal Restraining Order',
    text: 'Your vocal cords are filing a restraining order against you right now.',
  },
  {
    id: 'numb-the-pain',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / High Notes',
    label: 'Numb the Pain',
    text: "Don't worry about hitting the high notes — the cold beer will numb our ears soon enough.",
  },
  {
    id: 'volume-confidence',
    category: 'english',
    categoryLabel: 'English / Karaoke',
    label: 'Volume & Confidence',
    text: "If you can't hit the pitch, just increase your volume and maximum confidence!",
  },
  {
    id: 'chainsaw-vocals',
    category: 'english',
    categoryLabel: 'English / Banter',
    label: 'Dying Chainsaw',
    text: 'Free cold beer to anyone who can sing the chorus without sounding like a dying chainsaw!',
  },
  {
    id: 'ktv-secrets',
    category: 'english',
    categoryLabel: 'English / Karaoke',
    label: 'KTV Secrets',
    text: 'What happens in the videoke room stays in the room... except your off-key vocals.',
  },
  {
    id: 'burning-calories',
    category: 'dark_joke',
    categoryLabel: 'Dark Joke / Vocals',
    label: 'Burning Calories',
    text: 'Singing burns calories, but so does crying while listening to you. Keep going!',
  },
];

export const DEFAULT_BANNER_PRESET_TEXTS = BANNER_PRESETS.map((p) => p.text);

export function getRandomBannerPreset(excludeText?: string): BannerPreset {
  const candidates = excludeText
    ? BANNER_PRESETS.filter((p) => p.text !== excludeText)
    : BANNER_PRESETS;
  const list = candidates.length > 0 ? candidates : BANNER_PRESETS;
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}
