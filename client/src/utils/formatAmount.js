
export const formatBigAmount = (amountStr) => {
  if (!amountStr) return "0";
  
  // Case 1: Agar range/hyphen wala amount hai (e.g., "50000000-90000000")
  if (amountStr.includes("-")) {
    const parts = amountStr.split("-");
    return `${formatSingleNumber(parts[0])}-${formatSingleNumber(parts[1])}`;
  }
  
  // Case 2: Agar single number hai
  return formatSingleNumber(amountStr);
};

// Ek single bade number ko exponential mein badalne ke liye helper
const formatSingleNumber = (numStr) => {
  const num = Number(numStr);
  if (isNaN(num)) return numStr;

  // Agar number 7 digits se bada hai (Lakhs/Crores se upar), toh use exponential banado
  if (numStr.length > 7) {
    return num.toExponential(2); // e.g., 10000000 -> 1.00e+7
  }
  
  // Normal numbers ko locale string mein dikhao (e.g., 50,000)
  return num.toLocaleString("en-IN");
};