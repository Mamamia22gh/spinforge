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
  // ── Group 1: Solid Color Tickets (0–9) ──
  { name: 'Green Ticket', data: [
    '.ggggggggggg.',
    'gEEEEEEEEEEEg',
    'gEWWEEEEEWWEg',
    'gEEEEEEEEEEEg',
    'gEWWEEEEEWWEg',
    'gEEEEEEEEEEEg',
    '.ggggggggggg.',
  ]},
  { name: 'Gold Ticket', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGGGGGY',
    'YGGWGGGGGWGGY',
    'YGGGGGGGGGGGY',
    'YGGWGGGGGWGGY',
    'YGGGGGGGGGGGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Red Admit', data: [
    '.rrrrrrrrrrr.',
    'rRRRRRRRRRRRr',
    'rRWRRRRRRRWRr',
    'rRRRRRRRRRRRr',
    'rRWRRRRRRRWRr',
    'rRRRRRRRRRRRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Blue Pass', data: [
    '.bbbbbbbbbbb.',
    'bBBBBBBBBBBBb',
    'bBWBBBBBBWBBb',
    'bBBBBBBBBBBBb',
    'bBWBBBBBBWBBb',
    'bBBBBBBBBBBBb',
    '.bbbbbbbbbbb.',
  ]},
  { name: 'Purple VIP', data: [
    '.ppppppppppp.',
    'pPPPPPPPPPPPp',
    'pPWPPPPPPWPPp',
    'pPPPPPPPPPPPp',
    'pPWPPPPPPWPPp',
    'pPPPPPPPPPPPp',
    '.ppppppppppp.',
  ]},
  { name: 'Cyan Coupon', data: [
    '.ccccccccccc.',
    'cCCCCCCCCCCCc',
    'cCWCCCCCCWCCc',
    'cCCCCCCCCCCCc',
    'cCWCCCCCCWCCc',
    'cCCCCCCCCCCCc',
    '.ccccccccccc.',
  ]},
  { name: 'Neon Pink', data: [
    '.KKKKKKKKKKK.',
    'KNNNNNNNNNNNK',
    'KNWNNNNNNWNNK',
    'KNNNNNNNNNNNK',
    'KNWNNNNNNWNNK',
    'KNNNNNNNNNNNK',
    '.KKKKKKKKKKK.',
  ]},
  { name: 'White Slip', data: [
    '.DDDDDDDDDDD.',
    'DWWWWWWWWWWWD',
    'DWLWWWWWWLWWD',
    'DWWWWWWWWWWWD',
    'DWLWWWWWWLWWD',
    'DWWWWWWWWWWWD',
    '.DDDDDDDDDDD.',
  ]},
  { name: 'Dark Token', data: [
    '.KKKKKKKKKKK.',
    'KDDDDDDDDDDDK',
    'KDWDDDDDDWDDK',
    'KDDDDDDDDDDDK',
    'KDWDDDDDDWDDK',
    'KDDDDDDDDDDDK',
    '.KKKKKKKKKKK.',
  ]},
  { name: 'Silver Card', data: [
    '.DDDDDDDDDDD.',
    'DLLLLLLLLLLLD',
    'DLWLLLLLLWLLD',
    'DLLLLLLLLLLLD',
    'DLWLLLLLLWLLD',
    'DLLLLLLLLLLLD',
    '.DDDDDDDDDDD.',
  ]},

  // ── Group 2: Patterned Tickets (10–19) ──
  { name: 'Striped Gold', data: [
    '.YYYYYYYYYYY.',
    'YGWGWGWGWGWGY',
    'YGGGGGGGGGGGY',
    'YGWGWGWGWGWGY',
    'YGGGGGGGGGGGY',
    'YGWGWGWGWGWGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Striped Red', data: [
    '.rrrrrrrrrrr.',
    'rRWRWRWRWRWRr',
    'rRRRRRRRRRRRr',
    'rRWRWRWRWRWRr',
    'rRRRRRRRRRRRr',
    'rRWRWRWRWRWRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Checkered', data: [
    '.bbbbbbbbbbb.',
    'bBWBWBWBWBWBb',
    'bWBWBWBWBWBWb',
    'bBWBWBWBWBWBb',
    'bWBWBWBWBWBWb',
    'bBWBWBWBWBWBb',
    '.bbbbbbbbbbb.',
  ]},
  { name: 'Diamond', data: [
    '.ggggggggggg.',
    'gEEEEEWEEEEEg',
    'gEEEEWEWEEEEg',
    'gEEEWEEEWEEEg',
    'gEEEEWEWEEEEg',
    'gEEEEEWEEEEEg',
    '.ggggggggggg.',
  ]},
  { name: 'Zigzag', data: [
    '.ppppppppppp.',
    'pPWPPWPPWPPPp',
    'pPPWPPWPPWPPp',
    'pPPPPPPPPPPPp',
    'pPPWPPWPPWPPp',
    'pPWPPWPPWPPPp',
    '.ppppppppppp.',
  ]},
  { name: 'Dotted', data: [
    '.ccccccccccc.',
    'cCCCCCCCCCCCc',
    'cCWCCWCCWCCCc',
    'cCCCCCCCCCCCc',
    'cCCWCCWCCWCCc',
    'cCCCCCCCCCCCc',
    '.ccccccccccc.',
  ]},
  { name: 'Gradient', data: [
    '.YYYYYYYYYYY.',
    'YWWWWWWWWWWWY',
    'YGGGGGGGGGGGY',
    'YGGGGGGGGGGGY',
    'YGGGGGGGGGGGY',
    'YYYYYYYYYYYYY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Double Frame', data: [
    '.rrrrrrrrrrr.',
    'rRRRRRRRRRRRr',
    'rRrrrrrrrrrRr',
    'rRrRRRRRRRrRr',
    'rRrrrrrrrrrRr',
    'rRRRRRRRRRRRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Wavy Blue', data: [
    '.bbbbbbbbbbb.',
    'bBBBBBBBBBBBb',
    'bBWBBBWBBBWBb',
    'bBBWBBBWBBBBb',
    'bBBBWBBBWBBBb',
    'bBBBBBBBBBBBb',
    '.bbbbbbbbbbb.',
  ]},
  { name: 'Crosshatch', data: [
    '.ggggggggggg.',
    'gEWEWEWEWEWEg',
    'gWEWEWEWEWEWg',
    'gEWEWEWEWEWEg',
    'gWEWEWEWEWEWg',
    'gEWEWEWEWEWEg',
    '.ggggggggggg.',
  ]},

  // ── Group 3: Emblem Tickets (20–29) ──
  { name: 'Heart Ticket', data: [
    '.rrrrrrrrrrr.',
    'rRRRRRRRRRRRr',
    'rRRWRRRWRRRRr',
    'rRRWWWWWRRRRr',
    'rRRRWWWRRRRRr',
    'rRRRRWRRRRRRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Crown Pass', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGGGGGY',
    'YGWGWGWGGGGGY',
    'YGGGGGGGGGGGY',
    'YGGWWWWWGGGGY',
    'YGGGGGGGGGGGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Star Card', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGGGGGY',
    'YGGGGGWGGGGGY',
    'YGGGWWWWGGGGY',
    'YGGGGGWGGGGGY',
    'YGGGWGWGGGGGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Skull Pass', data: [
    '.KKKKKKKKKKK.',
    'KDDDDDDDDDDDK',
    'KDDWWWWWDDDDK',
    'KDDWDWDWDDDDK',
    'KDDDWWWDDDDDK',
    'KDDDDDDDDDDDK',
    '.KKKKKKKKKKK.',
  ]},
  { name: 'Shield Badge', data: [
    '.bbbbbbbbbbb.',
    'bBWWWWWWBBBBb',
    'bBWBBBBWBBBBb',
    'bBBWBBWBBBBBb',
    'bBBBWWBBBBBBb',
    'bBBBBBBBBBBBb',
    '.bbbbbbbbbbb.',
  ]},
  { name: 'Gem Coupon', data: [
    '.ppppppppppp.',
    'pPPPPPPPPPPPp',
    'pPPPPWPPPPPPp',
    'pPPPWWWPPPPPp',
    'pPPPPWPPPPPPp',
    'pPPPPPPPPPPPp',
    '.ppppppppppp.',
  ]},
  { name: 'Flame Pass', data: [
    '.rrrrrrrrrrr.',
    'rRRRRGRRRRRRr',
    'rRRRGGGRRRRRr',
    'rRRGGWGGRRRRr',
    'rRRRGGGRRRRRr',
    'rRRRRRRRRRRRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Moon Ticket', data: [
    '.KKKKKKKKKKK.',
    'KDDDDDDDDDDDK',
    'KDDDWWDDDDDDK',
    'KDDWDDWDDDDDK',
    'KDDDWWDDDDDDK',
    'KDDDDDDDDDDDK',
    '.KKKKKKKKKKK.',
  ]},
  { name: 'Sun Voucher', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGGGGGY',
    'YGGGWGWGGGGGY',
    'YGGGGGWGGGGGY',
    'YGGGWGWGGGGGY',
    'YGGGGGGGGGGGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Eye Token', data: [
    '.ppppppppppp.',
    'pPPPPPPPPPPPp',
    'pPPPDDDPPPPPp',
    'pPPDBKBDPPPPp',
    'pPPPDDDPPPPPp',
    'pPPPPPPPPPPPp',
    '.ppppppppppp.',
  ]},

  // ── Group 4: Stub Tickets (30–39) ──
  { name: 'Lottery Green', data: [
    '.ggggggggggg.',
    'gEEEEEEEg.EEg',
    'gEWEEEWEg.EEg',
    'gEEEEEEEg.EEg',
    'gEWEEEWEg.EEg',
    'gEEEEEEEg.EEg',
    '.ggggggggggg.',
  ]},
  { name: 'Raffle Gold', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGY.GGY',
    'YGWGGWGGY.GGY',
    'YGGGGGGGY.GGY',
    'YGWGGWGGY.GGY',
    'YGGGGGGGY.GGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Admit One', data: [
    '.rrrrrrrrrrr.',
    'rRRRRRRRr.RRr',
    'rRWWWWWRr.RRr',
    'rRRRRRRRr.RRr',
    'rRWWWWWRr.RRr',
    'rRRRRRRRr.RRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Cinema Blue', data: [
    '.bbbbbbbbbbb.',
    'bBBBBBBBb.BBb',
    'bBWBBBWBb.BBb',
    'bBBBBBBBb.BBb',
    'bBWBBBWBb.BBb',
    'bBBBBBBBb.BBb',
    '.bbbbbbbbbbb.',
  ]},
  { name: 'Event Pass', data: [
    '.ppppppppppp.',
    'pPPPPPPPp.PPp',
    'pPWPPPWPp.PPp',
    'pPPPPPPPp.PPp',
    'pPWPPPWPp.PPp',
    'pPPPPPPPp.PPp',
    '.ppppppppppp.',
  ]},
  { name: 'Transit Card', data: [
    '.ccccccccccc.',
    'cCCCCCCCc.CCc',
    'cCWCCCWCc.CCc',
    'cCCCCCCCc.CCc',
    'cCWCCCWCc.CCc',
    'cCCCCCCCc.CCc',
    '.ccccccccccc.',
  ]},
  { name: 'Meal Ticket', data: [
    '.KKKKKKKKKKK.',
    'KNNNNNNNK.NNK',
    'KNWNNNWNK.NNK',
    'KNNNNNNNK.NNK',
    'KNWNNNWNK.NNK',
    'KNNNNNNNK.NNK',
    '.KKKKKKKKKKK.',
  ]},
  { name: 'Prize Slip', data: [
    '.DDDDDDDDDDD.',
    'DWWWWWWWD.WWD',
    'DWLWWWLWD.WWD',
    'DWWWWWWWD.WWD',
    'DWLWWWLWD.WWD',
    'DWWWWWWWD.WWD',
    '.DDDDDDDDDDD.',
  ]},
  { name: 'Lucky Draw', data: [
    '.YYYYYYYYYYY.',
    'YGGGGGGGG.GGY',
    'YGWGWGWGG.GGY',
    'YGGGGGGGG.GGY',
    'YGGWGWGGG.GGY',
    'YGGGGGGGG.GGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Jackpot Stub', data: [
    '.rrrrrrrrrrr.',
    'rRRRRRRRr.RRr',
    'rRGGGGGRr.RRr',
    'rRRRRRRRr.RRr',
    'rRGGGGGRr.RRr',
    'rRRRRRRRr.RRr',
    '.rrrrrrrrrrr.',
  ]},

  // ── Group 5: Special Tickets (40–49) ──
  { name: 'Rainbow', data: [
    '.RRRRRRRRRRR.',
    'RRGGGGGGGGGRR',
    'GGEEEEEEEEEGG',
    'EEBBBBBBBBBEE',
    'BBPPPPPPPPPBB',
    'PPNNNNNNNNNPP',
    '.PPPPPPPPPPP.',
  ]},
  { name: 'Void Ticket', data: [
    '.ppppppppppp.',
    'pPPpPPpPPpPPp',
    'pPpPPPPPpPPPp',
    'pPPPPWPPPPPPp',
    'pPPpPPPPpPPPp',
    'pPPPpPPpPPPPp',
    '.ppppppppppp.',
  ]},
  { name: 'Phoenix Card', data: [
    '.rrrrrrrrrrr.',
    'rRRRGGGRRRRRr',
    'rRRGGWGGRRRRr',
    'rRGGGGGGGRRRr',
    'rRRRGGGRRRRRr',
    'rRRRRGRRRRRRr',
    '.rrrrrrrrrrr.',
  ]},
  { name: 'Rune Tablet', data: [
    '.ccccccccccc.',
    'cCCCCCCCCCCCc',
    'cCWCWCCWCWCCc',
    'cCCWCCCCWCCCc',
    'cCWCWCCWCWCCc',
    'cCCCCCCCCCCCc',
    '.ccccccccccc.',
  ]},
  { name: 'Cosmic Pass', data: [
    '.11111111111.',
    '1222222222221',
    '12W222W22W221',
    '1222222222221',
    '122W222222W21',
    '1222222222221',
    '.11111111111.',
  ]},
  { name: 'Toxic Coupon', data: [
    '.ggggggggggg.',
    'gEEEEEEEEEEEg',
    'gEEKEKEEEEEEg',
    'gEEEEEEEEEEEg',
    'gEEEKEEEEEEEg',
    'gEEEEEEEEEEEg',
    '.ggggggggggg.',
  ]},
  { name: 'Electric', data: [
    '.ccccccccccc.',
    'cCCCCGGCCCCCc',
    'cCCCGGCCCCCCc',
    'cCCGGGGGCCCCc',
    'cCCCCGGCCCCCc',
    'cCCCGGCCCCCCc',
    '.ccccccccccc.',
  ]},
  { name: 'Ancient Scroll', data: [
    '.YYYYYYYYYYY.',
    'YYGYYYYYYYYGY',
    'YGGGGGGGGGGGY',
    'YGGWGGGWGGGGY',
    'YGGGGGGGGGGGY',
    'YYGYYYYYYYYGY',
    '.YYYYYYYYYYY.',
  ]},
  { name: 'Royal Decree', data: [
    '.GYGYGYGYGYG.',
    'GGGGGGGGGGGGG',
    'GGWWGGGGGWWGG',
    'GGGGGGGGGGGGG',
    'GGWWGGGGGWWGG',
    'GGGGGGGGGGGGG',
    '.GYGYGYGYGYG.',
  ]},
  { name: 'Prismatic', data: [
    '.RRGGGEEEBBB.',
    'RRRGGGEEEBBBC',
    'RRRGGGEEEBBBC',
    'NNNPPPYYYRRRN',
    'NNNPPPYYYRRRC',
    'NNNPPPYYYRRRC',
    '.NNPPPYYYRR..',
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
