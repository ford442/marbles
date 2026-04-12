/**
 * Deterministic pseudo-random number generator for consistent noise
 */
export class SeededRandom {
  private seed: number;
  private current: number;

  constructor(seed: number = 1337) {
    this.seed = seed;
    this.current = seed;
  }

  /**
   * Get next random number in [0, 1)
   */
  next(): number {
    // Xorshift algorithm
    this.current ^= this.current << 13;
    this.current ^= this.current >>> 17;
    this.current ^= this.current << 5;
    return ((this.current >>> 0) / 4294967296);
  }

  /**
   * Get next random number in [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Reset to initial seed
   */
  reset(): void {
    this.current = this.seed;
  }

  /**
   * Generate random 2D gradient vector
   */
  gradient2D(): [number, number] {
    const angle = this.next() * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  }

  /**
   * Generate random 3D gradient vector
   */
  gradient3D(): [number, number, number] {
    const theta = this.next() * Math.PI * 2;
    const phi = Math.acos(2 * this.next() - 1);
    return [
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ];
  }
}
