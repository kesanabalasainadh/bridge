/**
 * data-service.js
 *
 * Fetches live bridge condition data from the NYC Open Data SODA API
 * and merges it with the static NYC_BRIDGES array defined in bridges-data.js.
 *
 * Data source: NYC Bridge Conditions
 * Endpoint: https://data.cityofnewyork.us/resource/4yue-vjfc.json
 *
 * This file expects the following globals from bridges-data.js:
 *   - NYC_BRIDGES (array of bridge objects)
 *   - computeAnalytics(bridges) (function to recompute totals)
 */

var liveDataLoaded = false;

/**
 * Fetch up to 1000 bridge rating records from the NYC Open Data SODA API.
 * Returns the parsed JSON array, or an empty array on failure.
 */
async function fetchNYCBridgeRatings() {
  var url = 'https://data.cityofnewyork.us/resource/4yue-vjfc.json?$limit=1000';

  try {
    var response = await fetch(url);

    if (!response.ok) {
      console.warn('data-service: API returned status ' + response.status);
      return [];
    }

    var data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('data-service: Failed to fetch bridge ratings — ' + err.message);
    return [];
  }
}

/**
 * Given one of our NYC_BRIDGES objects and the full array of API records,
 * find the best matching record using fuzzy name matching and proximity.
 * Returns the best matching record or null.
 */
function matchBridgeToRecord(bridge, records) {
  if (!bridge || !records || records.length === 0) {
    return null;
  }

  var bridgeName = (bridge.name || '').toLowerCase();
  var candidates = [];

  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    var score = 0;

    // --- Fuzzy name matching ---
    var featureCarried = (record.feature_carried || '').toLowerCase();
    var featureCrossed = (record.feature_crossed || '').toLowerCase();

    // Extract meaningful words (3+ chars) from the API feature_carried field
    var carriedWords = featureCarried.split(/\s+/).filter(function (w) {
      return w.length >= 3;
    });
    var crossedWords = featureCrossed.split(/\s+/).filter(function (w) {
      return w.length >= 3;
    });

    // Check if bridge name contains words from feature_carried
    for (var j = 0; j < carriedWords.length; j++) {
      if (bridgeName.indexOf(carriedWords[j]) !== -1) {
        score += 2;
      }
    }

    // Check if feature_carried contains words from bridge name
    var nameWords = bridgeName.split(/\s+/).filter(function (w) {
      return w.length >= 3;
    });
    for (var k = 0; k < nameWords.length; k++) {
      if (featureCarried.indexOf(nameWords[k]) !== -1) {
        score += 2;
      }
      // Smaller bonus for matching the crossed feature
      if (featureCrossed.indexOf(nameWords[k]) !== -1) {
        score += 1;
      }
    }

    // --- Proximity matching (use midpoint of bridge endpoints) ---
    var midLat = (bridge.lat1 + bridge.lat2) / 2;
    var midLon = (bridge.lon1 + bridge.lon2) / 2;
    if (midLat != null && midLon != null &&
        record.x_coord_lat != null && record.y_coord_lon != null) {
      var latDiff = Math.abs(midLat - parseFloat(record.x_coord_lat));
      var lonDiff = Math.abs(midLon - parseFloat(record.y_coord_lon));

      if (latDiff < 0.01 && lonDiff < 0.01) {
        // Close proximity — boost score based on closeness
        var distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
        score += Math.max(0, 3 - distance * 300);
      }
    }

    if (score > 0) {
      candidates.push({ record: record, score: score });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by score descending and return the best match
  candidates.sort(function (a, b) {
    return b.score - a.score;
  });

  return candidates[0].record;
}

/**
 * Main function: fetch live data and merge it into the global NYC_BRIDGES array.
 * Returns an object with { matched, total } counts.
 */
async function updateBridgeDataFromAPI() {
  var result = { matched: 0, total: 0 };

  try {
    if (typeof NYC_BRIDGES === 'undefined' || !Array.isArray(NYC_BRIDGES)) {
      console.warn('data-service: NYC_BRIDGES is not available');
      return result;
    }

    result.total = NYC_BRIDGES.length;

    var records = await fetchNYCBridgeRatings();

    if (records.length === 0) {
      console.warn('data-service: No records returned from API — using static data only');
      for (var i = 0; i < NYC_BRIDGES.length; i++) {
        NYC_BRIDGES[i].liveDataAvailable = false;
      }
      return result;
    }

    for (var i = 0; i < NYC_BRIDGES.length; i++) {
      var bridge = NYC_BRIDGES[i];
      var match = matchBridgeToRecord(bridge, records);

      if (match) {
        bridge.liveRating = match.current_rating;
        bridge.liveVerbalRating = match.verbal_rating;
        bridge.lastInspectionDate = match.inspection_date;
        bridge.replacementCost = match.replacement_cost;
        bridge.deckAreaSqFt = match.deck_area_sq_ft;
        bridge.liveDataAvailable = true;
        result.matched++;
      } else {
        bridge.liveDataAvailable = false;
      }
    }

    // Recompute analytics with the merged data
    if (typeof computeAnalytics === 'function') {
      computeAnalytics(NYC_BRIDGES);
    }

    liveDataLoaded = true;
  } catch (err) {
    console.warn('data-service: Error during data merge — ' + err.message);
    // Ensure all bridges are marked as not having live data on failure
    if (typeof NYC_BRIDGES !== 'undefined' && Array.isArray(NYC_BRIDGES)) {
      for (var j = 0; j < NYC_BRIDGES.length; j++) {
        NYC_BRIDGES[j].liveDataAvailable = false;
      }
    }
  }

  return result;
}
