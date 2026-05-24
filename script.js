// Paste your exact published Google Sheet CSV URL here
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQJ5XPG5xNDSkli3nYtaQvYvr64VVqwk2dQli6RAJy1uBTnWVi-rjAmaGvFn3gu81CqSRdZ0Ys8JHua/pub?gid=0&single=true&output=csv";

// Initialize a dark-themed world map centered globally
const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// Keep track of active markers to clear them on refresh
let activeMarkers = [];

function updateLiveMap() {
    Papa.parse(SHEET_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Clear existing markers from previous run
            activeMarkers.forEach(marker => map.removeLayer(marker));
            activeMarkers = [];

            const now = new Date();
            const oneDayInMs = 24 * 60 * 60 * 1000;
            let activeCount = 0;

            results.data.forEach(row => {
                const lat = parseFloat(row["Latitude"]);
                const lng = parseFloat(row["Longitude"]);
                // FIX 1: Matches your exact lowercase "Timestamp" column header
                const timestampStr = row["TimeStamp"]; 

                if (isNaN(lat) || isNaN(lng) || !timestampStr) return;

                // --- FIX 2: Slash Parser for "DD/MM/YYYY HH:MM" ---
                const parts = timestampStr.trim().split(" ");
                if (parts.length < 2) return;

                // Splits using forward slashes "/" instead of dashes "-"
                const dateParts = parts[0].split("/");
                if (dateParts.length < 3) return;

                const day = dateParts[0];
                const month = dateParts[1];
                const year = dateParts[2];
                const time = parts[1];

                // Reconstruct into valid ISO standard
                const validIsoString = `${year}-${month}-${day}T${time}:00`;
                const submissionTime = new Date(validIsoString);
                // -------------------------------------------------

                const ageInMs = now - submissionTime;

                // Mode 2 Rule: Skip data older than 24 hours or completely invalid dates
                if (isNaN(ageInMs) || ageInMs < 0 || ageInMs > oneDayInMs) return;

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
                    const opacityScale = 0.8 - (ageInHours / 24) * 0.7;
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
            });

            // Update UI Counter panel
            document.getElementById('stats').innerText = `⚡ ${activeCount} Customer visits in past 24h`;
        }
    });
}

// Ingest data immediately upon landing
updateLiveMap();

// Poll the Google Sheet URL every 60 seconds for live changes without reloading the page
setInterval(updateLiveMap, 60000);
