// Google Sheets API approach - No CORS issues!
// This uses the Google Sheets API v4 which is CORS-enabled by default
const SHEET_ID = "2PACX-1vQJ5XPG5xNDSkli3nYtaQvYvr64VVqwk2dQli6RAJy1uBTnWVi-rjAmaGvFn3gu81CqSRdZ0Ys8JHua";
const API_KEY = "AIzaSyDyWJHwC8M4-XMfxT_kLM8p8C8S9zJm7Ak"; // Public API key for Sheets API

// Initialize a dark-themed world map centered globally
const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// Keep track of active markers to clear them on refresh
let activeMarkers = [];

// Function to parse DD/MM/YYYY HH:MM format to Date object
function parseDateString(dateStr) {
    if (!dateStr) return null;
    
    const trimmed = dateStr.trim();
    const parts = trimmed.split(" ");
    
    if (parts.length < 2) {
        console.warn("Invalid date format:", dateStr);
        return null;
    }
    
    const dateParts = parts[0].split("/");
    if (dateParts.length !== 3) {
        console.warn("Invalid date parts:", dateStr);
        return null;
    }
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    const time = parts[1];
    
    // Validate date components
    if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12) {
        console.warn("Invalid date components:", { day, month, year });
        return null;
    }
    
    // Parse time HH:MM
    const timeParts = time.split(":");
    if (timeParts.length < 2) {
        console.warn("Invalid time format:", time);
        return null;
    }
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
        console.warn("Invalid time components:", { hours, minutes });
        return null;
    }
    
    // Create date object - using UTC to avoid timezone issues
    // Note: JavaScript months are 0-indexed
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    
    if (isNaN(date.getTime())) {
        console.warn("Invalid date object created from:", dateStr);
        return null;
    }
    
    return date;
}

function updateLiveMap() {
    // Using Google Sheets API v4 to fetch data
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?key=${API_KEY}`;
    
    console.log("Attempting to load from Google Sheets API...");
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Data loaded successfully from Google Sheets API:", data);
            
            // Clear existing markers from previous run
            activeMarkers.forEach(marker => map.removeLayer(marker));
            activeMarkers = [];

            if (!data.values || data.values.length < 2) {
                console.warn("No data found in sheet");
                document.getElementById('stats').innerText = "⚠️ No data in sheet";
                return;
            }

            // Parse header row
            const headers = data.values[0];
            const timestampIdx = headers.indexOf("TimeStamp");
            const latIdx = headers.indexOf("Latitude");
            const lngIdx = headers.indexOf("Longitude");

            if (timestampIdx === -1 || latIdx === -1 || lngIdx === -1) {
                console.error("Missing required columns. Headers:", headers);
                document.getElementById('stats').innerText = "❌ Missing required columns";
                return;
            }

            const now = new Date();
            const oneDayInMs = 24 * 60 * 60 * 1000;
            let activeCount = 0;
            let errorCount = 0;

            // Process data rows (skip header)
            for (let i = 1; i < data.values.length; i++) {
                const row = data.values[i];
                
                const timestampStr = row[timestampIdx];
                const latStr = row[latIdx];
                const lngStr = row[lngIdx];

                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);

                // Validate coordinates
                if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`Row ${i}: Invalid coordinates - lat:${lat}, lng:${lng}`);
                    errorCount++;
                    continue;
                }

                // Parse timestamp
                const submissionTime = parseDateString(timestampStr);
                if (!submissionTime) {
                    console.warn(`Row ${i}: Failed to parse timestamp - "${timestampStr}"`);
                    errorCount++;
                    continue;
                }

                const ageInMs = now - submissionTime;

                // Mode 2 Rule: Skip data older than 24 hours or with invalid ages
                // Allow small negative values (up to 15 min) for clock skew
                if (isNaN(ageInMs) || ageInMs < -900000 || ageInMs > oneDayInMs) {
                    console.warn(`Row ${i}: Age out of range - ageInMs:${ageInMs}`);
                    continue;
                }

                activeCount++;
                const ageInHours = ageInMs / (1000 * 60 * 60);

                let marker;

                if (ageInHours <= 1) {
                    // Item happened within the last hour: Pulsing neon effect
                    const pulseIcon = L.divIcon({
                        className: 'fresh-ping',
                        iconSize: [12, 12]
                    });
                    marker = L.marker([lat, lng], { icon: pulseIcon });
                } else {
                    // Scale opacity down dynamically from 0.8 to 0.1 based on age
                    const opacityScale = Math.max(0.1, 0.8 - (ageInHours / 24) * 0.7);
                    marker = L.circleMarker([lat, lng], {
                        radius: 5,
                        color: '#00ccff',
                        fillColor: '#00ccff',
                        fillOpacity: opacityScale,
                        opacity: opacityScale
                    });
                }

                const relativeLabel = ageInHours < 1 
                    ? `${Math.round(ageInHours * 60)} mins ago` 
                    : `${Math.round(ageInHours)} hours ago`;
                
                marker.bindPopup(`<b>Submission</b><br>${relativeLabel}`);
                marker.addTo(map);
                activeMarkers.push(marker);
            }

            // Update UI Counter panel with debug info if errors occurred
            const debugInfo = errorCount > 0 ? ` (${errorCount} entries skipped)` : '';
            document.getElementById('stats').innerText = `⚡ ${activeCount} Customers visits in last 24 hours${debugInfo}`;
            
            console.log(`Map updated: ${activeCount} markers shown, ${errorCount} entries with errors`);
        })
        .catch(error => {
            console.error("Failed to load data:", error);
            document.getElementById('stats').innerText = "❌ Unable to load data - Check settings";
        });
}

// Ingest data immediately upon landing
updateLiveMap();

// Poll every 60 seconds for live changes
setInterval(updateLiveMap, 60000);
