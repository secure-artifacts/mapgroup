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

    init(defaultCenter, defaultZoom, onMapClick, onMapMouseMove, onAltWheelResize) {
        this.map = L.map(this.containerId, { zoomControl: false }).setView(defaultCenter, defaultZoom);
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.switchTileLayer('google_road');

        this.map.on('click', (e) => onMapClick(e));
        this.map.on('mousemove', (e) => onMapMouseMove(e));

        // 按住 Alt 键 + 滚轮快捷调半径 (用 capture: true 抢在地图缩放前拦截)
        const container = this.map.getContainer();
        container.addEventListener('wheel', (e) => {
            const isAlt = e.altKey || window.isAltKeyPressed;
            if (isAlt) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const delta = e.deltaY < 0 ? 1.0 : -1.0;
                if (typeof onAltWheelResize === 'function') {
                    onAltWheelResize(delta);
                }
            }
        }, true);
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
    /**
     * Groups people by proximity — returns a Map keyed by "lat,lng" bucket
     * with value being an array of { originalIndex, person } objects.
     * Threshold ~0.00015° ≈ ~15 meters — anything closer is considered "same location".
     */
    _groupByLocation(peopleData) {
        const THRESHOLD = 0.00015;
        const buckets = new Map(); // key: "roundedLat,roundedLng" => [{idx, person}]

        peopleData.forEach((p, idx) => {
            const bucketKey = `${(Math.round(p.lat / THRESHOLD) * THRESHOLD).toFixed(6)},${(Math.round(p.lng / THRESHOLD) * THRESHOLD).toFixed(6)}`;
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, []);
            }
            buckets.get(bucketKey).push({ idx, person: p });
        });

        return buckets;
    }

    /**
     * Calculate offset coordinates for markers sharing the same location.
     * Distributes them in a circle; offset size adapts to current zoom level.
     */
    _getOffsetLatLng(baseLat, baseLng, memberIndex, totalMembers) {
        if (totalMembers <= 1) return [baseLat, baseLng];

        // Offset radius in degrees — decreases with zoom for natural feel
        const zoom = this.map.getZoom();
        const offsetRadius = 0.0006 * Math.pow(2, 15 - zoom); // ~60m at zoom 15

        const angle = (2 * Math.PI * memberIndex) / totalMembers - Math.PI / 2;
        const offsetLat = baseLat + offsetRadius * Math.sin(angle);
        const offsetLng = baseLng + offsetRadius * Math.cos(angle);

        return [offsetLat, offsetLng];
    }

    renderPeopleMarkers(peopleData, targetPoints = [], groupMeta = {}) {
        this.peopleMarkers.forEach(m => this.map.removeLayer(m));
        this.peopleMarkers = [];

        // Build group index map
        const targetColorMap = {};
        targetPoints.forEach(t => {
            if(t.visible) targetColorMap[t.id] = t.color;
        });

        // Detect overlapping locations
        const locationBuckets = this._groupByLocation(peopleData);

        // Build a lookup: originalIndex -> { offsetIndex, totalAtLocation }
        const offsetInfo = {};
        locationBuckets.forEach((members) => {
            members.forEach((m, posInGroup) => {
                offsetInfo[m.idx] = {
                    posInGroup,
                    totalAtLocation: members.length,
                    centerLat: members[0].person.lat,
                    centerLng: members[0].person.lng
                };
            });
        });

        peopleData.forEach((p, idx) => {
            // Color by person's own group first, fall back to target proximity
            let groupColor = '#4285F4';
            let groupName = p.group || '未分组';
            let minDistance = Infinity;
            
            // Use group meta color if available
            if (p.group && groupMeta[p.group]) {
                groupColor = groupMeta[p.group].color;
                // Still calculate min distance to nearest target for popup info
                targetPoints.forEach(t => {
                    if(!t.visible) return;
                    const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
                    if (d <= t.radius && d < minDistance) {
                        minDistance = d;
                    }
                });
            } else {
                // Fall back to target-based coloring
                let matchedTarget = null;

                targetPoints.forEach(t => {
                    if(!t.visible) return;
                    const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
                    if (d <= t.radius && d < minDistance) {
                        minDistance = d;
                        matchedTarget = t;
                    }
                });

                if (matchedTarget) {
                    groupColor = matchedTarget.color;
                    groupName = matchedTarget.name;
                }
            }

            // Get offset info for this person
            const info = offsetInfo[idx];
            const isOverlapping = info.totalAtLocation > 1;

            // Calculate display position (offset if overlapping)
            let displayLat = p.lat;
            let displayLng = p.lng;
            if (isOverlapping) {
                [displayLat, displayLng] = this._getOffsetLatLng(
                    info.centerLat, info.centerLng,
                    info.posInGroup, info.totalAtLocation
                );
            }

            // Clean Google Maps-style teardrop pin SVG
            const pinSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
                    <defs>
                        <filter id="shadow${idx}" x="-20%" y="-10%" width="140%" height="130%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/>
                        </filter>
                    </defs>
                    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" 
                          fill="${groupColor}" filter="url(#shadow${idx})"/>
                    <circle cx="14" cy="14" r="5" fill="#fff"/>
                </svg>
            `;

            const customIcon = L.divIcon({
                className: 'person-pin-marker',
                html: pinSvg,
                iconSize: [28, 40],
                iconAnchor: [14, 40],
                popupAnchor: [0, -36]
            });

            // Use offset position for display, keep original coords for popup info
            const marker = L.marker([displayLat, displayLng], {
                icon: customIcon,
                zIndexOffset: isOverlapping ? (info.posInGroup * 10) : 0
            }).addTo(this.map);

            // Show name on hover as a clean tooltip
            marker.bindTooltip(p.name, {
                direction: 'top',
                offset: [0, -38],
                className: 'person-tooltip'
            });

            marker.bindPopup(`
                <div style="font-size:12px; color:#000; padding:6px; min-width:160px;">
                    <div style="font-weight:bold; font-size:14px; color:${groupColor}">👤 ${p.name}</div>
                    <div style="color:#666; margin-top:3px;">${p.address}</div>
                    ${isOverlapping ? `<div style="margin-top:4px; font-size:10px; color:#f59e0b; background:#fef3c7; padding:3px 8px; border-radius:6px;">📍 同地点共 ${info.totalAtLocation} 人</div>` : ''}
                    <div style="margin-top:6px; font-size:11px; color:#555; background:#f1f5f9; padding:4px 8px; border-radius:6px;">
                        归属组: <strong>${groupName}</strong> ${minDistance < Infinity ? `(${minDistance.toFixed(2)} km)` : ''}
                    </div>
                </div>
            `);
            this.peopleMarkers.push(marker);
        });

        // Re-apply offsets when zoom changes so spread adapts
        if (!this._zoomOffsetHandler) {
            this._zoomOffsetHandler = () => {
                if (this._lastPeopleData && this._lastTargetPoints) {
                    this.renderPeopleMarkers(this._lastPeopleData, this._lastTargetPoints);
                }
            };
            this.map.on('zoomend', this._zoomOffsetHandler);
        }
        this._lastPeopleData = peopleData;
        this._lastTargetPoints = targetPoints;
    }

    /**
     * 为选址中心 Marker 绑定原生 Pointer/Mouse 手势拖拽控制器
     * 解决 Leaflet divIcon 自带 draggable 的 DOM 冒泡与地图平移抢占 Bug
     */
    _bindNativeMarkerDrag(marker, targetId, onTargetSelect, onTargetMove, onTargetResize) {
        const el = marker.getElement();
        if (!el) return;

        let isDragging = false;
        let startClientX = 0;
        let startClientY = 0;
        let startLatLng = null;
        let startRadius = 0;
        let hasMoved = false;

        const onPointerDown = (e) => {
            if (e.button !== 0) return; // 仅左键响应
            
            // 严格标准：必须按住键盘 Shift 键才响应鼠标拖动移动中心位置！不按 Shift 键绝不响应拖动，100% 零误触！
            const isShiftPressed = window.isShiftKeyPressed || e.shiftKey;
            if (!isShiftPressed) return;

            // 阻止 Leaflet 地图捕获 mouse/pointer 事件进行大地图平移！
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            hasMoved = false;
            startClientX = e.clientX;
            startClientY = e.clientY;
            startLatLng = marker.getLatLng();

            // 临时强行锁死 Leaflet 地图的原生拖拽，保障 100% 专一操纵 Marker 点！
            if (this.map && this.map.dragging) {
                this.map.dragging.disable();
            }

            if (typeof onTargetSelect === 'function') {
                onTargetSelect(targetId);
            }

            const onPointerMove = (moveEvt) => {
                if (!isDragging) return;
                moveEvt.preventDefault();
                moveEvt.stopPropagation();

                const dx = moveEvt.clientX - startClientX;
                const dy = moveEvt.clientY - startClientY;

                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    hasMoved = true;
                }

                // 利用 Leaflet 的像素坐标与经纬度互转矩阵计算精准点位
                const startPoint = this.map.latLngToContainerPoint(startLatLng);
                const currentPoint = L.point(startPoint.x + dx, startPoint.y + dy);
                const currentLatLng = this.map.containerPointToLatLng(currentPoint);

                // 按住 Shift 键鼠标拖拽：唯一用于平滑挪动选址中心位置
                marker.setLatLng(currentLatLng);
                if (typeof onTargetMove === 'function') {
                    onTargetMove(targetId, currentLatLng.lat, currentLatLng.lng, false);
                }
            };

            const onPointerUp = (upEvt) => {
                if (!isDragging) return;
                isDragging = false;
                upEvt.preventDefault();
                upEvt.stopPropagation();

                // 解锁重新恢复 Leaflet 地图平移
                if (this.map && this.map.dragging) {
                    this.map.dragging.enable();
                }

                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('mouseup', onPointerUp);

                const finalLatLng = marker.getLatLng();

                if (hasMoved) {
                    requestAnimationFrame(() => {
                        if (typeof onTargetMove === 'function') {
                            onTargetMove(targetId, finalLatLng.lat, finalLatLng.lng, true);
                        }
                    });
                }
            };

            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUp, { passive: false });
            window.addEventListener('mousemove', onPointerMove, { passive: false });
            window.addEventListener('mouseup', onPointerUp, { passive: false });
        };

        el.addEventListener('pointerdown', onPointerDown, { passive: false });
        el.addEventListener('mousedown', onPointerDown, { passive: false });
    }

    /**
     * Renders Group Center markers with member count badges and custom theme color.
     */
    renderTargetMarkers(targetPoints, peopleData, onTargetSelect, onTargetMove, onTargetResize) {
        if (this.targetMarkers && this.targetMarkers.length > 0) {
            this.targetMarkers.forEach(m => {
                if (m) {
                    m.off();
                    this.map.removeLayer(m);
                }
            });
        }
        this.targetMarkers = [];

        targetPoints.forEach((t) => {
            if (!t.visible) return;
            let memberCount = 0;
            peopleData.forEach(p => {
                const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
                if (d <= t.radius) memberCount++;
            });

            const centerIcon = L.divIcon({
                className: 'target-center-marker',
                html: `
                    <div class="target-center-wrapper" title="按住 Shift 键 + 拖拽挪动位置 | 按住 Alt 键 + 滚轮调节覆盖半径">
                        <div class="target-center-pin" style="background-color:${t.color};">
                            <i class="fa-solid fa-arrows-up-down-left-right"></i>
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

            const marker = L.marker([t.lat, t.lng], { 
                icon: centerIcon,
                zIndexOffset: 20000
            }).addTo(this.map);

            // 挂载独立原生 Pointer/Mouse 手势拖拽接管控制器
            setTimeout(() => {
                this._bindNativeMarkerDrag(marker, t.id, onTargetSelect, onTargetMove, onTargetResize);
            }, 0);

            this.targetMarkers.push(marker);
        });
    }

    drawCircle(latlng, radiusKm, color = '#3b82f6') {
        // 废除独立的 activeCircle 重叠绘制，统一使用 clearActiveCircle 安全清理
        this.clearActiveCircle();
        const radiusMeters = radiusKm * 1000;
        this.activeCircle = L.circle(latlng, {
            color: color,
            weight: 3,
            fillColor: color,
            fillOpacity: 0.15,
            radius: radiusMeters,
            interactive: false
        }).addTo(this.map);
    }

    renderAllTargetCircles(targetPoints, activeTargetId) {
        // 必须优先完全销毁已存在的 activeCircle，彻底杜绝双层同重叠大圈！
        this.clearActiveCircle();

        for (let key in this.allTargetCircles) {
            if (this.allTargetCircles[key]) {
                this.map.removeLayer(this.allTargetCircles[key]);
            }
        }
        this.allTargetCircles = {};

        if (!targetPoints || targetPoints.length === 0) return;

        targetPoints.forEach(t => {
            if (t.visible) { 
                const isActive = t.id === activeTargetId;
                const circle = L.circle([t.lat, t.lng], {
                    radius: t.radius * 1000,
                    color: t.color,
                    weight: isActive ? 3 : 2,
                    dashArray: isActive ? null : '5, 5',
                    fillColor: t.color,
                    fillOpacity: isActive ? 0.18 : 0.12,
                    interactive: false
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

    fitBoundsToTargets(targetPoints) {
        if (targetPoints && targetPoints.length > 0) {
            const bounds = L.latLngBounds(targetPoints.map(t => [t.lat, t.lng]));
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [60, 60] });
            }
        }
    }

    renderPreviewLayer(previewCenters, peopleData = []) {
        this.clearPreviewLayer();
        this.previewLayers = [];

        if (!previewCenters || previewCenters.length === 0) return;

        const colors = APP_CONFIG.COLORS;
        const assignedPeopleSet = new Set();

        previewCenters.forEach((c, idx) => {
            const color = colors[idx % colors.length];
            const centerLatLng = L.latLng(c.lat, c.lng);

            // 1. 精致水滴中心 Icon (与正式节点 100% 保持一致)
            const centerIcon = L.divIcon({
                className: 'custom-target-marker',
                html: `
                    <div style="background:${color}; width:36px; height:36px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px ${color}88; border:2px solid #fff;">
                        <span style="transform:rotate(45deg); color:#fff; font-size:12px; font-weight:800;">${idx + 1}</span>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36]
            });

            const marker = L.marker([c.lat, c.lng], { icon: centerIcon }).addTo(this.map);
            marker.bindTooltip(`📍 ${c.name} (${c.people ? c.people.length : 0}人)`, { sticky: true });
            this.previewLayers.push(marker);

            // 2. 正式标准覆盖圆
            if (c.radius) {
                const circle = L.circle(centerLatLng, {
                    radius: c.radius * 1000,
                    color: color,
                    weight: 2,
                    dashArray: '5, 5',
                    fillColor: color,
                    fillOpacity: 0.12
                }).addTo(this.map);
                this.previewLayers.push(circle);
            }

            // 3. 正式标准辐射连线 (Spokes) 与 组员 Marker 染色
            if (c.people && c.people.length > 0) {
                c.people.forEach(p => {
                    assignedPeopleSet.add(p.name + '_' + p.lat + '_' + p.lng);
                    const distKm = centerLatLng.distanceTo(L.latLng(p.lat, p.lng)) / 1000;
                    const line = L.polyline([centerLatLng, [p.lat, p.lng]], {
                        color: color,
                        weight: 2,
                        dashArray: '5, 7',
                        opacity: 0.8
                    }).addTo(this.map);

                    line.bindTooltip(`${p.name} -> ${c.name}: ${distKm.toFixed(2)} km`, { sticky: true });
                    this.previewLayers.push(line);

                    // 4. 将被分配到该组的人员点位以组主题色彩渲染呈现
                    const pMarker = L.circleMarker([p.lat, p.lng], {
                        radius: 7,
                        fillColor: color,
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.95
                    }).addTo(this.map);
                    pMarker.bindTooltip(`👤 ${p.name} (归属: ${c.name})`, { sticky: true });
                    this.previewLayers.push(pMarker);
                });
            }
        });

        // 5. 将未落在任何中心覆盖范围内的孤立离群人员以半透明灰色展示
        if (peopleData && peopleData.length > 0) {
            peopleData.forEach(p => {
                const key = p.name + '_' + p.lat + '_' + p.lng;
                if (!assignedPeopleSet.has(key)) {
                    const unassignedMarker = L.circleMarker([p.lat, p.lng], {
                        radius: 5,
                        fillColor: '#64748b',
                        color: '#475569',
                        weight: 1,
                        opacity: 0.7,
                        fillOpacity: 0.5
                    }).addTo(this.map);
                    unassignedMarker.bindTooltip(`⚠️ ${p.name} (离群未覆盖)`, { sticky: true });
                    this.previewLayers.push(unassignedMarker);
                }
            });
        }
    }

    clearPreviewLayer() {
        if (this.previewLayers && this.previewLayers.length > 0) {
            this.previewLayers.forEach(l => this.map.removeLayer(l));
            this.previewLayers = [];
        }
    }
}
