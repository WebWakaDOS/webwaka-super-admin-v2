/**
 * Commission Calculator - Strict Integer Kobo (NO decimals)
 * 5-Level Affiliate Commission Hierarchy
 * 
 * Level 1: 5% of transaction
 * Level 2: 3% of Level 1 commission
 * Level 3: 2% of Level 2 commission
 * Level 4: 1% of Level 3 commission
 * Level 5: 0.5% of Level 4 commission
 * 
 * All values are in kobo (integer, NO decimals)
 */

export interface CommissionBreakdown {
  level1: number
  level2: number
  level3: number
  level4: number
  level5: number
  total: number
}

/**
 * Calculate commission for a transaction amount
 * @param transactionAmount - Amount in kobo (integer)
 * @returns Commission breakdown by level
 */
export function calculateCommission(transactionAmount: number): CommissionBreakdown {
  // Ensure input is integer kobo
  const amount = Math.floor(transactionAmount)

  // Each level earns its stated percentage of the original transaction amount
  // (not of the parent level's commission) so that all levels receive meaningful payouts.

  // Level 1: 5% of transaction
  const level1 = Math.floor(amount * 0.05)

  // Level 2: 3% of transaction
  const level2 = Math.floor(amount * 0.03)

  // Level 3: 2% of transaction
  const level3 = Math.floor(amount * 0.02)

  // Level 4: 1% of transaction
  const level4 = Math.floor(amount * 0.01)

  // Level 5: 0.5% of transaction
  const level5 = Math.floor(amount * 0.005)

  // Total commission
  const total = level1 + level2 + level3 + level4 + level5

  return {
    level1,
    level2,
    level3,
    level4,
    level5,
    total,
  }
}

/**
 * Calculate total revenue from transactions
 * @param transactions - Array of transaction amounts in kobo
 * @returns Total revenue in kobo
 */
export function calculateTotalRevenue(transactions: number[]): number {
  return transactions.reduce((sum, amount) => sum + Math.floor(amount), 0)
}

/**
 * Calculate total commissions from transactions
 * @param transactions - Array of transaction amounts in kobo
 * @returns Total commissions in kobo
 */
export function calculateTotalCommissions(transactions: number[]): number {
  return transactions.reduce((sum, amount) => {
    const breakdown = calculateCommission(amount)
    return sum + breakdown.total
  }, 0)
}

/**
 * Format kobo amount as NGN currency string
 * @param kobo - Amount in kobo
 * @returns Formatted currency string (e.g., "₦1,234.56")
 */
export function formatKoboAsNGN(kobo: number): string {
  const naira = Math.floor(kobo / 100)
  const koboRemainder = kobo % 100

  const nairaFormatted = naira.toLocaleString('en-NG')
  const koboFormatted = koboRemainder.toString().padStart(2, '0')

  return `₦${nairaFormatted}.${koboFormatted}`
}

/**
 * Parse NGN currency string to kobo
 * @param currencyString - Currency string (e.g., "₦1,234.56")
 * @returns Amount in kobo
 */
export function parseNGNToKobo(currencyString: string): number {
  // Remove currency symbol and commas
  const cleaned = currencyString.replace(/[₦,]/g, '')

  // Parse as float and convert to kobo
  const naira = parseFloat(cleaned)
  const kobo = Math.floor(naira * 100)

  return kobo
}

/**
 * Validate that amount is in integer kobo (no decimals)
 * @param amount - Amount to validate
 * @returns True if valid integer kobo
 */
export function isValidIntegerKobo(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0
}

/**
 * Round amount to nearest kobo (integer)
 * @param amount - Amount to round
 * @returns Rounded amount in integer kobo
 */
export function roundToNearestKobo(amount: number): number {
  return Math.round(amount)
}

/**
 * Calculate commission percentage
 * @param commission - Commission amount in kobo
 * @param transactionAmount - Transaction amount in kobo
 * @returns Commission percentage (0-100)
 */
export function getCommissionPercentage(commission: number, transactionAmount: number): number {
  if (transactionAmount === 0) return 0
  return (commission / transactionAmount) * 100
}

/**
 * Get commission breakdown by level
 * @param breakdown - Commission breakdown object
 * @returns Array of [level, amount] pairs
 */
export function getCommissionByLevel(breakdown: CommissionBreakdown): Array<[number, number]> {
  return [
    [1, breakdown.level1],
    [2, breakdown.level2],
    [3, breakdown.level3],
    [4, breakdown.level4],
    [5, breakdown.level5],
  ]
}
