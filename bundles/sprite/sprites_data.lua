-- sprites_data.lua
-- Responsabilités :
--   * Agrégateur — charge chaque sprite depuis son fichier individuel.
--   * Structure exposée identique à l'ancienne version monolithique :
--       M.PALETTE, M.SPRITES, M.ANIM_SPRITES, M.MONO_ICONS
--   * Fichiers individuels :
--       bundles/sprite/sprites/<name>.lua  → return { rows = {...} }
--       bundles/sprite/anims/<name>.lua    → return { frames = {...} }
--       bundles/sprite/icons/<name>.lua    → return { row1, row2, ... }

local M = {}

M.PALETTE = nil

M.SPRITES = {
    red              = require('bundles.sprite.sprites.red'),
    blue             = require('bundles.sprite.sprites.blue'),
    ball             = require('bundles.sprite.sprites.ball'),
    relic_common     = require('bundles.sprite.sprites.relic_common'),
    relic_uncommon   = require('bundles.sprite.sprites.relic_uncommon'),
    relic_rare       = require('bundles.sprite.sprites.relic_rare'),
    relic_legendary  = require('bundles.sprite.sprites.relic_legendary'),
    anvil            = require('bundles.sprite.sprites.anvil'),
    reroll           = require('bundles.sprite.sprites.reroll'),
    arrow_right      = require('bundles.sprite.sprites.arrow_right'),
    ticket           = require('bundles.sprite.sprites.ticket'),
    skull            = require('bundles.sprite.sprites.skull'),
    cursor_default   = require('bundles.sprite.sprites.cursor_default'),
    cursor_pointer   = require('bundles.sprite.sprites.cursor_pointer'),
}

M.ANIM_SPRITES = {
    coin = require('bundles.sprite.anims.coin'),
}

M.MONO_ICONS = {
    gear  = require('bundles.sprite.icons.gear'),
    exit  = require('bundles.sprite.icons.exit'),
    book  = require('bundles.sprite.icons.book'),
    brush = require('bundles.sprite.icons.brush'),
    retry = require('bundles.sprite.icons.retry'),
}

return M
