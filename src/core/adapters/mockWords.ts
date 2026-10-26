/**
 * The mock adapter's written reasons, one line per look and answer, each true to the pieces in that
 * look's photograph. Nothing here decides a ranking: the rules in mock.ts do that, and these lines only
 * say, in the stylist's voice, what the pieces do for the place, the time and the feel.
 *
 * Where a look is a genuine stretch for the place (the sharper dinner look at someone's home, the
 * sharper party look at a house party), its line says so plainly instead of hiding it.
 */

/** Occasion and setting: why these pieces suit the place. Keyed by outfit, then venue answer. */
export const SETTING_LINE: Record<string, Record<string, string>> = {
  dinner_safest_01: {
    RESTAURANT: "A dark knit and clean chinos look polished at the table without feeling overdressed.",
    BAR: "The dark knit keeps it smart, and leather sneakers keep it easy at the bar.",
    HOME: "Comfortable enough for someone’s home, and the dark knit still shows you made an effort.",
    ROOFTOP: "Clean lines sit well on a rooftop, and the knit helps when the air cools.",
  },
  dinner_sharper_01: {
    RESTAURANT: "A blazer over a fitted knit is refined for a restaurant without feeling stiff.",
    BAR: "The blazer gives a dinner at a bar some polish, and the knit keeps it from feeling like work.",
    HOME: "Dressier than most dinners at home. The blazer makes it an occasion, and it comes off easily if the room is relaxed.",
    ROOFTOP: "A blazer over a fitted knit looks elevated on a rooftop and keeps you warm as the evening cools.",
  },
  dinner_relaxed_01: {
    RESTAURANT: "An overshirt over a plain t-shirt is neat enough for a relaxed restaurant.",
    BAR: "An overshirt and dark jeans fit the easy pace of a bar.",
    HOME: "Comfortable for someone’s home, and the overshirt keeps it put together.",
    ROOFTOP: "Easy layers for a rooftop: the overshirt goes on or off as the evening changes.",
  },

  work_safest_01: {
    OFFICE: "A clean shirt and tailored trousers are right in any office.",
    CLIENT: "A clean shirt and tailored trousers look professional and approachable across the table.",
    EVENT: "Tailored trousers and leather shoes stay smart through a long day on an event floor.",
    REMOTE: "The shirt collar frames your face, which is what a video call shows.",
  },
  work_sharper_01: {
    OFFICE: "A blazer over a crisp shirt sets a confident tone in the office.",
    CLIENT: "A blazer and a crisp shirt show a client you take the meeting seriously.",
    EVENT: "A blazer over a crisp shirt is ready to make an impression at an industry event.",
    REMOTE: "A blazer and a crisp collar look sharp on camera, where only your top half shows.",
  },
  work_relaxed_01: {
    OFFICE: "A fine knit polo and chinos are comfortable all day and still look professional.",
    CLIENT: "A fine knit polo feels approachable with a client and is still neat enough for the room.",
    EVENT: "A knit polo and loafers stay comfortable through a long day of standing and talking.",
    REMOTE: "A fine knit polo has a soft collar that looks neat on camera without feeling formal.",
  },

  date_safest_01: {
    RESTAURANT: "An overshirt over a plain t-shirt looks considered at a restaurant without trying too hard.",
    BAR: "Dark jeans and an overshirt feel natural at a bar, relaxed but neat.",
    WALK: "Easy pieces for coffee or a walk, and the white sneakers are made for it.",
    SHOW: "Neat enough for a show and comfortable for sitting through it.",
  },
  date_sharper_01: {
    RESTAURANT: "A navy blazer over a fine knit is refined for a restaurant date.",
    BAR: "The blazer adds polish at a bar, and the knit keeps it relaxed.",
    WALK: "A casual setting with a confident finish: the knit and chinos stay easy, and the blazer lifts it.",
    SHOW: "A navy blazer looks polished for a show, and the knit keeps you comfortable in your seat.",
  },
  date_relaxed_01: {
    RESTAURANT: "A light jacket over a plain t-shirt suits a relaxed restaurant.",
    BAR: "A light jacket and dark jeans are easy and confident at a bar.",
    WALK: "Effortless for coffee or a walk, in sneakers you can actually walk in.",
    SHOW: "Easy to sit in through a show, and the jacket keeps it put together.",
  },

  wedding_safest_01: {
    HOTEL: "A navy suit and a white shirt are polished for an elegant hotel wedding.",
    GARDEN: "Navy is softer than black among greenery and still properly formal.",
    BEACH: "A navy suit keeps it formal by the sea, and the jacket can come off once the ceremony ends.",
    ESTATE: "A navy suit is right for a private estate, formal without feeling stiff in a smaller crowd.",
  },
  wedding_sharper_01: {
    HOTEL: "A charcoal suit and a silk tie match the formality of a hotel wedding.",
    GARDEN: "Charcoal and a silk tie give a garden wedding a more formal presence.",
    BEACH: "A charcoal suit and tie keep a beach ceremony formal, when the invitation asks for it.",
    ESTATE: "A charcoal suit and a silk tie suit the quiet formality of a private estate.",
  },
  wedding_relaxed_01: {
    HOTEL: "A light blazer and an open collar look elegant in a hotel, when the dress code is relaxed.",
    GARDEN: "A light blazer and an open collar have the natural ease a garden wedding calls for.",
    BEACH: "A light blazer, an open collar and loafers feel coastal and still refined.",
    ESTATE: "A light blazer and an open collar feel elegant and easy in an intimate setting.",
  },

  party_safest_01: {
    CLUB: "Black and a clean jacket work in a club, and leather sneakers keep you comfortable.",
    HOUSE: "Relaxed enough for a house party, and the clean jacket keeps it sharp.",
    ROOFTOP: "A clean jacket over black is easy on a rooftop and keeps you warm as it cools.",
    LAUNCH: "Black under a clean jacket looks considered at a launch or gallery without competing with the room.",
  },
  party_sharper_01: {
    CLUB: "All black with a blazer stands out in a club in a clean way.",
    HOUSE: "Dressier than most house parties. The blazer gives it a polished edge, and it comes off once you settle in.",
    ROOFTOP: "A blazer over a black knit looks elevated on a rooftop, and the knit keeps it relaxed.",
    LAUNCH: "All black with a blazer is creative, polished and considered for a launch or gallery.",
  },
  party_relaxed_01: {
    CLUB: "A bomber and dark jeans are easy to move in, which matters in a club.",
    HOUSE: "A bomber over a plain t-shirt is relaxed enough to feel at ease at a house party.",
    ROOFTOP: "A bomber is the easy layer for a rooftop, on when it cools and off when it’s warm.",
    LAUNCH: "A bomber over a plain t-shirt keeps a launch relaxed, with a little street confidence.",
  },
};

