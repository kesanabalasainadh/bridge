/**
 * NYC Bridges Data - Comprehensive dataset
 * Sources: Wikipedia, NYC DOT, Port Authority of NY/NJ, MTA, FHWA, Britannica
 * Traffic data from most recent available counts (2023-2024)
 * Health ratings based on NYSDOT condition ratings (1-7 scale, 7=new)
 * Last updated: 2026-03-16
 */

const NYC_BRIDGES = [
    {
        id: "brooklyn",
        name: "Brooklyn Bridge",
        opened: 1883,
        type: "suspension",
        crosses: "East River",
        connects: ["Manhattan", "Brooklyn"],
        lengthFt: 6016,        // total length Park Row to Sands St
        mainSpanFt: 1595,
        lanes: 5,              // reduced from 6 after 2021 bike lane addition
        pedestrian: true,
        bikeLane: true,
        healthRating: 4.8,
        healthLabel: "Fair",
        dailyTraffic: 116000,  // updated: ~116K vehicles + 30K peds + 5K cyclists
        lat1: 40.7083, lon1: -73.9997, // Manhattan side (City Hall / Park Row)
        lat2: 40.7037, lon2: -73.9935, // Brooklyn side (DUMBO / Sands St)
        detourMiles: 14.2,
        avgSpeedMph: 30,
        personsPerVehicle: 1.5,
        description: "One of the oldest roadway bridges in the US. A National Historic Landmark (1964) and NYC icon. Suspension bridge designed by John A. Roebling. 5 vehicle lanes (3 Manhattan-bound, 2 Brooklyn-bound) + protected bike lane on roadway level (since 2021) + elevated pedestrian promenade.",
        funFact: "When it opened in 1883, it was the longest suspension bridge in the world and 50% longer than any previously built.",
        tollAmount: 0,
        operator: "NYC DOT"
    },
    {
        id: "manhattan",
        name: "Manhattan Bridge",
        opened: 1909,
        type: "suspension",
        crosses: "East River",
        connects: ["Manhattan (Chinatown)", "Brooklyn (Downtown Brooklyn)"],
        lengthFt: 6855,
        mainSpanFt: 1480,      // corrected from 1470
        lanes: 7,              // 4 upper + 3 lower; config is 2+5 directional split
        pedestrian: true,
        bikeLane: true,
        healthRating: 5.0,
        healthLabel: "Fair-Good",
        dailyTraffic: 70293,   // updated 2024 count
        lat1: 40.7078, lon1: -73.9907,
        lat2: 40.6973, lon2: -73.9849,
        detourMiles: 13.8,
        avgSpeedMph: 30,
        personsPerVehicle: 1.5,
        description: "Carries 4 subway tracks (B, D, N, Q), 7 lanes of traffic (4 upper, 3 lower), separate pedestrian walkway (south side), and separate bikeway (north side). First suspension bridge to use Warren truss design. Designed by Leon Moisseiff.",
        funFact: "It was the last of the three suspension bridges built across the lower East River, completed in 1909.",
        tollAmount: 0,
        operator: "NYC DOT"
    },
    {
        id: "williamsburg",
        name: "Williamsburg Bridge",
        opened: 1903,
        type: "suspension",
        crosses: "East River",
        connects: ["Manhattan (Lower East Side)", "Brooklyn (Williamsburg)"],
        lengthFt: 7308,
        mainSpanFt: 1600,
        lanes: 8,
        pedestrian: true,
        bikeLane: true,
        healthRating: 5.2,
        healthLabel: "Fair-Good",
        dailyTraffic: 140000,  // updated: ~140K motorists + 92K transit riders
        lat1: 40.7134, lon1: -73.9724,
        lat2: 40.7096, lon2: -73.9596,
        detourMiles: 15.1,
        avgSpeedMph: 30,
        personsPerVehicle: 1.5,
        description: "118-ft-wide deck carries 8 lanes across 4 two-lane roadways (inner/outer north & south), plus J/M/Z subway tracks. First bridge to use all-steel towers. Underwent $1B reconstruction 1988-2003.",
        funFact: "The bridge was nearly condemned in 1988 due to severe deterioration but was saved by a 15-year, $1B+ reconstruction project.",
        tollAmount: 0,
        operator: "NYC DOT"
    },
    {
        id: "queensboro",
        name: "Ed Koch Queensboro Bridge",
        opened: 1909,
        type: "cantilever",
        crosses: "East River",
        connects: ["Manhattan (East Midtown / 59th St)", "Queens (Long Island City)"],
        lengthFt: 7449,        // total with approaches
        mainSpanFt: 3725,      // 5 steel spans total
        lanes: 9,              // updated: 9 vehicle lanes + bike/ped paths
        pedestrian: true,
        bikeLane: true,
        healthRating: 4.5,
        healthLabel: "Fair",
        dailyTraffic: 180000,  // updated: busiest East River crossing
        lat1: 40.7573, lon1: -73.9572,
        lat2: 40.7509, lon2: -73.9385,
        detourMiles: 12.5,
        avgSpeedMph: 28,
        personsPerVehicle: 1.5,
        description: "Also known as the 59th Street Bridge. Double-deck cantilever bridge passing over Roosevelt Island. Upper level: pair of 2-lane roadways. Lower level: 4 vehicle lanes + dedicated bike lane (north outer roadway since May 2025) + pedestrian-only lane (south outer roadway since May 2025). Carries most vehicles of any East River bridge.",
        funFact: "It is the only one of the four great East River bridges that is NOT a suspension bridge - it is a cantilever design.",
        tollAmount: 0,
        operator: "NYC DOT"
    },
    {
        id: "gw",
        name: "George Washington Bridge",
        opened: 1931,
        type: "suspension",
        crosses: "Hudson River",
        connects: ["Manhattan (Washington Heights)", "Fort Lee, NJ"],
        lengthFt: 4760,
        mainSpanFt: 3500,
        lanes: 14,
        pedestrian: true,
        bikeLane: true,
        healthRating: 5.5,
        healthLabel: "Good",
        dailyTraffic: 284000,  // ~104M vehicles/year, world's busiest
        lat1: 40.8517, lon1: -73.9453, // Manhattan (Washington Heights / 178th St)
        lat2: 40.8509, lon2: -73.9615, // Fort Lee, NJ
        detourMiles: 28.4,
        avgSpeedMph: 35,
        personsPerVehicle: 1.5,
        description: "The world's busiest motor vehicle bridge (~104M vehicles/year). Double-decked: upper level 8 lanes (4 each way), lower level 6 lanes (3 each way) = 14 total. North walkway for bikes, south walkway for pedestrians (under $2B 'Restore the George' renovation). ~2,000 daily ped/bike crossings. Designed by Othmar Ammann.",
        funFact: "It carries over 103 million vehicles per year - more than any other bridge in the world. Was the longest suspension bridge from 1931 until the Golden Gate Bridge opened in 1937.",
        tollAmount: 16.00,
        operator: "Port Authority NY/NJ"
    },
    {
        id: "verrazzano",
        name: "Verrazzano-Narrows Bridge",
        opened: 1964,
        type: "suspension",
        crosses: "The Narrows (New York Harbor / Lower New York Bay)",
        connects: ["Brooklyn (Bay Ridge)", "Staten Island"],
        lengthFt: 13700,      // ~13,200 ft link + approaches
        mainSpanFt: 4260,
        lanes: 13,
        pedestrian: false,
        bikeLane: false,
        healthRating: 5.8,
        healthLabel: "Good",
        dailyTraffic: 220000,  // updated: 80.3M in 2023 = ~220K/day
        lat1: 40.6126, lon1: -74.0444, // Brooklyn (Bay Ridge / Fort Hamilton)
        lat2: 40.5950, lon2: -74.0370, // Staten Island (Fort Wadsworth)
        detourMiles: 42.0,
        avgSpeedMph: 40,
        personsPerVehicle: 1.5,
        description: "America's longest suspension bridge. Double-decked: upper level 7 lanes (incl. reversible HOV/bus lane), lower level 6 lanes = 13 total. No pedestrian or bike access (open only during NYC Marathon and Five Boro Bike Tour). 693-ft towers are 1-5/8 inches farther apart at tops than bases due to Earth's curvature. Designed by Othmar Ammann.",
        funFact: "Named after Giovanni da Verrazzano, who in 1524 was the first European explorer to enter New York Harbor. Was the world's longest suspension bridge 1964-1981.",
        tollAmount: 19.00,
        operator: "MTA Bridges & Tunnels"
    },
    {
        id: "throgs_neck",
        name: "Throgs Neck Bridge",
        opened: 1961,
        type: "suspension",
        crosses: "East River (Long Island Sound approach)",
        connects: ["The Bronx (Throggs Neck)", "Queens (Bayside)"],
        lengthFt: 13400,       // corrected: total length 13,400 ft
        mainSpanFt: 1800,
        lanes: 6,
        pedestrian: false,
        bikeLane: false,
        healthRating: 5.3,
        healthLabel: "Fair-Good",
        dailyTraffic: 110000,  // updated: 105K-112K range
        lat1: 40.8056, lon1: -73.7936, // Queens (Bayside / Cross Island Pkwy)
        lat2: 40.8186, lon2: -73.7956, // Bronx (Throggs Neck)
        detourMiles: 18.7,
        avgSpeedMph: 35,
        personsPerVehicle: 1.5,
        description: "6 lanes of I-295 (3 each direction, 37 ft wide each roadway). 142 ft clearance for marine traffic. No pedestrian or bicycle access. Designed by Othmar Ammann.",
        funFact: "Named after John Throckmorton, who established a settlement in the area in 1643. Built to ease congestion on the Bronx-Whitestone Bridge.",
        tollAmount: 10.17,
        operator: "MTA Bridges & Tunnels"
    },
    {
        id: "whitestone",
        name: "Bronx-Whitestone Bridge",
        opened: 1939,
        type: "suspension",
        crosses: "East River",
        connects: ["The Bronx (Ferry Point Park)", "Queens (Whitestone)"],
        lengthFt: 7140,        // corrected: 7,140 ft total including approaches
        mainSpanFt: 2300,
        lanes: 6,
        pedestrian: false,
        bikeLane: false,
        healthRating: 5.6,
        healthLabel: "Good",
        dailyTraffic: 135000,  // updated: ~135K-140K (2024 AADT)
        lat1: 40.8147, lon1: -73.8280, // Bronx (Ferry Point Park)
        lat2: 40.8010, lon2: -73.8285, // Queens (Whitestone)
        detourMiles: 16.3,
        avgSpeedMph: 35,
        personsPerVehicle: 1.5,
        description: "6 lanes of I-678. Originally opened with 4 lanes and pedestrian walkways in 1939; walkways removed and widened to 6 lanes in 1946-47. Stiffening trusses added after 1940 Tacoma Narrows collapse. 377-ft towers, 135-ft clearance. Designed by Othmar Ammann.",
        funFact: "Was built in just 23 months to open in time for the 1939 World's Fair. Over 50 million vehicles crossed in 2023.",
        tollAmount: 10.17,
        operator: "MTA Bridges & Tunnels"
    },
    {
        id: "rfk",
        name: "Robert F. Kennedy Bridge",
        opened: 1936,
        type: "suspension/lift/truss complex",
        crosses: "Harlem River, Bronx Kill, East River (Hell Gate strait)",
        connects: ["Manhattan (Harlem)", "The Bronx", "Queens (Astoria)"],
        lengthFt: 17710,       // ~3.35 miles total
        mainSpanFt: 1380,      // suspension span over East River
        lanes: 8,              // corrected: 8 lanes of I-278 (4 each direction)
        pedestrian: true,
        bikeLane: false,       // corrected: sidewalk only, no bike lane yet (MTA studying addition)
        healthRating: 4.6,
        healthLabel: "Fair",
        dailyTraffic: 164000,  // updated 2014 figure
        lat1: 40.7808, lon1: -73.9290, // Manhattan (Harlem / 125th St)
        lat2: 40.7850, lon2: -73.9210, // Queens (Astoria Blvd)
        lat3: 40.8050, lon3: -73.9210, // Bronx (Bruckner Blvd)
        detourMiles: 11.2,
        avgSpeedMph: 30,
        personsPerVehicle: 1.5,
        description: "Formerly the Triborough Bridge (renamed 2008). Three-bridge complex via Randalls/Wards Island: (1) suspension bridge over East River, (2) vertical lift bridge over Harlem River, (3) truss bridge over Bronx Kill. 8 lanes of I-278 + 6 lanes of NY 900G. ~17.5 miles of total roadway including ramps. Sidewalk on northeastern side. Designed by Allston Dana with Othmar Ammann.",
        funFact: "It's actually three separate bridges connected by viaducts on Randalls Island. Called 'not a bridge so much as a traffic machine, the largest ever built.'",
        tollAmount: 10.17,
        operator: "MTA Bridges & Tunnels"
    },
    {
        id: "bayonne",
        name: "Bayonne Bridge",
        opened: 1931,
        type: "arch",
        crosses: "Kill Van Kull",
        connects: ["Staten Island (Port Richmond)", "Bayonne, NJ"],
        lengthFt: 5780,
        mainSpanFt: 1675,
        lanes: 4,
        pedestrian: true,
        bikeLane: true,        // corrected: 10-ft shared-use path added with 2019 rebuild
        healthRating: 6.0,
        healthLabel: "Good",
        dailyTraffic: 10000,   // corrected: ~10K/day (3.5M/year)
        lat1: 40.6497, lon1: -74.1419, // Staten Island (Port Richmond)
        lat2: 40.6618, lon2: -74.1404, // Bayonne, NJ
        detourMiles: 22.5,
        avgSpeedMph: 35,
        personsPerVehicle: 1.5,
        description: "Steel through-arch bridge. Was world's longest steel arch span 1931-1977. Underwent major 'Raise the Roadway' project (2013-2019): raised deck 64 ft to 215 ft clearance for New Panamax ships. New roadway has 4 twelve-ft lanes, shoulders, median barrier, and 10-ft shared-use path. Carries NY/NJ Route 440. Designed by Othmar Ammann and Cass Gilbert.",
        funFact: "Was the longest steel arch bridge in the world for 46 years. The roadway raise was completed while keeping the original 1931 arch structure intact.",
        tollAmount: 16.00,
        operator: "Port Authority NY/NJ"
    },
    {
        id: "goethals",
        name: "Goethals Bridge",
        opened: 2017,          // eastbound span; westbound 2018. Original: 1928
        originalOpened: 1928,
        type: "cable-stayed",
        crosses: "Arthur Kill",
        connects: ["Staten Island (Howland Hook)", "Elizabeth, NJ"],
        lengthFt: 7109,        // corrected
        mainSpanFt: 900,
        lanes: 6,
        pedestrian: false,     // corrected: no ped/bike on current bridge
        bikeLane: false,
        healthRating: 6.8,
        healthLabel: "Excellent",
        dailyTraffic: 80000,
        lat1: 40.6388, lon1: -74.1930, // Staten Island (Howland Hook)
        lat2: 40.6398, lon2: -74.2050, // Elizabeth, NJ
        detourMiles: 24.1,
        avgSpeedMph: 40,
        personsPerVehicle: 1.5,
        description: "Pair of cable-stayed spans replacing original 1928 cantilever bridge. Eastbound span opened June 2017, westbound May 2018. 6 lanes total (3 per span), 12-ft travel lanes, 12-ft outer shoulders. 138.5 ft min vertical clearance. Carries I-278.",
        funFact: "Named after Major General George Washington Goethals, who supervised construction of the Panama Canal and was the first consulting engineer of the Port Authority.",
        tollAmount: 16.00,
        operator: "Port Authority NY/NJ"
    },
    {
        id: "outerbridge",
        name: "Outerbridge Crossing",
        opened: 1928,
        type: "cantilever",
        crosses: "Arthur Kill",
        connects: ["Staten Island (Charleston)", "Perth Amboy, NJ"],
        lengthFt: 8800,        // corrected: 8,800 ft total including approaches
        mainSpanFt: 750,
        lanes: 4,
        pedestrian: false,
        bikeLane: false,
        healthRating: 4.2,
        healthLabel: "Fair",
        dailyTraffic: 82000,   // ~30M/year
        lat1: 40.5247, lon1: -74.2483, // Staten Island (Charleston)
        lat2: 40.5182, lon2: -74.2560, // Perth Amboy, NJ
        detourMiles: 26.8,
        avgSpeedMph: 35,
        personsPerVehicle: 1.5,
        description: "Southernmost crossing in New York State. Steel cantilever through truss with notoriously narrow 10-ft lanes (vs 12-ft standard). 4 lanes (2 each direction). Tolls eastbound only. Carries NY/NJ Route 440. Opened same day as original Goethals Bridge (June 29, 1928).",
        funFact: "Named after Eugenius Harvey Outerbridge, the first chairman of the Port Authority - NOT because it's the 'outer bridge.' When it opened, 512K vehicles crossed in the first year; today that many cross each week.",
        tollAmount: 16.00,
        operator: "Port Authority NY/NJ"
    },
    {
        id: "cuomo",
        name: "Gov. Mario M. Cuomo Bridge",
        opened: 2017,          // westbound span Aug 2017; fully opened 2018. Replaces 1955 Tappan Zee
        originalOpened: 1955,
        type: "cable-stayed",
        crosses: "Hudson River (Tappan Zee - widest point)",
        connects: ["Tarrytown (Westchester County)", "South Nyack (Rockland County)"],
        lengthFt: 16368,       // ~3.1 miles
        mainSpanFt: 1200,      // 1,200-ft midspan cable-stayed
        lanes: 8,
        pedestrian: true,
        bikeLane: true,
        healthRating: 6.9,
        healthLabel: "Excellent",
        dailyTraffic: 137000,  // ~50M/year
        lat1: 41.0709, lon1: -73.8730, // Tarrytown (Westchester)
        lat2: 41.0628, lon2: -73.8590, // South Nyack (Rockland)
        detourMiles: 45.6,
        avgSpeedMph: 45,
        personsPerVehicle: 1.5,
        description: "Twin cable-stayed spans replacing the 1955 Tappan Zee Bridge. 8 general traffic lanes (4 per span), bus/emergency lanes, emergency shoulders. 3.6-mile shared-use path (one of the longest in the US). 419-ft towers. 183 ft wide. Space reserved for future commuter rail. Designed to last 100+ years. $3.98B cost. Carries I-87/I-287.",
        funFact: "The old Tappan Zee Bridge was demolished using controlled explosives in January 2019. The original was built during the Korean War material shortage and only designed to last ~50 years.",
        tollAmount: 5.75,
        operator: "NYS Thruway Authority"
    },
    {
        id: "hellgate",
        name: "Hell Gate Bridge",
        opened: 1916,          // completed 1916, passenger 1917, freight 1918
        type: "arch",
        crosses: "Hell Gate (East River strait)",
        connects: ["Queens (Astoria)", "Randalls/Wards Island", "Bronx (Port Morris)"],
        lengthFt: 16900,       // end-to-end including viaducts (~3+ miles)
        mainSpanFt: 1017,      // East River arch span
        lanes: 0,
        tracks: 3,             // 2 electrified (Amtrak), 1 freight
        pedestrian: false,
        bikeLane: false,
        healthRating: 5.4,
        healthLabel: "Fair-Good",
        dailyTraffic: 0,       // railroad bridge - no vehicle traffic
        dailyTrains: 40,       // ~40 Amtrak trains/day + freight (CSX, Norfolk Southern)
        isRailOnly: true,
        lat1: 40.7803, lon1: -73.9215, // Queens (Astoria)
        lat2: 40.7930, lon2: -73.9215, // Bronx (Port Morris) via Randalls/Wards Island
        detourMiles: 19.3,
        avgSpeedMph: 60,
        personsPerVehicle: 1.0,
        dailyPassengers: 18000,
        description: "Railroad-only steel through-arch bridge (23-panel two-hinged braced ribbed). 3 tracks: 2 electrified for Amtrak Northeast Corridor, 1 for freight (CSX, Norfolk Southern, Providence & Worcester). Was the world's longest steel arch bridge 1916-1931. 135 ft above water. Designed by Gustav Lindenthal. Critical link in Amtrak's Northeast Corridor (Washington DC to Boston).",
        funFact: "Designed to last 1,000 years due to its high-carbon steel construction. The bridge was a target of Operation Pastorius, a Nazi sabotage plan thwarted in 1942. Its design inspired the Sydney Harbour Bridge.",
        tollAmount: 0,
        operator: "Amtrak"
    }
];

