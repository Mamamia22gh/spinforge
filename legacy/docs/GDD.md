# 🎰 SPINFORGE — Game Design Document

## Concept
Roguelike de casino avec **roulette mystique personnalisable**.
Tu es un joueur piégé dans un casino enchanté. Tu dois battre 12 rounds de quotas croissants en plaçant des paris stratégiques sur une roue dont tu manipules les symboles, les poids et les effets.

> **Le cœur du jeu : forger ta roue pour maximiser tes gains et battre les quotas.**

## Inspiration
- **Balatro** : Jokers modifient le scoring, système de multiplicateurs empilables
- **CloverPit** : Slot machine avec poids modifiables, ambiance horreur-casino
- **Raccoin** : Physique + chaos contrôlé, builds divergents
- **Cookielike** : Production en temps réel, combos dans une grille

## Pipeline d'un round
```
Prépare tes paris → Tourne la roue → Résolution des gains →
Résultats → Choix (1/3) → Forge (shop) → Prochain round
```

## La Roue
La roue contient **12 segments** (extensible à 16 via upgrades).
Chaque segment a :
- Un **symbole** (🔴 Rouge, 🔵 Bleu, 🟡 Or, 💎 Diamant, 🌀 Void, 🃏 Joker...)
- Un **poids** (probabilité relative)
- Des **modificateurs** optionnels (x2, +bonus, chain...)

## Système de Paris
Le joueur a des **jetons de mise** (chips) à placer avant chaque spin.
Types de paris :
| Type | Condition | Payout |
|---|---|---|
| Couleur | Rouge/Bleu/Or | x2 |
| Exact | Symbole précis | x5 |
| Combo | 2 symboles consécutifs | x8 |
| Secteur | Zone de 3 segments | x3 |
| Wildcard | N'importe quel résultat | x1.2 |
| Void Bet | Le symbole Void tombe | x12 |
| Chain Bet | Même couleur 3 spins d'affilée | x15 |

## Spins par Round
Le joueur obtient **5 spins par round** (modifiable par upgrades).
Chaque spin résout tous les paris actifs.
Les gains s'accumulent → total comparé au quota à la fin du round.

## Structure d'un Run
**12 rounds.** Chaque round:
1. **Préparation** — Voir la roue, placer les paris
2. **Spins** — 5 tours de roue avec résolution
3. **Résultats** — Total vs quota
4. **Choix** — Pick 1 de 3 améliorations
5. **Forge** — Shop avec artefacts + manipulation de roue

## Scoring
```
Gain par spin = Σ (mise × payout × multiplicateurs)
Total round = Σ gains des 5 spins
Quota = BASE × GROWTH^(round-1)
Surplus → 💵 monnaie de forge
```

## Multiplicateurs (Empilables à la Balatro)
- **Artefacts** : bonus permanents au scoring
- **Symboles spéciaux** : certains symboles ont des effets au-delà du payout
- **Streak bonus** : toucher le même pari 3× = bonus
- **Fever** : 5 gains consécutifs = mode Fever (x1.5 pendant 3 spins)

## Archétypes de Build
- **Le Précis** : roue épurée, paris exacts, gros payouts
- **Le Diversifié** : roue large, paris secteur/couleur, gains réguliers
- **Le Chaotique** : symboles Void/Joker, chain bets, all-in
- **Le Forgeron** : artefacts meta-level, multiplicateurs exponentiels

## Méta-progression
Étoiles ⭐ gagnées chaque run → débloquent nouveaux symboles, types de paris, artefacts dans le pool.

## Ambiance 3D
Casino souterrain surnaturel. Table de roulette au centre, roue physique qui tourne avec particules.
Éclairage néon violet/or. Brouillard au sol. Dealer fantôme en face.