/** Time: why these pieces suit the hour the customer chose. Keyed by outfit, then time answer. */
export const TIME_LINE: Record<string, Record<string, string>> = {
  dinner_safest_01: { SUNSET: "A dark knit is right for an early start and carries on as the evening goes.", NIGHT: "Dark tones look right in evening light." },
  dinner_sharper_01: { SUNSET: "Tailoring suits an early evening dinner and carries straight into the night.", NIGHT: "A blazer and Chelsea boots feel made for a night out." },
  dinner_relaxed_01: { SUNSET: "Easy layers for an early evening, with the overshirt for when it cools.", NIGHT: "Dark jeans and the overshirt keep it neat after dark." },

  work_safest_01: { DAY: "Built for a full working day, comfortable from the first meeting to the last.", NIGHT: "A clean shirt carries into an evening work commitment, such as a dinner or an event." },
  work_sharper_01: { DAY: "Crisp enough for the most important meeting of the day.", NIGHT: "A blazer and a crisp shirt are refined for evening commitments." },
  work_relaxed_01: { DAY: "Comfortable from morning to evening and still neat.", NIGHT: "A fine knit polo is relaxed enough for drinks after work and still professional." },

  date_safest_01: { DAY: "Fresh and easy for a daytime date, and the white sneakers keep it light.", SUNSET: "Easy for an early evening, and the overshirt helps when it cools.", NIGHT: "Dark jeans and a neutral overshirt carry well into the night." },
  date_sharper_01: { DAY: "Navy and a fine knit feel fresh in daylight, not like office wear.", SUNSET: "Polished for an early evening, with a blazer for when the air cools.", NIGHT: "A navy blazer is refined for a night out." },
  date_relaxed_01: { DAY: "A plain t-shirt and a light jacket are easy for daytime.", SUNSET: "Easy to wear into the evening, with a jacket for later.", NIGHT: "Ready for a relaxed night out." },

  wedding_safest_01: {
    SUNRISE: "A white shirt looks fresh in early light, refined for a morning ceremony.",
    DAY: "Navy looks clean in daylight, elegant for a daytime celebration.",
    SUNSET: "Navy deepens in evening light, polished for an early evening ceremony.",
    NIGHT: "A navy suit with black oxfords is refined for an evening reception.",
  },
  wedding_sharper_01: {
    SUNRISE: "Charcoal and a silk tie set a formal tone for an early ceremony.",
    DAY: "Charcoal keeps its formality in daylight, with the tie for the ceremony.",
    SUNSET: "Charcoal and silk look rich as the light lowers.",
    NIGHT: "A charcoal suit and tie suit a formal evening reception.",
  },
  wedding_relaxed_01: {
    SUNRISE: "A light blazer and an open collar feel fresh for a morning ceremony.",
    DAY: "Light tailoring stays comfortable through a long daytime celebration.",
    SUNSET: "A light blazer is easy to wear into the evening.",
    NIGHT: "An open collar keeps a night reception relaxed and elegant.",
  },

  party_safest_01: { DAY: "A clean jacket over black works for a daytime event without looking like evening wear.", SUNSET: "Ready for an early evening, and the jacket stays on as it cools.", NIGHT: "Black and a clean jacket work in any room after dark." },
  party_sharper_01: { DAY: "All black looks graphic and modern in daylight, right for a daytime opening.", SUNSET: "A blazer over black is ready for an early evening event.", NIGHT: "All black with a blazer is confident for the night." },
  party_relaxed_01: { DAY: "A bomber over a plain t-shirt is easy for a daytime party.", SUNSET: "A bomber is the right weight as the evening begins.", NIGHT: "Easy to move in and right for the night." },
};

