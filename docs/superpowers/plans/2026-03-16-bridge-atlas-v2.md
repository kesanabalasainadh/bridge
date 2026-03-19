# NYC Bridge Atlas V2 - Satellite 3D + Live Data Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the NYC Bridge Atlas to photorealistic satellite 3D view, integrate live NYC Open Data for bridge conditions, add comparison mode and mobile drawer.

**Architecture:** Switch from dark navigation style to Mapbox Standard Satellite with 3D terrain for photorealistic bridge views. Add a data service layer that fetches live bridge ratings from NYC Open Data API and merges with static bridge data. Add comparison UI and mobile-responsive drawer.

**Tech Stack:** Mapbox GL JS v3.3.0, NYC Open Data Socrata API (SODA), vanilla JS/CSS/HTML

---

## File Structure

- **Modify:** `app.js` — Switch map style, adjust overlays, add comparison mode logic
- **Modify:** `styles.css` — Adjust UI for satellite background, add comparison panel + mobile drawer styles
- **Modify:** `index.html` — Add comparison panel HTML, mobile drawer toggle, data attribution
- **Modify:** `bridges-data.js` — Add NYC Open Data fetch + merge logic
- **Create:** `data-service.js` — NYC Open Data API client (fetch bridge ratings, merge with static data)

---

## Chunk 1: Satellite 3D Map + UI Adjustments

### Task 1: Switch to Satellite 3D Style

**Files:**
- Modify: `app.js:48-116` (initMap function)

- [ ] **Step 1:** Change map style from `navigation-night-v1` to `standard-satellite`
- [ ] **Step 2:** Adjust terrain exaggeration from 1.5 to 1.0 for realistic satellite
- [ ] **Step 3:** Remove custom fog settings (satellite has its own atmosphere)
- [ ] **Step 4:** Remove custom sky layer (satellite provides sky)
- [ ] **Step 5:** Adjust 3D building layer opacity for satellite blending
- [ ] **Step 6:** Test map loads with satellite imagery and 3D terrain
- [ ] **Step 7:** Commit

### Task 2: Adjust Bridge Overlay Colors for Satellite

**Files:**
- Modify: `app.js:122-353` (bridge layers)

- [ ] **Step 1:** Increase bridge line glow width and opacity for satellite visibility
- [ ] **Step 2:** Brighten bridge line core colors
- [ ] **Step 3:** Increase point marker sizes for satellite contrast
- [ ] **Step 4:** Adjust label text color and halo for satellite readability
- [ ] **Step 5:** Test overlays are clearly visible on satellite imagery
- [ ] **Step 6:** Commit

### Task 3: Adjust UI Panels for Satellite Background

**Files:**
- Modify: `styles.css` (top-bar, sidebar, bottom-bar, detail-panel, popups)

- [ ] **Step 1:** Increase backdrop blur and darken panel backgrounds for satellite contrast
- [ ] **Step 2:** Add stronger borders on all panels
- [ ] **Step 3:** Adjust popup styling for satellite readability
- [ ] **Step 4:** Test all panels readable against bright satellite imagery
- [ ] **Step 5:** Commit

---

## Chunk 2: Live Data Integration

### Task 4: Create Data Service

**Files:**
- Create: `data-service.js`

- [ ] **Step 1:** Create `fetchNYCBridgeRatings()` — fetches from NYC Open Data SODA API
- [ ] **Step 2:** Create `matchAndMerge()` — matches API records to our bridge data by name/coordinates
- [ ] **Step 3:** Create `updateBridgeData()` — merges live ratings into NYC_BRIDGES array
- [ ] **Step 4:** Add error handling and fallback to static data
- [ ] **Step 5:** Test with live API call
- [ ] **Step 6:** Commit

### Task 5: Integrate Data Service into App

**Files:**
- Modify: `index.html` — add data-service.js script tag
- Modify: `app.js` — call data service on load, update UI with live data

- [ ] **Step 1:** Add script tag for data-service.js before app.js
- [ ] **Step 2:** Call `updateBridgeData()` after initial render, then refresh sidebar + stats
- [ ] **Step 3:** Add "Live Data" indicator in top bar when API data loaded
- [ ] **Step 4:** Add data attribution footer
- [ ] **Step 5:** Test full flow with live data
- [ ] **Step 6:** Commit

---

## Chunk 3: Comparison Mode + Mobile Drawer

### Task 6: Comparison Mode

**Files:**
- Modify: `index.html` — add comparison panel HTML
- Modify: `styles.css` — add comparison panel styles
- Modify: `app.js` — add comparison logic

- [ ] **Step 1:** Add comparison panel HTML (side-by-side bridge stats)
- [ ] **Step 2:** Add CSS for comparison panel (centered overlay, two-column layout)
- [ ] **Step 3:** Add "Compare" button to bridge cards and detail panel
- [ ] **Step 4:** Implement comparison state management (select up to 2 bridges)
- [ ] **Step 5:** Render comparison view with key metrics side-by-side
- [ ] **Step 6:** Add close/clear comparison
- [ ] **Step 7:** Test comparison flow
- [ ] **Step 8:** Commit

### Task 7: Mobile Drawer

**Files:**
- Modify: `index.html` — add mobile drawer toggle button
- Modify: `styles.css` — add mobile drawer styles (bottom sheet pattern)

- [ ] **Step 1:** Add hamburger/drawer toggle button visible only on mobile
- [ ] **Step 2:** Convert sidebar to slide-up bottom sheet on mobile (<900px)
- [ ] **Step 3:** Add drag handle and swipe-to-close gesture
- [ ] **Step 4:** Test on mobile viewport sizes
- [ ] **Step 5:** Commit
