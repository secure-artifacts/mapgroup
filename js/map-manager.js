/**
 * Map Manager & Visual Layers (Leaflet & OSRM)
 */
class MapManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.currentTileLayer = null;
        this.peopleMarkers = [];
        this.targetMarkers = [];
        this.activeCircle = null;
        this.allTargetCircles = {};
        this.spiderLines = [];
        this.activeRouteLines = [];
        this.probeCircle = null;
        this.probeLines = [];
        this.isProbeMode = false;
    }

    init(defaultCenter, defaultZoom, onMapClick, onMapMouseMove) {
        this.map = L.map(this.containerId, { zoomControl: false }).setView(defaultCenter, defaultZoom);
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.switchTileLayer('google_road');

        this.map.on('click', (e) => onMapClick(e));
        this.map.on('mousemove', (e) => onMapMouseMove(e));
    }

    switchTileLayer(providerKey) {
        const provider = APP_CONFIG.TILE_PROVIDERS[providerKey] || APP_CONFIG.TILE_PROVIDERS.google_road;
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }
        this.currentTileLayer = L.tileLayer(provider.url, { attribution: provider.attribution }).addTo(this.map);
    }

    renderPeopleMarkers(peopleData) {
        this.peopleMarkers.forEach(m => this.map.removeLayer(m));
        this.peopleMarkers = [];

        peopleData.forEach(p => {
            const marker = L.circleMarker([p.lat, p.lng], {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.9,
                radius: 5,
                weight: 2
            }).addTo(this.map);

            marker.bindPopup(`
                <div style="font-size:12px; color:#000;">
                    <strong>👤 ${p.name}</strong><br>
                    <span style="color:#666;">${p.address}</span>
                </div>
            `);
            this.peopleMarkers.push(marker);
        });
    }

    renderTargetMarkers(targetPoints, onTargetSelect) {
        this.targetMarkers.forEach(m => this.map.removeLayer(m));
        this.targetMarkers = [];

        targetPoints.forEach(t => {
            const marker = L.circleMarker([t.lat, t.lng], {
                color: t.color,
                fillColor: t.color,
                fillOpacity: 0.9,
                radius: 8,
                weight: 2
            }).addTo(this.map);

            marker.bindTooltip(t.name, { permanent: true, direction: 'bottom' });
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onTargetSelect(t.id);
            });
            this.targetMarkers.push(marker);
        });
    }

    drawCircle(latlng, radiusKm, color = '#3b82f6') {
        const radiusMeters = radiusKm * 1000;
        if (this.activeCircle) {
            this.activeCircle.setLatLng(latlng);
            this.activeCircle.setRadius(radiusMeters);
            this.activeCircle.setStyle({ color: color, fillColor: color });
        } else {
            this.activeCircle = L.circle(latlng, {
                color: color,
                weight: 3,
                fillColor: color,
                fillOpacity: 0.15,
                radius: radiusMeters
            }).addTo(this.map);
        }
    }

    renderAllTargetCircles(targetPoints, activeTargetId) {
        for (let key in this.allTargetCircles) {
            this.map.removeLayer(this.allTargetCircles[key]);
        }
        this.allTargetCircles = {};

        targetPoints.forEach(t => {
            if (t.visible && t.id !== activeTargetId) { 
                const circle = L.circle([t.lat, t.lng], {
                    radius: t.radius * 1000,
                    color: t.color,
                    weight: 2,
                    dashArray: '4, 4',
                    fillColor: t.color,
                    fillOpacity: 0.1
                }).addTo(this.map);
                this.allTargetCircles[t.id] = circle;
            }
        });
    }

    clearActiveCircle() {
        if (this.activeCircle) {
            this.map.removeLayer(this.activeCircle);
            this.activeCircle = null;
        }
    }

    clearRoutesAndSpokes() {
        this.spiderLines.forEach(l => this.map.removeLayer(l));
        this.spiderLines = [];
        this.activeRouteLines.forEach(l => this.map.removeLayer(l));
        this.activeRouteLines = [];
    }

    drawSpokeLines(centerLatLng, results, color = '#3b82f6') {
        results.forEach(r => {
            const line = L.polyline([centerLatLng, [r.lat, r.lng]], {
                color: color,
                weight: 1.5,
                dashArray: '4, 6',
                opacity: 0.6
            }).addTo(this.map);
            this.spiderLines.push(line);
        });
    }

    async fetchSingleRoute(centerLat, centerLng, personLat, personLng) {
        this.activeRouteLines.forEach(l => this.map.removeLayer(l));
        this.activeRouteLines = [];

        const url = `https://router.project-osrm.org/route/v1/driving/${centerLng},${centerLat};${personLng},${personLat}?geometries=geojson`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                const rLine = L.polyline(coords, {
                    color: '#f43f5e',
                    weight: 4,
                    opacity: 0.9
                }).addTo(this.map);
                this.activeRouteLines.push(rLine);
                this.map.fitBounds(rLine.getBounds(), { padding: [60, 60] });
            }
        } catch (err) { alert("路线计算请求失败，请重试。"); }
    }

    async fetchBatchRoutes(centerLatLng, results) {
        this.activeRouteLines.forEach(l => this.map.removeLayer(l));
        this.activeRouteLines = [];

        const maxRoutes = 15;
        const count = Math.min(results.length, maxRoutes);

        for (let i = 0; i < count; i++) {
            const r = results[i];
            const url = `https://router.project-osrm.org/route/v1/driving/${centerLatLng.lng},${centerLatLng.lat};${r.lng},${r.lat}?geometries=geojson`;
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.routes && data.routes.length > 0) {
                    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    const rLine = L.polyline(coords, {
                        color: '#f43f5e',
                        weight: 2.5,
                        opacity: 0.85
                    }).addTo(this.map);
                    this.activeRouteLines.push(rLine);
                }
                await new Promise(res => setTimeout(res, 100));
            } catch(e) { console.error(e); }
        }

        if(this.activeRouteLines.length > 0) {
            const group = new L.featureGroup(this.activeRouteLines);
            this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }

    fitBoundsToPeople(peopleData) {
        if (peopleData.length > 0) {
            const bounds = L.latLngBounds(peopleData.map(p => [p.lat, p.lng]));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}
