/**
 * 13 symbol sprites — pixel art, drawn procedurally.
 * Each sprite is an array of strings: '.' = transparent, letter = palette key.
 * Standard symbols are 9×9. Ticket sprite is 13×7.
 *
 * Palette keys:
 *   R = red, B = blue, G = gold, E = green, P = purple,
 *   W = white, K = black, D = darkGray, N = neonPink,
 *   Y = darkGold, r = darkRed, b = darkBlue, g = darkGreen, p = darkPurple
 */

import { PAL } from './PaletteDB.js';

const COLOR_KEY = {
  'R': PAL.red,      'r': PAL.darkRed,
  'B': PAL.blue,     'b': PAL.darkBlue,
  'G': PAL.gold,     'Y': PAL.darkGold,
  'E': PAL.green,    'g': PAL.darkGreen,
  'P': PAL.purple,   'p': PAL.darkPurple,
  'W': PAL.white,    'D': PAL.midGray,
  'K': PAL.black,    'N': PAL.neonPink,
  'L': PAL.lightGray,
  'C': PAL.cyan,     'c': PAL.darkCyan,
  '1': PAL.deepBlue,  '2': PAL.shadedBlue, '3': PAL.shadedCyan,
};

const SIZE = 9;

// prettier-ignore
const SPRITES = {
  // ── Commons ──
  red: [ // red gem
    '....R....',
    '...RRR...',
    '..RRWRR..',
    '.RRRWRRR.',
    'RRRRrRRRR',
    '.RRRrRRR.',
    '..RRrRR..',
    '...RRR...',
    '....R....',
  ],
  blue: [ // blue orb
    '...BBB...',
    '..BWBBB..',
    '.BWBBBB..',
    '.BBBBBBB.',
    '.BBBBBBB.',
    '.BBBBbBB.',
    '..BBbBB..',
    '...BBB...',
    '.........',
  ],
  gold: [ // gold coin
    '...GGG...',
    '..GWGGG..',
    '.GGGGGGG.',
    '.GG.G.GG.',
    '.GGGGGGG.',
    '.GG.G.GG.',
    '.GGGGGGG.',
    '..YYYYY..',
    '...YYY...',
  ],

  // ── Uncommons ──
  green: [ // green clover
    '..EE.EE..',
    '.EEWEEW..',
    '.EEEEEEE.',
    '..EEEEE..',
    '...gEg...',
    '...gEg...',
    '....g....',
    '....g....',
    '.........',
  ],
  purple: [ // purple crystal
    '....P....',
    '...PPP...',
    '..PPWPP..',
    '..PPPPP..',
    '.PPPPPPP.',
    '.PPPpPPP.',
    '..PPpPP..',
    '...ppp...',
    '.........',
  ],
  cherry: [ // cherries
    '....ggg..',
    '...g..g..',
    '..g...g..',
    '.RR..RR..',
    'RRWR.RRW.',
    'RRRR.RRRR',
    '.RRr..RRr',
    '..RR...RR',
    '.........',
  ],
  bell: [ // golden bell
    '...GGG...',
    '..GWGGG..',
    '.GGGGGGG.',
    '.GGGGGGG.',
    '.GGGGGGG.',
    'GGGGGGGGG',
    'YYYYYYYYY',
    '...GGG...',
    '....G....',
  ],
  // ── UI ──
  ball: [ // roulette ball
    '.........',
    '.........',
    '...WWW...',
    '..WWWWW..',
    '..WWWWW..',
    '..WWWWW..',
    '...WWW...',
    '.........',
    '.........',
  ],

  // ── Rares ──
  seven: [ // lucky 7
    '.RRRRRRR.',
    '.RRRRRRR.',
    '.....RR..',
    '....RR...',
    '...RWR...',
    '..RWR....',
    '..RR.....',
    '..RR.....',
    '.........',
  ],
  ticket: [ // green ticket (rectangular 13×7)
    '.ggggggggggg.',
    'gEEEEEEEEEEEg',
    'gEWWEEEEEWWEg',
    'gEEEEEEEEEEEg',
    'gEWWEEEEEWWEg',
    'gEEEEEEEEEEEg',
    '.ggggggggggg.',
  ],

  // ── Legendaries ──
  void: [ // void spiral
    '...ppp...',
    '..p...p..',
    '.p.PPP.p.',
    '.p.P.P.p.',
    '.p.P...p.',
    '.p.PPPp..',
    '.p.....p.',
    '..p...p..',
    '...ppp...',
  ],
  joker: [ // joker face
    '...NNN...',
    '..NWWWN..',
    '.NW.W.WN.',
    '.NWWWWWN.',
    '.NW.N.WN.',
    '.NWNNWWN.',
    '..NWWWN..',
    '...NNN...',
    '.........',
  ],
  phoenix: [ // fire bird
    '...RGR...',
    '..RGGR...',
    '.RGWGGR..',
    '.RGGGGR..',
    'RRRGGRR..',
    '.rRRRR...',
    '..rRRr...',
    '.r..r.r..',
    '.........',
  ],

  // ── Relic sprites (for forge shop) ──
  relic_common: [ // small potion
    '...LLL...',
    '...LWL...',
    '...LLL...',
    '..LLWLL..',
    '..LLLLL..',
    '..LLLLL..',
    '..LLLLL..',
    '...LLL...',
    '.........',
  ],
  relic_uncommon: [ // green gem
    '....E....',
    '...EWE...',
    '..EWWWE..',
    '.EEWWEEE.',
    '.EEEEEEE.',
    '..EEgEE..',
    '...EgE...',
    '....E....',
    '.........',
  ],
  relic_rare: [ // blue crystal
    '....B....',
    '...BWB...',
    '..BWWWB..',
    '..BWWBB..',
    '.BBBBBBB.',
    '..BBbBB..',
    '...BbB...',
    '....B....',
    '.........',
  ],
  relic_legendary: [ // golden crown
    '.N.N.N.N.',
    '.NNNNNNN.',
    '.NWWNWWN.',
    '.NNNNNNN.',
    '..NNNNN..',
    '..GGGGG..',
    '..GWGWG..',
    '..GGGGG..',
    '.........',
  ],
  anvil: [ // forge anvil
    '.........',
    '.DDDDDDD.',
    'DDDWWDDDD',
    'DDDDDDDDD',
    '..DDDDD..',
    '..DDDDD..',
    '.DDDDDDD.',
    'DDDDDDDDD',
    '.........',
  ],
  reroll: [ // dice reroll icon
    '.........',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.........',
  ],
  arrow_right: [ // leave/next arrow
    '.........',
    '...W.....',
    '...WW....',
    '...WWW...',
    '...WWWW..',
    '...WWW...',
    '...WW....',
    '...W.....',
    '.........',
  ],
};

