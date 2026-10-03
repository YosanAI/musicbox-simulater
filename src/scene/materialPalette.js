import { toLinearColor } from '../rendering/color.js';
import { woodTexture, plaque, barrelLabel } from './proceduralTextures.js';
/** Original colors, roughness, metal response and engraved textures. */
export function createMaterialPalette(renderer) {
  return {
    brass: {
      name: 'brass',
      color: toLinearColor('#cbb46f'),
      metal: .90,
      rough: .30,
      type: 2
    },
    gold: {
      name: 'gold',
      color: toLinearColor('#e8cc7d'),
      metal: .94,
      rough: .22,
      type: 2
    },
    edge: {
      name: 'edge',
      color: toLinearColor('#b48c40'),
      metal: .85,
      rough: .29,
      type: 2
    },
    steel: {
      name: 'steel',
      color: toLinearColor('#adaca3'),
      metal: .88,
      rough: .36,
      type: 3
    },
    darkSteel: {
      name: 'darkSteel',
      color: toLinearColor('#59584f'),
      metal: .79,
      rough: .4,
      type: 3
    },
    black: {
      name: 'black',
      color: toLinearColor('#282522'),
      metal: .45,
      rough: .45,
      type: 0
    },
    wood: {
      name: 'wood',
      color: [1, 1, 1],
      metal: .0,
      rough: .29,
      type: 1,
      texture: woodTexture(renderer)
    },
    woodDark: {
      name: 'woodDark',
      color: toLinearColor('#713c20'),
      metal: 0,
      rough: .39,
      type: 1
    },
    label: {
      name: 'label',
      color: [1, 1, 1],
      metal: .38,
      rough: .4,
      type: 0,
      texture: plaque(renderer, 'REUGE  ♫  MUSIC', 'SAINTE-CROIX  ·  SWITZERLAND')
    },
    barrelLabel: {
      name: 'barrelLabel',
      color: [1, 1, 1],
      metal: .48,
      rough: .38,
      type: 0,
      texture: barrelLabel(renderer)
    }
  };
}
