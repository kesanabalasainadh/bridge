#!/usr/bin/env node

/**
 * Process NBI (National Bridge Inventory) CSV data into a JSON file
 * suitable for the Bridge Atlas server.
 *
 * NBI CSV format: comma-separated, single-quote text qualifiers.
 * See: https://www.fhwa.dot.gov/bridge/nbi/format.cfm
 */

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'bridges.json');
const CURATED_OUTPUT = path.join(__dirname, '..', 'data', 'nyc-curated.json');

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const STATE_CODES = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'DC', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico'
};

const KIND_CODES = {
  '0': 'Other',
  '1': 'Concrete',
  '2': 'Concrete continuous',
  '3': 'Steel',
  '4': 'Steel continuous',
  '5': 'Prestressed concrete',
  '6': 'Prestressed continuous',
  '7': 'Wood',
  '8': 'Masonry',
  '9': 'Aluminum/Wrought Iron/Cast Iron'
};

const TYPE_CODES = {
  '01': 'Slab',
  '02': 'Stringer/Multi-beam',
  '03': 'Girder/Floorbeam',
  '04': 'Tee Beam',
  '05': 'Box Beam (multiple)',
  '06': 'Box Beam (single/spread)',
  '07': 'Frame',
  '08': 'Orthotropic',
  '09': 'Truss (deck)',
  '10': 'Truss (thru)',
  '11': 'Arch (deck)',
  '12': 'Arch (thru)',
  '13': 'Suspension',
  '14': 'Stayed Girder',
  '15': 'Movable (lift)',
  '16': 'Movable (bascule)',
  '17': 'Movable (swing)',
  '18': 'Tunnel',
  '19': 'Culvert',
  '20': 'Mixed types',
  '21': 'Segmental Box Girder',
  '22': 'Channel Beam'
};

const OWNER_CODES = {
  '01': 'State Highway Agency',
  '02': 'County Highway Agency',
  '03': 'Town/Township',
  '04': 'City/Municipal',
  '11': 'State Park/Forest/Reservation',
  '12': 'Local Park/Forest/Reservation',
  '21': 'Other State Agencies',
  '25': 'Other Local Agencies',
  '26': 'Private',
  '27': 'Railroad',
  '31': 'State Toll Authority',
  '32': 'Local Toll Authority',
  '60': 'Other Federal Agencies',
  '62': 'Bureau of Indian Affairs',
  '64': 'US Forest Service',
  '66': 'National Park Service',
  '68': 'Bureau of Land Management',
  '69': 'Bureau of Reclamation',
  '70': 'Corps of Engineers'
};

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert NBI latitude (8 digits: DDMMSSSS) to decimal degrees.
 * DD = degrees, MM = minutes, SSSS = hundredths of seconds
 * Example: 40425678 -> 40 deg 42 min 56.78 sec -> 40.71577...
 */