// ── 50 ticket sprite variants (13×7 rectangular) ──
export const TICKET_W = 13, TICKET_H = 7;

// prettier-ignore
const TICKET_VARIANTS = [
  // ── Group 1: Solid Color Coupons (0–9) ──
  { name: 'Green Coupon', data: [
    'g.g.g.g.g.g.g',
    'gEEEEEEEEEEEg',
    'gEWWEEEEEWWEg',
    '.EEEEEEEEEEE.',
    'gEWWEEEEEWWEg',
    'gEEEEEEEEEEEg',
    'g.g.g.g.g.g.g',
  ]},
  { name: 'Gold Coupon', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGGGGGY',
    'YGGWGGGGGWGGY',
    '.GGGGGGGGGGG.',
    'YGGWGGGGGWGGY',
    'YGGGGGGGGGGGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Red Admit', data: [
    'r.r.r.r.r.r.r',
    'rRRRRRRRRRRRr',
    'rRWRRRRRRRWRr',
    '.RRRRRRRRRRR.',
    'rRWRRRRRRRWRr',
    'rRRRRRRRRRRRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Blue Pass', data: [
    'b.b.b.b.b.b.b',
    'bBBBBBBBBBBBb',
    'bBWBBBBBBWBBb',
    '.BBBBBBBBBBB.',
    'bBWBBBBBBWBBb',
    'bBBBBBBBBBBBb',
    'b.b.b.b.b.b.b',
  ]},
  { name: 'Purple VIP', data: [
    'p.p.p.p.p.p.p',
    'pPPPPPPPPPPPp',
    'pPWPPPPPPWPPp',
    '.PPPPPPPPPPP.',
    'pPWPPPPPPWPPp',
    'pPPPPPPPPPPPp',
    'p.p.p.p.p.p.p',
  ]},
  { name: 'Cyan Coupon', data: [
    'c.c.c.c.c.c.c',
    'cCCCCCCCCCCCc',
    'cCWCCCCCCWCCc',
    '.CCCCCCCCCCC.',
    'cCWCCCCCCWCCc',
    'cCCCCCCCCCCCc',
    'c.c.c.c.c.c.c',
  ]},
  { name: 'Neon Pink', data: [
    'K.K.K.K.K.K.K',
    'KNNNNNNNNNNNK',
    'KNWNNNNNNWNNK',
    '.NNNNNNNNNNN.',
    'KNWNNNNNNWNNK',
    'KNNNNNNNNNNNK',
    'K.K.K.K.K.K.K',
  ]},
  { name: 'White Slip', data: [
    'D.D.D.D.D.D.D',
    'DWWWWWWWWWWWD',
    'DWLWWWWWWLWWD',
    '.WWWWWWWWWWW.',
    'DWLWWWWWWLWWD',
    'DWWWWWWWWWWWD',
    'D.D.D.D.D.D.D',
  ]},
  { name: 'Dark Token', data: [
    'K.K.K.K.K.K.K',
    'KDDDDDDDDDDDK',
    'KDWDDDDDDWDDK',
    '.DDDDDDDDDDD.',
    'KDWDDDDDDWDDK',
    'KDDDDDDDDDDDK',
    'K.K.K.K.K.K.K',
  ]},
  { name: 'Silver Card', data: [
    'D.D.D.D.D.D.D',
    'DLLLLLLLLLLLD',
    'DLWLLLLLLWLLD',
    '.LLLLLLLLLLL.',
    'DLWLLLLLLWLLD',
    'DLLLLLLLLLLLD',
    'D.D.D.D.D.D.D',
  ]},

  // ── Group 2: Patterned Coupons (10–19) ──
  { name: 'Striped Gold', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGWGWGWGWGWGY',
    'YGGGGGGGGGGGY',
    '.GWGWGWGWGWG.',
    'YGGGGGGGGGGGY',
    'YGWGWGWGWGWGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Striped Red', data: [
    'r.r.r.r.r.r.r',
    'rRWRWRWRWRWRr',
    'rRRRRRRRRRRRr',
    '.RWRWRWRWRWR.',
    'rRRRRRRRRRRRr',
    'rRWRWRWRWRWRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Checkered', data: [
    'b.b.b.b.b.b.b',
    'bBWBWBWBWBWBb',
    'bWBWBWBWBWBWb',
    '.BWBWBWBWBWB.',
    'bWBWBWBWBWBWb',
    'bBWBWBWBWBWBb',
    'b.b.b.b.b.b.b',
  ]},
  { name: 'Diamond', data: [
    'g.g.g.g.g.g.g',
    'gEEEEEWEEEEEg',
    'gEEEEWEWEEEEg',
    '.EEEWEEEWEEE.',
    'gEEEEWEWEEEEg',
    'gEEEEEWEEEEEg',
    'g.g.g.g.g.g.g',
  ]},
  { name: 'Zigzag', data: [
    'p.p.p.p.p.p.p',
    'pPWPPWPPWPPPp',
    'pPPWPPWPPWPPp',
    '.PPPPPPPPPPP.',
    'pPPWPPWPPWPPp',
    'pPWPPWPPWPPPp',
    'p.p.p.p.p.p.p',
  ]},
  { name: 'Dotted', data: [
    'c.c.c.c.c.c.c',
    'cCCCCCCCCCCCc',
    'cCWCCWCCWCCCc',
    '.CCCCCCCCCCC.',
    'cCCWCCWCCWCCc',
    'cCCCCCCCCCCCc',
    'c.c.c.c.c.c.c',
  ]},
  { name: 'Gradient', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YWWWWWWWWWWWY',
    'YGGGGGGGGGGGY',
    '.GGGGGGGGGGG.',
    'YGGGGGGGGGGGY',
    'YYYYYYYYYYYYY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Double Frame', data: [
    'r.r.r.r.r.r.r',
    'rRRRRRRRRRRRr',
    'rRrrrrrrrrrRr',
    '.RrRRRRRRRrR.',
    'rRrrrrrrrrrRr',
    'rRRRRRRRRRRRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Wavy Blue', data: [
    'b.b.b.b.b.b.b',
    'bBBBBBBBBBBBb',
    'bBWBBBWBBBWBb',
    '.BBWBBBWBBBB.',
    'bBBBWBBBWBBBb',
    'bBBBBBBBBBBBb',
    'b.b.b.b.b.b.b',
  ]},
  { name: 'Crosshatch', data: [
    'g.g.g.g.g.g.g',
    'gEWEWEWEWEWEg',
    'gWEWEWEWEWEWg',
    '.EWEWEWEWEWE.',
    'gWEWEWEWEWEWg',
    'gEWEWEWEWEWEg',
    'g.g.g.g.g.g.g',
  ]},

  // ── Group 3: Emblem Coupons (20–29) ──
  { name: 'Heart Coupon', data: [
    'r.r.r.r.r.r.r',
    'rRRRRRRRRRRRr',
    'rRRWRRRWRRRRr',
    '.RRWWWWWRRRR.',
    'rRRRWWWRRRRRr',
    'rRRRRWRRRRRRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Crown Pass', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGGGGGY',
    'YGWGWGWGGGGGY',
    '.GGGGGGGGGGG.',
    'YGGWWWWWGGGGY',
    'YGGGGGGGGGGGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Star Card', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGGGGGY',
    'YGGGGGWGGGGGY',
    '.GGGWWWWGGGG.',
    'YGGGGGWGGGGGY',
    'YGGGWGWGGGGGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Skull Pass', data: [
    'K.K.K.K.K.K.K',
    'KDDDDDDDDDDDK',
    'KDDWWWWWDDDDK',
    '.DDWDWDWDDDD.',
    'KDDDWWWDDDDDK',
    'KDDDDDDDDDDDK',
    'K.K.K.K.K.K.K',
  ]},
  { name: 'Shield Badge', data: [
    'b.b.b.b.b.b.b',
    'bBWWWWWWBBBBb',
    'bBWBBBBWBBBBb',
    '.BBWBBWBBBBB.',
    'bBBBWWBBBBBBb',
    'bBBBBBBBBBBBb',
    'b.b.b.b.b.b.b',
  ]},
  { name: 'Gem Coupon', data: [
    'p.p.p.p.p.p.p',
    'pPPPPPPPPPPPp',
    'pPPPPWPPPPPPp',
    '.PPPWWWPPPPP.',
    'pPPPPWPPPPPPp',
    'pPPPPPPPPPPPp',
    'p.p.p.p.p.p.p',
  ]},
  { name: 'Flame Pass', data: [
    'r.r.r.r.r.r.r',
    'rRRRRGRRRRRRr',
    'rRRRGGGRRRRRr',
    '.RRGGWGGRRRR.',
    'rRRRGGGRRRRRr',
    'rRRRRRRRRRRRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Moon Coupon', data: [
    'K.K.K.K.K.K.K',
    'KDDDDDDDDDDDK',
    'KDDDWWDDDDDDK',
    '.DDWDDWDDDDD.',
    'KDDDWWDDDDDDK',
    'KDDDDDDDDDDDK',
    'K.K.K.K.K.K.K',
  ]},
  { name: 'Sun Voucher', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGGGGGY',
    'YGGGWGWGGGGGY',
    '.GGGGGWGGGGG.',
    'YGGGWGWGGGGGY',
    'YGGGGGGGGGGGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Eye Token', data: [
    'p.p.p.p.p.p.p',
    'pPPPPPPPPPPPp',
    'pPPPDDDPPPPPp',
    '.PPDBKBDPPPP.',
    'pPPPDDDPPPPPp',
    'pPPPPPPPPPPPp',
    'p.p.p.p.p.p.p',
  ]},

  // ── Group 4: Stub Coupons (30–39) ──
  { name: 'Lottery Green', data: [
    'g.g.g.g.g.g.g',
    'gEEEEEEEg.EEg',
    'gEWEEEWEg.EEg',
    '.EEEEEEEg.EE.',
    'gEWEEEWEg.EEg',
    'gEEEEEEEg.EEg',
    'g.g.g.g.g.g.g',
  ]},
  { name: 'Raffle Gold', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGY.GGY',
    'YGWGGWGGY.GGY',
    '.GGGGGGGY.GG.',
    'YGWGGWGGY.GGY',
    'YGGGGGGGY.GGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Admit One', data: [
    'r.r.r.r.r.r.r',
    'rRRRRRRRr.RRr',
    'rRWWWWWRr.RRr',
    '.RRRRRRRr.RR.',
    'rRWWWWWRr.RRr',
    'rRRRRRRRr.RRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Cinema Blue', data: [
    'b.b.b.b.b.b.b',
    'bBBBBBBBb.BBb',
    'bBWBBBWBb.BBb',
    '.BBBBBBBb.BB.',
    'bBWBBBWBb.BBb',
    'bBBBBBBBb.BBb',
    'b.b.b.b.b.b.b',
  ]},
  { name: 'Event Pass', data: [
    'p.p.p.p.p.p.p',
    'pPPPPPPPp.PPp',
    'pPWPPPWPp.PPp',
    '.PPPPPPPp.PP.',
    'pPWPPPWPp.PPp',
    'pPPPPPPPp.PPp',
    'p.p.p.p.p.p.p',
  ]},
  { name: 'Transit Card', data: [
    'c.c.c.c.c.c.c',
    'cCCCCCCCc.CCc',
    'cCWCCCWCc.CCc',
    '.CCCCCCCc.CC.',
    'cCWCCCWCc.CCc',
    'cCCCCCCCc.CCc',
    'c.c.c.c.c.c.c',
  ]},
  { name: 'Meal Coupon', data: [
    'K.K.K.K.K.K.K',
    'KNNNNNNNK.NNK',
    'KNWNNNWNK.NNK',
    '.NNNNNNNK.NN.',
    'KNWNNNWNK.NNK',
    'KNNNNNNNK.NNK',
    'K.K.K.K.K.K.K',
  ]},
  { name: 'Prize Slip', data: [
    'D.D.D.D.D.D.D',
    'DWWWWWWWD.WWD',
    'DWLWWWLWD.WWD',
    '.WWWWWWWD.WW.',
    'DWLWWWLWD.WWD',
    'DWWWWWWWD.WWD',
    'D.D.D.D.D.D.D',
  ]},
  { name: 'Lucky Draw', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YGGGGGGGG.GGY',
    'YGWGWGWGG.GGY',
    '.GGGGGGGG.GG.',
    'YGGWGWGGG.GGY',
    'YGGGGGGGG.GGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Jackpot Stub', data: [
    'r.r.r.r.r.r.r',
    'rRRRRRRRr.RRr',
    'rRGGGGGRr.RRr',
    '.RRRRRRRr.RR.',
    'rRGGGGGRr.RRr',
    'rRRRRRRRr.RRr',
    'r.r.r.r.r.r.r',
  ]},

  // ── Group 5: Special Coupons (40–49) ──
  { name: 'Rainbow', data: [
    'R.R.R.R.R.R.R',
    'RRGGGGGGGGGRR',
    'GGEEEEEEEEEGG',
    '.EBBBBBBBBBE.',
    'BBPPPPPPPPPBB',
    'PPNNNNNNNNNPP',
    'P.P.P.P.P.P.P',
  ]},
  { name: 'Void Coupon', data: [
    'p.p.p.p.p.p.p',
    'pPPpPPpPPpPPp',
    'pPpPPPPPpPPPp',
    '.PPPPWPPPPPP.',
    'pPPpPPPPpPPPp',
    'pPPPpPPpPPPPp',
    'p.p.p.p.p.p.p',
  ]},
  { name: 'Phoenix Card', data: [
    'r.r.r.r.r.r.r',
    'rRRRGGGRRRRRr',
    'rRRGGWGGRRRRr',
    '.RGGGGGGGRRR.',
    'rRRRGGGRRRRRr',
    'rRRRRGRRRRRRr',
    'r.r.r.r.r.r.r',
  ]},
  { name: 'Rune Tablet', data: [
    'c.c.c.c.c.c.c',
    'cCCCCCCCCCCCc',
    'cCWCWCCWCWCCc',
    '.CCWCCCCWCCC.',
    'cCWCWCCWCWCCc',
    'cCCCCCCCCCCCc',
    'c.c.c.c.c.c.c',
  ]},
  { name: 'Cosmic Pass', data: [
    '1.1.1.1.1.1.1',
    '1222222222221',
    '12W222W22W221',
    '.22222222222.',
    '122W222222W21',
    '1222222222221',
    '1.1.1.1.1.1.1',
  ]},
  { name: 'Toxic Coupon', data: [
    'g.g.g.g.g.g.g',
    'gEEEEEEEEEEEg',
    'gEEKEKEEEEEEg',
    '.EEEEEEEEEEE.',
    'gEEEKEEEEEEEg',
    'gEEEEEEEEEEEg',
    'g.g.g.g.g.g.g',
  ]},
  { name: 'Electric', data: [
    'c.c.c.c.c.c.c',
    'cCCCCGGCCCCCc',
    'cCCCGGCCCCCCc',
    '.CCGGGGGCCCC.',
    'cCCCCGGCCCCCc',
    'cCCCGGCCCCCCc',
    'c.c.c.c.c.c.c',
  ]},
  { name: 'Ancient Scroll', data: [
    'Y.Y.Y.Y.Y.Y.Y',
    'YYGYYYYYYYYGY',
    'YGGGGGGGGGGGY',
    '.GGWGGGWGGGG.',
    'YGGGGGGGGGGGY',
    'YYGYYYYYYYYGY',
    'Y.Y.Y.Y.Y.Y.Y',
  ]},
  { name: 'Royal Decree', data: [
    'G.G.G.G.G.G.G',
    'GGGGGGGGGGGGG',
    'GGWWGGGGGWWGG',
    '.GGGGGGGGGGG.',
    'GGWWGGGGGWWGG',
    'GGGGGGGGGGGGG',
    'G.G.G.G.G.G.G',
  ]},
  { name: 'Prismatic', data: [
    'R.R.G.G.E.B.B',
    'RRRGGGEEEBBBC',
    'RRRGGGEEEBBBC',
    '.NNPPPYYYRRR.',
    'NNNPPPYYYRRRC',
    'NNNPPPYYYRRRC',
    'N.N.P.P.Y.R.C',
  ]},
];

let _activeTicketIdx = 0;

/** Get array of all ticket variant metadata (for selection screen) */
export function getTicketVariants() { return TICKET_VARIANTS; }

/** Get current active ticket index */
export function getActiveTicketIdx() { return _activeTicketIdx; }

/** Set the active ticket variant by index — updates SPRITES.ticket and clears cache */
export function setActiveTicket(idx) {
  if (idx < 0 || idx >= TICKET_VARIANTS.length) return;
  _activeTicketIdx = idx;
  SPRITES.ticket = TICKET_VARIANTS[idx].data;
  _cache.delete('ticket');
}

// Pre-render each sprite to an offscreen canvas for fast blitting
const _cache = new Map();

function _render(id) {
  if (_cache.has(id)) return _cache.get(id);
  const data = SPRITES[id];
  if (!data) return null;

  const h = data.length;
  const w = data[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  for (let y = 0; y < h; y++) {
    const row = data[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = COLOR_KEY[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  _cache.set(id, c);
  return c;
}

/**
 * Draw a symbol sprite onto ctx at (dx, dy) with given pixel scale.
 */
export function drawSprite(ctx, symbolId, dx, dy, scale = 1) {
  const src = _render(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, src.width * scale, src.height * scale);
}

/**
 * Draw sprite centered at (cx, cy).
 */
export function drawSpriteCentered(ctx, symbolId, cx, cy, scale = 1) {
  const src = _render(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const hw = (src.width * scale) / 2;
  const hh = (src.height * scale) / 2;
  ctx.drawImage(src, 0, 0, src.width, src.height, Math.round(cx - hw), Math.round(cy - hh), src.width * scale, src.height * scale);
}

export const SPRITE_SIZE = SIZE;

/**
 * Render a ticket variant by index (for grid preview).
 * Uses separate cache so main cache stays clean.
 */
const _variantCache = new Map();

export function drawTicketVariant(ctx, idx, dx, dy, scale = 1) {
  const v = TICKET_VARIANTS[idx];
  if (!v) return;
  let src = _variantCache.get(idx);
  if (!src) {
    src = document.createElement('canvas');
    src.width = TICKET_W;
    src.height = TICKET_H;
    const sctx = src.getContext('2d');
    for (let y = 0; y < TICKET_H; y++) {
      const row = v.data[y];
      for (let x = 0; x < TICKET_W; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const col = COLOR_KEY[ch];
        if (col) { sctx.fillStyle = col; sctx.fillRect(x, y, 1, 1); }
      }
    }
    _variantCache.set(idx, src);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, TICKET_W, TICKET_H, dx, dy, TICKET_W * scale, TICKET_H * scale);
}

export function drawTicketVariantCentered(ctx, idx, cx, cy, scale = 1) {
  const hw = (TICKET_W * scale) / 2;
  const hh = (TICKET_H * scale) / 2;
  drawTicketVariant(ctx, idx, Math.round(cx - hw), Math.round(cy - hh), scale);
}

// ═══ Animated sprites (multi-frame) ═══

// prettier-ignore
const ANIM_SPRITES = {
  coin: [
    [ // Frame 0: full face
      '...KKK...',
      '..KWGGK..',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '..KYYYK..',
      '...KKK...',
      '.........',
    ],
    [ // Frame 1: face cropped 1px each side
      '....K....',
      '...KWK...',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '...KYK...',
      '....K....',
      '.........',
    ],
    [ // Frame 2: edge
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '.........',
    ],
    [ // Frame 3: face cropped 1px each side
      '....K....',
      '...KWK...',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '...KYK...',
      '....K....',
      '.........',
    ],
  ],
};

const _animCache = new Map();

function _renderAnimFrame(id, frame) {
  const key = id + '_' + frame;
  if (_animCache.has(key)) return _animCache.get(key);
  const frames = ANIM_SPRITES[id];
  if (!frames || !frames[frame]) return null;
  const data = frames[frame];
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  for (let y = 0; y < SIZE; y++) {
    const row = data[y];
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = COLOR_KEY[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  _animCache.set(key, c);
  return c;
}

/**
 * Draw an animated sprite centered at (cx, cy).
 * @param {string} id  'coin'
 * @param {number} time  game time in seconds (picks frame)
 * @param {number} fps  animation speed (default 6)
 */
export function drawAnimSpriteCentered(ctx, id, cx, cy, scale = 1, time = 0, fps = 6) {
  const frames = ANIM_SPRITES[id];
  if (!frames) return;
  const frame = Math.floor(time * fps) % frames.length;
  const src = _renderAnimFrame(id, frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

/**
 * Draw a specific frame of an animated sprite centered at (cx, cy).
 */
export function drawAnimFrameCentered(ctx, id, frame, cx, cy, scale = 1) {
  const src = _renderAnimFrame(id, frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

export function getAnimFrameCount(id) {
  return ANIM_SPRITES[id]?.length ?? 0;
}
