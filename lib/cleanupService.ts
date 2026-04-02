import prisma from './db';

/**
 * Cleans up ghost data from the database.
 * 
 * Rules:
 * 1. Manufacturer: Delete if masterMaterials count is 0 AND documents count is 0.
 * 2. MasterMaterial: Delete if documents count is 0 AND archiveItems count is 0.
 */
export async function cleanupGhostData() {
    console.log('[Cleanup] Starting ghost data cleanup...');
    
    try {
        // --- 1. Clean up Ghost MasterMaterials ---
        // Rule: documents count is 0 AND archiveItems count is 0
        // We need to find them first because deleteMany doesn't support relation filtering directly in the same way for complex conditions easily in one go efficiently without exact IDs usually, 
        // but actually deleteMany allows `where` with relations like `none`.
        
        // Let's verify if `deleteMany` supports `none` for relations. 
        // Yes, Prisma supports relation filtering in deleteMany.
        
        const deletedMaterials = await prisma.masterMaterial.deleteMany({
            where: {
                documents: { none: {} },
                archiveItems: { none: {} }
            }
        });
        
        console.log(`[Cleanup] Deleted ${deletedMaterials.count} ghost MasterMaterials.`);

        // --- 2. Clean up Ghost Manufacturers ---
        // Rule: masterMaterials count is 0 AND documents count is 0
        // Note: SupplierScore has a foreign key constraint (manufacturerId).
        // If we delete a manufacturer, we must also delete its scores, OR ensure we only delete manufacturers without scores.
        // However, the requirement didn't mention scores. 
        // Assuming if a manufacturer is "ghost" (no materials, no docs), its scores are also irrelevant and should be deleted 
        // OR preventing deletion if scores exist.
        // Prisma's deleteMany on Manufacturer will FAIL if there are related SupplierScore records due to foreign key constraints (unless Cascade delete is set in schema).
        // Let's check schema... Manufacturer has `scores SupplierScore[]`.
        // The default behavior for SQLite in Prisma is typically restrict or set null unless Cascade is specified.
        // Since we didn't specify `@relation(onDelete: Cascade)` in schema, this might be the cause of failure if scores exist.
        
        // Let's check if there are scores. The user requirement was:
        // "Manufacturer库中 Mastermaterials和Masterdocuments均为0的数据"
        // It didn't explicitly say "and no scores". 
        // BUT, if there are scores, deleting the manufacturer will violate FK constraint.
        // Option A: Add `scores: { none: {} }` to the where clause (safest, strictly follows "ghost" definition implies no useful data).
        // Option B: Delete related scores first.

        // Let's try Option A first to be safe and see if that resolves the error.
        
        const deletedManufacturers = await prisma.manufacturer.deleteMany({
            where: {
                materials: { none: {} },
                documents: { none: {} },
                scores: { none: {} } // Added to prevent FK violation if scores exist
            }
        });

        console.log(`[Cleanup] Deleted ${deletedManufacturers.count} ghost Manufacturers.`);
        
        return {
            deletedMaterials: deletedMaterials.count,
            deletedManufacturers: deletedManufacturers.count
        };

    } catch (error) {
        console.error('[Cleanup] Error during ghost data cleanup:', error);
        throw error;
    }
}
