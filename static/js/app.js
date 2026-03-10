const CALGARY_CENTER = [51.0447, -114.0719];
const DEFAULT_ZOOM = 11;

const map = L.map("map").setView(CALGARY_CENTER, DEFAULT_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// -----------------------------
// Overlapping marker spiderfier
// -----------------------------
const oms = new OverlappingMarkerSpiderfier(map, {
    keepSpiderfied: true,
    nearbyDistance: 20
});

const popup = L.popup();

oms.addListener("click", function (marker) {
    popup
        .setLatLng(marker.getLatLng())
        .setContent(marker.popupHtml)
        .openOn(map);
});

oms.addListener("spiderfy", function () {
    map.closePopup();
});

// -----------------------------
// Cluster layer
// -----------------------------
let clusterGroup = createClusterGroup();
map.addLayer(clusterGroup);

function createClusterGroup() {
    return L.markerClusterGroup({
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: false,
        disableClusteringAtZoom: 18
    });
}

// -----------------------------
// Helpers
// -----------------------------
function formatIssuedDate(value) {
    if (!value) return "N/A";
    return String(value).slice(0, 10);
}

function safeText(value) {
    return value ?? "N/A";
}

// -----------------------------
// Popup content
// -----------------------------
function buildPopupHtml(props) {
    return `
        <strong>Issued Date:</strong> ${formatIssuedDate(props.issueddate)}<br>
        <strong>Work Class Group:</strong> ${safeText(props.workclassgroup)}<br>
        <strong>Contractor Name:</strong> ${safeText(props.contractorname)}<br>
        <strong>Community Name:</strong> ${safeText(props.communityname)}<br>
        <strong>Original Address:</strong> ${safeText(props.originaladdress)}
    `;
}

// -----------------------------
// Clear old search results
// -----------------------------
function resetMapForNewSearch() {
    if (clusterGroup) {
        map.removeLayer(clusterGroup);
    }

    clusterGroup = createClusterGroup();
    map.addLayer(clusterGroup);

    oms.clearMarkers();
    map.closePopup();
    map.setView(CALGARY_CENTER, DEFAULT_ZOOM);
}

// -----------------------------
// Add new search results
// -----------------------------
function addPermitGeoJSONToMap(geojson) {
    const bounds = [];

    if (!geojson || !Array.isArray(geojson.features) || geojson.features.length === 0) {
        alert("No permits found for that date range.");
        return;
    }

    geojson.features.forEach((feature) => {
        if (!feature.geometry || feature.geometry.type !== "Point") return;
        if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2) return;

        const [lng, lat] = feature.geometry.coordinates;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const props = feature.properties || {};
        const marker = L.marker([lat, lng]);

        marker.popupHtml = buildPopupHtml(props);

        clusterGroup.addLayer(marker);
        oms.addMarker(marker);

        bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
    } else {
        alert("No valid point features were found for that date range.");
    }
}

// -----------------------------
// Search button
// -----------------------------
document.getElementById("search-btn").addEventListener("click", async () => {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    if (!startDate || !endDate) {
        alert("Please select both a start date and an end date.");
        return;
    }

    if (endDate < startDate) {
        alert("End date must be on or after start date.");
        return;
    }

    // Clear old results immediately so the next search fully refreshes the map
    resetMapForNewSearch();

    try {
        const url = `/api/permits?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Failed to fetch permit data.");
            return;
        }

        addPermitGeoJSONToMap(data);

    } catch (error) {
        console.error("Error fetching permit data:", error);
        alert("An error occurred while fetching permit data.");
    }
});

// -----------------------------
// Clear button
// -----------------------------
document.getElementById("clear-btn").addEventListener("click", () => {
    resetMapForNewSearch();
    document.getElementById("start-date").value = "";
    document.getElementById("end-date").value = "";
});

document.getElementById("search-btn").addEventListener("click", async () => {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    if (!startDate || !endDate) {
        alert("Please select both a start date and an end date.");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (startDate > today || endDate > today) {
        alert("Date range cannot exceed the present date.");
        return;
    }

    if (endDate < startDate) {
        alert("End date must be on or after start date.");
        return;
    }

    resetMapForNewSearch();

    try {
        const url = `/api/permits?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Failed to fetch permit data.");
            return;
        }

        addPermitGeoJSONToMap(data);

    } catch (error) {
        console.error("Error fetching permit data:", error);
        alert("An error occurred while fetching permit data.");
    }
});