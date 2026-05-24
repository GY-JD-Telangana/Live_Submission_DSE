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
                // Ensure field names match your exact sheet column names!
                const lat = parseFloat(row["Latitude"]);
                const lng = parseFloat(row["Longitude"]);
                const timestampStr = row["Timestamp"]; 

                if (isNaN(lat) || !lng || !timestampStr) return;

                const submissionTime = new Date(timestampStr);
                const ageInMs = now - submissionTime;

                // Mode 2 Rule: Skip data older than 24 hours
                if (ageInMs < 0 || ageInMs > oneDayInMs) return;

                activeCount++;
                const ageInHours = ageInMs / (1000 * 60 * 60);

                let marker;

                if (ageInHours <= 1) {
                    // Item happened within the last hour: Display bright pulsing effect
                    const pulseIcon = L.divIcon({
                        className: 'fresh-ping',
                        iconSize: [12, 12]
                    });
                    marker = L.marker([lat, lng], { icon: pulseIcon });
                } else {
                    // Item is older: Scale opacity dynamically from 0.8 down to 0.1
                    const opacityScale = 0.8 - (ageInHours / 24) * 0.7;
                    marker = L.circleMarker([lat, lng], {
                        radius: 5,
                        color: '#00ccff',
                        fillColor: '#00ccff',
                        fillOpacity: opacityScale,
                        opacity: opacityScale
                    });
                }

                // Add a dynamic tooltip pop-up showing relative age
                const relativeLabel = ageInHours < 1 
                    ? `${Math.round(ageInHours * 60)} mins ago` 
                    : `${Math.round(ageInHours)} hours ago`;
                
                marker.bindPopup(`<b>Submission</b><br>${relativeLabel}`);
                marker.addTo(map);
                activeMarkers.push(marker);
            });

            // Update UI Counter panel
            document.getElementById('stats').innerText = `⚡ ${activeCount} active points in past 24h`;
        }
    });
}

// Ingest data immediately upon landing
updateLiveMap();

// Poll the Google Sheet URL every 60 seconds for live changes without reloading the page
setInterval(updateLiveMap, 60000);