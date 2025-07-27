export default function formatETHPrice(priceStr: string) {
    try {
        // Parse the string to a BigInt
        const bigIntPrice = BigInt(priceStr)

        // Handle the division at the BigInt level first
        const whole = bigIntPrice / BigInt(10 ** 18)
        const fraction = bigIntPrice % BigInt(10 ** 18)

        // Convert to string representation with proper decimal places
        const wholeStr = whole.toString()
        let fractionStr = fraction.toString().padStart(18, "0")

        // Remove trailing zeros from the fraction part
        const trimmedFraction = fractionStr.replace(/0+$/, "")

        // Format the result
        return trimmedFraction ? `${wholeStr}.${trimmedFraction} ETH` : `${wholeStr}.0000 ETH`
    } catch {
        return priceStr
    }
}

// export function addDecimalsToPrice(priceStr: string) {
//     try {
//         // Parse as a floating-point number
//         const price = parseFloat(priceStr)
//         // Convert to smallest units (multiply by 10^6 for USDC)
//         const inSmallestUnits = price * 10 ** 6
//         // Return as a string appropriate for blockchain calls
//         return Math.floor(inSmallestUnits).toString()
//     } catch {
//         return priceStr
//     }
// }