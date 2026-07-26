export class HUDManager {
    abilityElements: Map<string, HTMLElement>;
    markAbilityUsed(abilityId: string): void;
    updateAbilityCooldown(abilityId: string, progress: number, active?: boolean): void;
}
