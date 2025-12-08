#!/usr/bin/env node

/**
 * Normalize Location Names for Microsoft 365 Group Matching
 * 
 * This script helps audit and normalize Firestore location names to exactly match
 * Microsoft 365 group displayName values for automatic school assignment.
 * 
 * Usage:
 *   # List all current location names
 *   node scripts/normalize-location-names.js --list
 * 
 *   # Export to CSV for mapping
 *   node scripts/normalize-location-names.js --export locations.csv
 * 
 *   # Update a single location name
 *   node scripts/normalize-location-names.js --update "OLD_NAME" "NEW_NAME"
 * 
 *   # Import mappings from CSV (format: old_name,new_name)
 *   node scripts/normalize-location-names.js --import mappings.csv
 * 
 *   # Dry run (show changes without applying)
 *   node scripts/normalize-location-names.js --import mappings.csv --dry-run
 * 
 * Prerequisites:
 *   - serviceAccountKey.json must exist in the project root
 *   - Firebase Admin SDK must be installed
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * List all locations and their current names
 */
async function listLocations() {
  console.log('📋 Listing all locations in Firestore...\n');
  
  const snapshot = await db.collection('locations').orderBy('name').get();
  
  console.log('ID'.padEnd(45) + '| Name');
  console.log('-'.repeat(45) + '+' + '-'.repeat(50));
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id.padEnd(45)}| ${data.name}`);
  });
  
  console.log(`\n📊 Total: ${snapshot.size} locations\n`);
}

/**
 * Export locations to CSV for mapping
 */
async function exportToCSV(filename) {
  console.log(`📤 Exporting locations to ${filename}...\n`);
  
  const snapshot = await db.collection('locations').orderBy('name').get();
  
  const lines = ['id,current_name,new_name'];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Escape commas and quotes in names
    const escapedName = `"${data.name.replace(/"/g, '""')}"`;
    lines.push(`${doc.id},${escapedName},`);
  });
  
  fs.writeFileSync(filename, lines.join('\n'));
  console.log(`✅ Exported ${snapshot.size} locations to ${filename}`);
  console.log('\nInstructions:');
  console.log('1. Open the CSV in a spreadsheet editor');
  console.log('2. Fill in the "new_name" column with Microsoft 365 group names');
  console.log('3. Save as CSV and run: node scripts/normalize-location-names.js --import mappings.csv');
}

/**
 * Update a single location's name
 */
async function updateSingleLocation(oldName, newName, dryRun = false) {
  console.log(`🔍 Looking for location: "${oldName}"...\n`);
  
  const snapshot = await db.collection('locations').where('name', '==', oldName).get();
  
  if (snapshot.empty) {
    console.log(`❌ No location found with name: "${oldName}"`);
    console.log('   Tip: Names are case-sensitive. Use --list to see all names.');
    process.exit(1);
  }
  
  const doc = snapshot.docs[0];
  
  if (dryRun) {
    console.log(`[DRY RUN] Would update location ${doc.id}:`);
    console.log(`   Old name: "${oldName}"`);
    console.log(`   New name: "${newName}"`);
  } else {
    await doc.ref.update({
      name: newName,
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log(`✅ Updated location ${doc.id}:`);
    console.log(`   Old name: "${oldName}"`);
    console.log(`   New name: "${newName}"`);
  }
}

/**
 * Import and apply mappings from CSV file
 * CSV format: id,current_name,new_name (or just old_name,new_name)
 */
async function importFromCSV(filename, dryRun = false) {
  console.log(`📥 Importing mappings from ${filename}...\n`);
  
  if (!fs.existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
  
  const updates = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse CSV (handle quoted fields)
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    // Handle both 2-column and 3-column formats
    let oldName, newName;
    if (fields.length >= 3) {
      // 3-column format: id, current_name, new_name
      oldName = fields[1];
      newName = fields[2];
    } else if (fields.length === 2) {
      // 2-column format: old_name, new_name
      oldName = fields[0];
      newName = fields[1];
    } else {
      continue;
    }
    
    // Skip empty new names
    if (!newName || newName === oldName) {
      continue;
    }
    
    updates.push({ oldName, newName });
  }
  
  if (updates.length === 0) {
    console.log('ℹ️  No updates found in the CSV file.');
    console.log('   Make sure the "new_name" column has values different from "current_name".');
    process.exit(0);
  }
  
  console.log(`Found ${updates.length} location(s) to update:\n`);
  
  for (const update of updates) {
    console.log(`   "${update.oldName}" → "${update.newName}"`);
  }
  
  if (dryRun) {
    console.log('\n[DRY RUN] No changes were made. Remove --dry-run to apply changes.');
    process.exit(0);
  }
  
  console.log('\n🔄 Applying updates...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      const snapshot = await db.collection('locations').where('name', '==', update.oldName).get();
      
      if (snapshot.empty) {
        console.log(`⚠️  Location not found: "${update.oldName}"`);
        errorCount++;
        continue;
      }
      
      const doc = snapshot.docs[0];
      await doc.ref.update({
        name: update.newName,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log(`✅ "${update.oldName}" → "${update.newName}"`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating "${update.oldName}":`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount} updated, ${errorCount} errors`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Normalize Location Names for Microsoft 365 Group Matching

Usage:
  node scripts/normalize-location-names.js [command] [options]

Commands:
  --list                    List all current location names
  --export <file.csv>       Export locations to CSV for mapping
  --update "OLD" "NEW"      Update a single location name
  --import <file.csv>       Import and apply mappings from CSV

Options:
  --dry-run                 Show changes without applying them
  --help, -h                Show this help message

Examples:
  # List all locations
  node scripts/normalize-location-names.js --list

  # Export for editing
  node scripts/normalize-location-names.js --export locations.csv

  # Update a single location
  node scripts/normalize-location-names.js --update "HOPE Excel Academy" "Hope Excel"

  # Import mappings with dry run
  node scripts/normalize-location-names.js --import mappings.csv --dry-run

  # Import and apply mappings
  node scripts/normalize-location-names.js --import mappings.csv
`);
    process.exit(0);
  }
  
  const dryRun = args.includes('--dry-run');
  
  try {
    if (args.includes('--list')) {
      await listLocations();
    } else if (args.includes('--export')) {
      const fileIndex = args.indexOf('--export') + 1;
      const filename = args[fileIndex] || 'locations.csv';
      await exportToCSV(filename);
    } else if (args.includes('--update')) {
      const updateIndex = args.indexOf('--update');
      const oldName = args[updateIndex + 1];
      const newName = args[updateIndex + 2];
      
      if (!oldName || !newName) {
        console.error('❌ Missing arguments. Usage: --update "OLD_NAME" "NEW_NAME"');
        process.exit(1);
      }
      
      await updateSingleLocation(oldName, newName, dryRun);
    } else if (args.includes('--import')) {
      const fileIndex = args.indexOf('--import') + 1;
      const filename = args[fileIndex];
      
      if (!filename) {
        console.error('❌ Missing filename. Usage: --import <file.csv>');
        process.exit(1);
      }
      
      await importFromCSV(filename, dryRun);
    } else {
      console.error('❌ Unknown command. Use --help for usage information.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