/**
 * Compute all analytics for each bridge and aggregate totals
 */
function computeAnalytics(bridges) {
    const currentYear = new Date().getFullYear();

    bridges.forEach(b => {
        b.age = currentYear - b.opened;
        b.lengthMiles = +(b.lengthFt / 5280).toFixed(2);

        // Distance saved per crossing (detour - bridge length)
        b.distanceSavedPerCrossing = +(b.detourMiles - b.lengthMiles).toFixed(2);

        // Time saved per crossing at average speed
        const bridgeCrossingTimeHrs = b.lengthMiles / b.avgSpeedMph;
        const detourTimeHrs = b.detourMiles / b.avgSpeedMph;
        b.timeSavedPerCrossingMin = +((detourTimeHrs - bridgeCrossingTimeHrs) * 60).toFixed(1);

        // For rail-only bridges, use passenger count differently
        const dailyCrossings = b.isRailOnly ? (b.dailyPassengers || 0) : b.dailyTraffic;

        // Daily miles saved (all vehicles/passengers)
        b.dailyMilesSaved = Math.round(dailyCrossings * b.distanceSavedPerCrossing);

        // Monthly miles saved
        b.monthlyMilesSaved = Math.round(b.dailyMilesSaved * 30);

        // Daily person-trips
        b.dailyPersonTrips = b.isRailOnly
            ? dailyCrossings
            : Math.round(b.dailyTraffic * b.personsPerVehicle);

        // Person-hours saved per day
        b.personHoursSavedPerDay = +(b.dailyPersonTrips * b.timeSavedPerCrossingMin / 60).toFixed(0);

        // Time saved per person in minutes (per crossing)
        b.timeSavedPerPersonMin = b.timeSavedPerCrossingMin;

        // At 50 mph reference speed (as user requested)
        const bridgeTimeAt50 = b.lengthMiles / 50;
        const detourTimeAt50 = b.detourMiles / 50;
        b.timeSavedAt50MphMin = +((detourTimeAt50 - bridgeTimeAt50) * 60).toFixed(1);

        // Health percentage (rating out of 7)
        b.healthPct = Math.round((b.healthRating / 7) * 100);
    });

    // Aggregate stats
    const totals = {
        totalBridges: bridges.length,
        totalDailyTraffic: bridges.reduce((s, b) => s + (b.isRailOnly ? 0 : b.dailyTraffic), 0),
        totalDailyPersonTrips: bridges.reduce((s, b) => s + b.dailyPersonTrips, 0),
        totalDailyMilesSaved: bridges.reduce((s, b) => s + b.dailyMilesSaved, 0),
        totalMonthlyMilesSaved: bridges.reduce((s, b) => s + b.monthlyMilesSaved, 0),
        totalPersonHoursSavedPerDay: bridges.reduce((s, b) => s + b.personHoursSavedPerDay, 0),
        avgAge: Math.round(bridges.reduce((s, b) => s + b.age, 0) / bridges.length),
        avgTimeSavedPerPerson: +(bridges.filter(b => b.timeSavedPerCrossingMin > 0).reduce((s, b) => s + b.timeSavedPerCrossingMin, 0) / bridges.filter(b => b.timeSavedPerCrossingMin > 0).length).toFixed(1),
        avgTimeSavedAt50Mph: +(bridges.filter(b => b.timeSavedAt50MphMin > 0).reduce((s, b) => s + b.timeSavedAt50MphMin, 0) / bridges.filter(b => b.timeSavedAt50MphMin > 0).length).toFixed(1),
    };

    return totals;
}

const BRIDGE_TOTALS = computeAnalytics(NYC_BRIDGES);