function parseNbiLat(raw) {
  const s = String(raw).trim().replace(/'/g, '');
  if (!s || s.length < 7) return null;
  const padded = s.padStart(8, '0');
  const deg = parseInt(padded.substring(0, 2), 10);
  const min = parseInt(padded.substring(2, 4), 10);
  const secHundredths = parseInt(padded.substring(4, 8), 10);
  const sec = secHundredths / 100;
  if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
  return deg + min / 60 + sec / 3600;
}

/**
 * Convert NBI longitude (9 digits: DDDMMSSSS) to decimal degrees.
 * Negated for Western hemisphere (all US bridges).
 */
function parseNbiLng(raw) {
  const s = String(raw).trim().replace(/'/g, '');
  if (!s || s.length < 8) return null;
  const padded = s.padStart(9, '0');
  const deg = parseInt(padded.substring(0, 3), 10);
  const min = parseInt(padded.substring(3, 5), 10);
  const secHundredths = parseInt(padded.substring(5, 9), 10);
  const sec = secHundredths / 100;
  if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
  return -(deg + min / 60 + sec / 3600);
}

/**
 * Map overall condition code to label.
 * G = Good (min rating 7+), F = Fair (5-6), P = Poor (0-4)
 */
function conditionLabel(code) {
  if (!code) return 'Unknown';
  const c = String(code).trim().toUpperCase();
  if (c === 'G') return 'Good';
  if (c === 'F') return 'Fair';
  if (c === 'P') return 'Poor';
  if (c === 'N') return 'Not applicable';
  return 'Unknown';
}

/**
 * Parse a single condition rating (0-9 or N) to a number or null.
 */
function parseConditionRating(val) {
  if (!val) return null;
  const s = String(val).trim().replace(/'/g, '');
  if (s === 'N' || s === '' || s === ' ') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSV line with single-quote text qualifiers.
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inQuotes) {
      inQuotes = true;
    } else if (ch === "'" && inQuotes) {
      inQuotes = false;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

function findCsvFile() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`ERROR: ${RAW_DIR} does not exist. Run "npm run download-nbi" first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(RAW_DIR).filter(f =>
    f.toLowerCase().endsWith('.csv') || f.toLowerCase().endsWith('.txt')
  );

  if (files.length === 0) {
    // Try any file that's not a zip
    const allFiles = fs.readdirSync(RAW_DIR).filter(f => !f.endsWith('.zip'));
    if (allFiles.length === 0) {
      console.error('ERROR: No extracted data files found in', RAW_DIR);
      console.error('Run "npm run download-nbi" first.');
      process.exit(1);
    }
    // Return the largest non-zip file (likely the CSV)
    allFiles.sort((a, b) => {
      return fs.statSync(path.join(RAW_DIR, b)).size - fs.statSync(path.join(RAW_DIR, a)).size;
    });
    return path.join(RAW_DIR, allFiles[0]);
  }

  // Return the largest CSV/TXT file
  files.sort((a, b) => {
    return fs.statSync(path.join(RAW_DIR, b)).size - fs.statSync(path.join(RAW_DIR, a)).size;
  });
  return path.join(RAW_DIR, files[0]);
}

function main() {
  const csvPath = findCsvFile();
  console.log(`Reading: ${csvPath}`);

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  console.log(`Total lines (including header): ${lines.length}`);

  if (lines.length < 2) {
    console.error('ERROR: CSV file appears empty or invalid.');
    process.exit(1);
  }

  // Parse header to find column indices
  const header = parseCsvLine(lines[0]);
  const colIndex = {};
  header.forEach((name, idx) => {
    colIndex[name.replace(/'/g, '').trim()] = idx;
  });

  // Log discovered columns for debugging
  console.log(`Header columns: ${header.length}`);

  // Map expected NBI column names to indices
  // These are the standard NBI column names
  const COL = {
    stateCode:        colIndex['STATE_CODE_001'],
    structureNumber:  colIndex['STRUCTURE_NUMBER_008'],
    countyCode:       colIndex['COUNTY_CODE_003'],
    facilityCarried:  colIndex['FACILITY_CARRIED_007'],
    featuresCrossed:  colIndex['FEATURES_DESC_006A'],
    lat:              colIndex['LAT_016'],
    lng:              colIndex['LONG_017'],
    yearBuilt:        colIndex['YEAR_BUILT_027'],
    adt:              colIndex['ADT_029'],
    structureKind:    colIndex['STRUCTURE_KIND_043A'],
    structureType:    colIndex['STRUCTURE_TYPE_043B'],
    deckCond:         colIndex['DECK_COND_058'],
    superCond:        colIndex['SUPERSTRUCTURE_COND_059'],
    subCond:          colIndex['SUBSTRUCTURE_COND_060'],
    lengthMt:         colIndex['STRUCTURE_LEN_MT_049'],
    deckWidthMt:      colIndex['DECK_WIDTH_MT_052'],
    owner:            colIndex['OWNER_022'],
    bridgeCondition:  colIndex['BRIDGE_CONDITION']
  };

  // Verify we found key columns
  const missing = Object.entries(COL).filter(([k, v]) => v === undefined);
  if (missing.length > 0) {
    console.warn(`WARNING: Could not find columns: ${missing.map(m => m[0]).join(', ')}`);
    console.warn('Available columns (first 20):', header.slice(0, 20).join(', '));
  }

  const bridges = [];
  let skipped = 0;
  const stateBreakdown = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);

    const getField = (idx) => {
      if (idx === undefined || idx === null) return '';
      const val = fields[idx] || '';
      return val.replace(/'/g, '').trim();
    };

    const lat = parseNbiLat(getField(COL.lat));
    const lng = parseNbiLng(getField(COL.lng));

    // Skip invalid coordinates
    if (lat === null || lng === null || (lat === 0 && lng === 0) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      skipped++;
      continue;
    }

    const stateCodeRaw = getField(COL.stateCode).padStart(2, '0');
    const stateName = STATE_CODES[stateCodeRaw] || `State ${stateCodeRaw}`;

    const yearBuiltRaw = parseInt(getField(COL.yearBuilt), 10);
    const yearBuilt = (yearBuiltRaw > 1700 && yearBuiltRaw <= new Date().getFullYear()) ? yearBuiltRaw : null;

    const adtRaw = parseInt(getField(COL.adt), 10);
    const adt = isNaN(adtRaw) ? 0 : adtRaw;

    const lengthMt = parseFloat(getField(COL.lengthMt));
    const lengthFt = isNaN(lengthMt) ? null : Math.round(lengthMt * 3.28084);

    const deckWidthMt = parseFloat(getField(COL.deckWidthMt));
    const deckWidthFt = isNaN(deckWidthMt) ? null : Math.round(deckWidthMt * 3.28084 * 10) / 10;

    const kindCode = getField(COL.structureKind);
    const typeCode = getField(COL.structureType).padStart(2, '0');

    const kindName = KIND_CODES[kindCode] || kindCode;
    const typeName = TYPE_CODES[typeCode] || typeCode;
    const bridgeType = kindName && typeName ? `${kindName} - ${typeName}` : (kindName || typeName || 'Unknown');

    const ownerCode = getField(COL.owner).padStart(2, '0');
    const ownerName = OWNER_CODES[ownerCode] || `Owner ${ownerCode}`;

    const conditionCode = getField(COL.bridgeCondition);
    const condition = conditionLabel(conditionCode);

    const deckCondRating = parseConditionRating(getField(COL.deckCond));
    const superCondRating = parseConditionRating(getField(COL.superCond));
    const subCondRating = parseConditionRating(getField(COL.subCond));

    const structureNumber = getField(COL.structureNumber);
    const facilityCarried = getField(COL.facilityCarried);
    const featuresCrossed = getField(COL.featuresCrossed);

    // Build a display name
    let name = facilityCarried || 'Unknown Bridge';
    if (featuresCrossed) {
      name += ` over ${featuresCrossed}`;
    }

    const bridge = {
      id: structureNumber,
      name,
      lat: Math.round(lat * 1000000) / 1000000,
      lng: Math.round(lng * 1000000) / 1000000,
      state: stateName,
      stateCode: stateCodeRaw,
      county: getField(COL.countyCode),
      yearBuilt,
      type: bridgeType,
      kind: kindName,
      designType: typeName,
      condition,
      conditionRatings: {
        deck: deckCondRating,
        superstructure: superCondRating,
        substructure: subCondRating
      },
      adt,
      length: lengthFt,
      deckWidth: deckWidthFt,
      owner: ownerName,
      facilityCarried,
      featureCrossed: featuresCrossed
    };

    bridges.push(bridge);

    // Track state breakdown
    stateBreakdown[stateName] = (stateBreakdown[stateName] || 0) + 1;

    // Progress logging
    if (bridges.length % 100000 === 0) {
      console.log(`  Processed ${bridges.length} bridges...`);
    }
  }

  console.log(`\n--- Processing Complete ---`);
  console.log(`Total bridges processed: ${bridges.length}`);
  console.log(`Skipped (invalid coords): ${skipped}`);

  // State breakdown (sorted by count)
  console.log(`\nBridges by state (top 20):`);
  Object.entries(stateBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count.toLocaleString()}`);
    });

  // Condition breakdown
  const condBreakdown = { Good: 0, Fair: 0, Poor: 0, Unknown: 0, 'Not applicable': 0 };
  bridges.forEach(b => {
    condBreakdown[b.condition] = (condBreakdown[b.condition] || 0) + 1;
  });
  console.log(`\nCondition breakdown:`);
  Object.entries(condBreakdown).forEach(([cond, count]) => {
    if (count > 0) console.log(`  ${cond}: ${count.toLocaleString()}`);
  });

  // Write output
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nWriting ${bridges.length} bridges to ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(bridges));
  const sizeMb = (fs.statSync(OUTPUT_PATH).size / 1048576).toFixed(1);
  console.log(`Output size: ${sizeMb} MB`);

  // Create nyc-curated.json placeholder if it doesn't already exist
  if (!fs.existsSync(CURATED_OUTPUT)) {
    console.log(`\nNote: ${CURATED_OUTPUT} not found.`);
    console.log('The curated NYC bridge data should be created from bridges-data.js.');
  }

  console.log('\nDone! Start the server with: npm start');
}

main();