/** Feel: how the pieces give the feel the customer asked for. */
export const FEEL_LINE: Record<string, string> = {
  dinner_safest_01: "Clean and understated, the classic feel you asked for.",
  dinner_sharper_01: "The blazer and boots give it the sharp, defined finish you asked for.",
  dinner_relaxed_01: "Relaxed, as you asked, and still put together.",
  work_safest_01: "Timeless and professional, the classic feel you asked for.",
  work_sharper_01: "Defined lines and a confident finish, the sharp feel you asked for.",
  work_relaxed_01: "Comfortable and still considered, the relaxed feel you asked for.",
  date_safest_01: "Understated and easy, the classic feel you asked for.",
  date_sharper_01: "The blazer gives it the polished, confident finish you asked for.",
  date_relaxed_01: "Comfortable and naturally put together, as you asked.",
  wedding_safest_01: "Timeless and right for the day, the classic feel you asked for.",
  wedding_sharper_01: "Defined tailoring and a tie give it the sharp finish you asked for.",
  wedding_relaxed_01: "Effortless elegance with an open collar, the relaxed feel you asked for.",
  party_safest_01: "Clean and simple, the classic feel you asked for.",
  party_sharper_01: "Bold, defined and confident, the sharp feel you asked for.",
  party_relaxed_01: "Easygoing but put together, the relaxed feel you asked for.",
};

/** Feel, when this look is the other option to the feel the customer asked for: what it offers instead. */
export const OPTION_LINE: Record<string, string> = {
  dinner_safest_01: "The classic option, a dark knit and clean chinos.",
  dinner_sharper_01: "The sharper option, with a blazer and Chelsea boots.",
  dinner_relaxed_01: "The easier option, with an overshirt and jeans.",
  work_safest_01: "The classic option, a clean shirt and tailored trousers.",
  work_sharper_01: "The sharper option, with a blazer over a crisp shirt.",
  work_relaxed_01: "The easier option, a knit polo instead of a shirt.",
  date_safest_01: "The classic option, an overshirt and jeans.",
  date_sharper_01: "The sharper option, with a navy blazer.",
  date_relaxed_01: "The easier option, a light jacket and sneakers.",
  wedding_safest_01: "The classic option, a navy suit and a white shirt.",
  wedding_sharper_01: "The sharper option, a charcoal suit with a silk tie.",
  wedding_relaxed_01: "The easier option, a light blazer with an open collar.",
  party_safest_01: "The classic option, black with a clean jacket.",
  party_sharper_01: "The sharper option, all black with a blazer.",
  party_relaxed_01: "The easier option, a bomber and jeans.",
};
