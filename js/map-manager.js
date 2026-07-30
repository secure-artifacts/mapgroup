/**
 * Map Manager & Enterprise Visual Layers (Leaflet & OSRM)
 * Features: High-Contrast Group Color Coding, Global Label Toggle, Custom Color Picker, Multi-Spoke Radiating Lines & Territory Polygons
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
        this.territoryPolygons = [];
        this.activeRouteLines = [];
        this.probeCircle = null;
        this.probeLines = [];
        this.isProbeMode = false;
        
        // Enterprise UI Settings
        this.showPersonLabels = true; // Global Toggle for Personnel Name Labels
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

    setShowPersonLabels(show) {
        this.showPersonLabels = show;
    }

    /**
     * Renders Enterprise High-Contrast Personnel Markers.
     * Inherits group theme color and supports permanent name label toggle.
     */
    renderPeopleMarkers(peopleData, targetPoints = []) {
        this.peopleMarkers.forEach(m => this.map.removeLayer(m));
        this.peopleMarkers = [];

        // Build group index map
        const targetColorMap = {};
        targetPoints.forEach(t => {
            if(t.visible) targetColorMap[t.id] = t.color;
        });

        peopleData.forEach((p, idx) => {
            // Find which target/group this person belongs to
            let matchedTarget = null;
            let minDistance = Infinity;

            targetPoints.forEach(t => {
                if(!t.visible) return;
                const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
                if (d <= t.radius && d < minDistance) {
                    minDistance = d;
                    matchedTarget = t;
                }
            });

            const groupColor = matchedTarget ? matchedTarget.color : '#3b82f6';
            const groupName = matchedTarget ? matchedTarget.name : '未归组';
            const personIndex = idx + 1;

            // Name label HTML (Shown only if showPersonLabels is TRUE)
            const nameBadgeHTML = this.showPersonLabels ? `
                <div class="person-name-badge" style="border-color:${groupColor};">
                    <i class="fa-solid fa-user" style="color:${groupColor}"></i>
                    <span>${p.name}</span>
                </div>
            ` : '';

            // Icon size & anchor adjustment
            const iconWidth = this.showPersonLabels ? 150 : 32;
            const iconHeight = 32;

            const customIcon = L.divIcon({
                className: 'person-custom-marker',
                html: `
                    <div class="person-marker-wrapper">
                        <div class="person-marker-pin-large" style="background-color:${groupColor};">
                            ${personIndex}
                        </div>
                        ${nameBadgeHTML}
                    </div>
                `,
                iconSize: [iconWidth, iconHeight],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([p.lat, p.lng], { icon: customIcon }).addTo(this.map);

            marker.bindPopup(`
                <div style="font-size:12px; color:#000; padding:6px; min-width:160px;">
                    <div style="font-weight:bold; font-size:14px; color:${groupColor}">👤 ${p.name}</div>
                    <div style="color:#666; margin-top:3px;">${p.address}</div>
                    <div style="margin-top:6px; font-size:11px; color:#555; background:#f1f5f9; padding:4px 8px; border-radius:6px;">
                        归属组: <strong>${groupName}</strong> ${minDistance < Infinity ? `(${minDistance.toFixed(2)} km)` : ''}
                    </div>
                </div>
            `);
            this.peopleMarkers.push(marker);
        });
    }

    /**
     * Renders Group Center markers with member count badges and custom theme color.
     */
    renderTargetMarkers(targetPoints, peopleData, onTargetSelect) {
        this.targetMarkers.forEach(m => this.map.removeLayer(m));
        this.targetMarkers = [];

        targetPoints.forEach((t) => {
            let memberCount = 0;
            peopleData.forEach(p => {
                const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
                if (d <= t.radius) memberCount++;
            });

            const centerIcon = L.divIcon({
                className: 'target-center-marker',
                html: `
                    <div class="target-center-wrapper">
                        <div class="target-center-pin" style="background-color:${t.color};">
                            <i class="fa-solid fa-flag"></i>
                        </div>
                        <div class="target-center-title" style="border-color:${t.color};">
                            <span>${t.name}</span>
                            <span class="target-count-tag" style="background:${t.color}; color:#fff;">${memberCount}人</span>
                        </div>
                    </div>
                `,
                iconSize: [180, 44],
                iconAnchor: [18, 22]
            });

            const marker = L.marker([t.lat, t.lng], { icon: centerIcon }).addTo(this.map);

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
                    dashArray: '5, 5',
                    fillColor: t.color,
                    fillOpacity: 0.12
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
        this.territoryPolygons.forEach(p => this.map.removeLayer(p));
        this.territoryPolygons = [];
        this.activeRouteLines.forEach(l => this.map.removeLayer(l));
        this.activeRouteLines = [];
    }

    /**
     * Draws dispersed multi-spoke lines for all groups simultaneously with group theme color.
     */
    drawAllGroupSpokeLines(peopleData, targetPoints) {
        this.spiderLines.forEach(l => this.map.removeLayer(l));
        this.spiderLines = [];

        targetPoints.forEach(t => {
            if(!t.visible) return;
            const centerLatLng = L.latLng(t.lat, t.lng);

            peopleData.forEach(p => {
                const distKm = centerLatLng.distanceTo(L.latLng(p.lat, p.lng)) / 1000;
                if (distKm <= t.radius) {
                    const line = L.polyline([centerLatLng, [p.lat, p.lng]], {
                        color: t.color,
                        weight: 2,
                        dashArray: '5, 7',
                        opacity: 0.8
                    }).addTo(this.map);

                    line.bindTooltip(`${p.name} -> ${t.name}: ${distKm.toFixed(2)} km`, { sticky: true });
                    this.spiderLines.push(line);
                }
            });
        });
    }

    drawSpokeLines(centerLatLng, results, color = '#3b82f6') {
        results.forEach(r => {
            const line = L.polyline([centerLatLng, [r.lat, r.lng]], {
                color: color,
                weight: 2,
                dashArray: '5, 7',
                opacity: 0.85
            }).addTo(this.map);
            line.bindTooltip(`${r.name}: ${r.distance.toFixed(2)} km`, { sticky: true });
            this.spiderLines.push(line);
        });
    }

    drawGroupTerritoryPolygons(peopleData, targetPoints) {
        this.territoryPolygons.forEach(p => this.map.removeLayer(p));
        this.territoryPolygons = [];

        targetPoints.forEach(t => {
            if(!t.visible) return;
            const groupCoords = [[t.lat, t.lng]];

            peopleData.forEach(p => {
                const d = L.latLng(t.lat, t.lng).distanceTo(L.latLng(p.lat, p.lng)) / 1000;
                if (d <= t.radius) {
                    groupCoords.push([p.lat, p.lng]);
                }
            });

            if (groupCoords.length >= 3) {
                const hullPoints = this.calculateConvexHull(groupCoords);
                const polygon = L.polygon(hullPoints, {
                    color: t.color,
                    weight: 1.5,
                    dashArray: '4, 6',
                    fillColor: t.color,
                    fillOpacity: 0.1
                }).addTo(this.map);
                this.territoryPolygons.push(polygon);
            }
        });
    }

    calculateConvexHull(points) {
        if (points.length <= 3) return points;
        points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

        const crossProduct = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        
        const lower = [];
        for (let p of points) {
            while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        upper.pop();
        lower.pop();
        return lower.concat(upper);
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
                    opacity: 0.95
                }).addTo(this.map);
                this.activeRouteLines.push(rLine);
                this.map.fitBounds(rLine.getBounds(), { padding: [60, 60] });
            }
        } catch (err) { alert("路线计算请求失败，请重试。"); }
    }

    async fetchBatchRoutes(centerLatLng, results) {
        this.activeRouteLines.forEach(l => this.map.removeLayer(l));
        this.activeRouteLines = [];

        if (!centerLatLng || !results || results.length === 0) return;

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
                        weight: 3,
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
            this.map.fitBounds(bounds, { padding: [60, 60] });
        }
    }
}
