/**
 * Wheel upgrades — permanent rim upgrades that boost scoring.
 *
 * @typedef {object} WheelUpgradeDef
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity
 * @property {number} cost
 * @property {string} effect — effect key used by GameLoop
 */

/** @type {WheelUpgradeDef[]} */
export const WHEEL_UPGRADES = [
  { id: 'upgrade_value_plus2', name: 'Amplificateur', emoji: '🔺', description: '+2 à toutes les valeurs pendant le décompte', rarity: 'common', cost: 35, effect: 'value_plus_2' },
];

export const WHEEL_UPGRADE_MAP = new Map(WHEEL_UPGRADES.map(u => [u.id, u]));
