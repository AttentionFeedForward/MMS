export async function register() {
    console.log('[Instrumentation] Registering...');
    console.log(`[Instrumentation] Current Server Time: ${new Date().toString()}`);
    console.log(`[Instrumentation] NEXT_RUNTIME: ${process.env.NEXT_RUNTIME}`);

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            console.log('[Instrumentation] Initializing node-cron...');
            const cron = await import('node-cron');
            const { checkAndNotifyExpiredDocuments } = await import('./lib/expiryService');
            const { cleanupGhostData } = await import('./lib/cleanupService');
            
            // Schedule task for 9:00 AM daily
            // Format: Minute Hour Day Month DayOfWeek
            // Current setting: 09:00 AM
            cron.schedule('00 9 * * *', async () => {
                console.log(`[Cron] Running daily expiry check at ${new Date().toString()}`);
                try {
                    const result = await checkAndNotifyExpiredDocuments();
                    console.log('[Cron] Check result:', result);
                } catch (e) {
                    console.error('[Cron] Error in daily expiry check:', e);
                }
            });

            // Schedule Ghost Data Cleanup for 9:00 AM (Midnight) daily
            cron.schedule('00 9 * * *', async () => {
                console.log(`[Cron] Running daily ghost data cleanup at ${new Date().toString()}`);
                try {
                    const result = await cleanupGhostData();
                    console.log('[Cron] Cleanup result:', result);
                } catch (e) {
                    console.error('[Cron] Error in ghost data cleanup:', e);
                }
            });
            
            console.log('[Instrumentation] Cron jobs scheduled: Expiry Check (09:00), Ghost Data Cleanup (09:00).');
        } catch (e) {
            console.error('[Instrumentation] Failed to initialize cron job:', e);
        }
    } else {
        console.log('[Instrumentation] Skipping cron setup (not nodejs runtime).');
    }
}
