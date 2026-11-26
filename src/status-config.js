/**
 * Centralized configuration for enemy status effects.
 * Adjust durations, damage percentages, minimum/static damage, and multipliers here
 * without modifying combat status-processing logic.
 */

// Burn (Brûlure)
export const BURN_DURATION = 3;
export const BURN_DMG_PERCENT = 0.08;
export const BURN_MIN_DMG = 3;
export const BURN_DMG = null; // Set a number (e.g. 6) to use static damage instead of percentage-based damage.

// Poison (Poison)
export const POISON_DURATION = 4;
export const POISON_DMG_PERCENT = 0.06;
export const POISON_MIN_DMG = 2;
export const POISON_DMG = null; // Set a number (e.g. 5) to use static damage instead of percentage-based damage.

// Stun (Étourdissement)
export const STUN_DURATION = 1;

// Slow (Ralentissement)
export const SLOW_DURATION = 2;
export const SLOW_DAMAGE_MULTIPLIER = 0.75;
export const SLOW_SPEED_MULTIPLIER = 0.5;

// DefenseDown (Défense réduite)
export const DEFENSE_DOWN_DURATION = 2;
export const DEFENSE_DOWN_DAMAGE_MULTIPLIER = 1.25;
export const DEFENSE_DOWN_DEFENSE_MULTIPLIER = 0.5;

// Player buffs — Guard (Protection)
export const GUARD_DURATION = 1;
export const GUARD_DAMAGE_MULTIPLIER = 0.55;

export const PLAYER_STATUS_EFFECTS = {
  guard: {
    duration: GUARD_DURATION,
    damageMultiplier: GUARD_DAMAGE_MULTIPLIER,
    appliedOnPlayerPhase: true
  }
};

export const ENEMY_STATUS_EFFECTS = {
  burn: {
    duration: BURN_DURATION,
    damage: BURN_DMG,
    damagePercent: BURN_DMG_PERCENT,
    minDamage: BURN_MIN_DMG,
    preventsAction: false
  },
  poison: {
    duration: POISON_DURATION,
    damage: POISON_DMG,
    damagePercent: POISON_DMG_PERCENT,
    minDamage: POISON_MIN_DMG,
    preventsAction: false
  },
  stun: {
    duration: STUN_DURATION,
    preventsAction: true
  },
  slow: {
    duration: SLOW_DURATION,
    damageMultiplier: SLOW_DAMAGE_MULTIPLIER,
    speedMultiplier: SLOW_SPEED_MULTIPLIER,
    preventsAction: false
  },
  defenseDown: {
    duration: DEFENSE_DOWN_DURATION,
    damageMultiplier: DEFENSE_DOWN_DAMAGE_MULTIPLIER,
    defenseMultiplier: DEFENSE_DOWN_DEFENSE_MULTIPLIER,
    appliedOnPlayerPhase: true,
    preventsAction: false
  }
};
