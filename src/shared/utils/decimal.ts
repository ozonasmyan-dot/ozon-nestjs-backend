import Decimal from 'decimal.js';

// Configure Decimal.js for consistent precision and rounding across the app
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export default Decimal;
