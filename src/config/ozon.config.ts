export default () => ({
    ozon: {
        sellerClientId: process.env.SELLER_CLIENT_ID,
        sellerApiKey: process.env.SELLER_API_KEY,
        performanceClientId: process.env.PERFORMANCE_CLIENT_ID,
        performanceClientSecret: process.env.PERFORMANCE_CLIENT_SECRET,
    }
});