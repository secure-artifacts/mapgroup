/**
 * Free Geocoding Service — Multi-provider with fallback
 * Provider 0: Google Apps Script (最高优先级, Google 数据, 完全免费)
 * Provider 1: Geoapify (best accuracy, 3000/day per API key)
 * Provider 2: Photon (Komoot) — fast, no API key, no strict rate limit
 * Provider 3: Nominatim (OSM) — backup, 1 req/sec limit
 */
async function freeGeocode(address) {
    if (!address || !address.trim()) return null;
    
    // Check if input is already formatted as "Lat, Lng"
    const coordMatch = address.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng, displayName: address };
        }
    }

    // Get selected country from the UI selector
    const countryCode = (typeof getSelectedCountryCode === 'function') ? getSelectedCountryCode() : '';
    const countryName = (typeof getSelectedCountryName === 'function') ? getSelectedCountryName() : '';

    // Build query: append country name if not already present
    let query = address.trim();
    if (countryName) {
        const hasCountryContext = query.toLowerCase().includes(countryName.toLowerCase());
        if (!hasCountryContext) {
            query += ', ' + countryName;
        }
    }

    // Provider 0: Google Apps Script (最高优先级 — Google 数据 + 完全免费)
    const scriptUrl = getGoogleScriptUrl();
    if (scriptUrl) {
        const result = await _googleScriptGeocode(scriptUrl, query, countryCode);
        if (result) return result;
    }

    // Provider 1: Geoapify (if API key configured)
    const apiKey = getGeoapifyKey();
    if (apiKey) {
        const result = await _geoapifySearch(query, countryCode, apiKey);
        if (result) return result;
    }

    // Provider 2: Photon (fast, no strict rate limit)
    let result = await _photonSearch(query, countryCode);
    if (result) return result;
    
    // Provider 3: Nominatim (backup)
    result = await _nominatimSearch(query, countryCode);
    return result;
}

/**
 * Google Apps Script 地理编码 (完全免费, 使用 Google 内置 Maps.newGeocoder)
 */
async function _googleScriptGeocode(scriptUrl, query, countryCode) {
    try {
        const params = new URLSearchParams({
            action: 'geocode',
            address: query
        });
        if (countryCode) params.append('region', countryCode.toLowerCase());

        const resp = await fetch(`${scriptUrl}?${params.toString()}`);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (data.success) {
            console.log('[Geocode] ✅ Google Apps Script 成功:', data.displayName);
            return {
                lat: data.lat,
                lng: data.lng,
                displayName: data.displayName || query
            };
        }
    } catch (e) {
        console.warn('[Geocode] Google Apps Script error:', e.message);
    }
    return null;
}

// ======================== Geoapify ========================

/**
 * Get saved Geoapify API Key
 */
function getGeoapifyKey() {
    const input = document.getElementById('geoapify-api-key');
    return input ? input.value.trim() : '';
}

/**
 * Save Geoapify API Key to localStorage
 */
function saveGeoapifyKey() {
    const key = getGeoapifyKey();
    localStorage.setItem('geoapify_api_key', key);
}

/**
 * Load saved Geoapify API Key on page load
 */
function loadGeoapifyKey() {
    const saved = localStorage.getItem('geoapify_api_key');
    if (saved) {
        const input = document.getElementById('geoapify-api-key');
        if (input) input.value = saved;
    }
}

/**
 * Test Geoapify API Key connection
 */
async function testGeoapifyKey() {
    const key = getGeoapifyKey();
    const statusDiv = document.getElementById('geoapify-status');
    
    if (!key) {
        statusDiv.innerHTML = '<span style="color:#ef4444;">❌ 请先粘贴 API Key</span>';
        return;
    }
    
    statusDiv.innerHTML = '<span style="color:var(--accent-amber);"><i class="fa-solid fa-spinner fa-spin"></i> 测试中...</span>';
    
    try {
        const result = await _geoapifySearch('New York, USA', 'us', key);
        if (result) {
            statusDiv.innerHTML = `<span style="color:var(--accent-emerald);">✅ API Key 有效！测试: ${result.displayName.substring(0, 50)}...</span>`;
        } else {
            statusDiv.innerHTML = '<span style="color:#ef4444;">❌ API Key 无效或已超额</span>';
        }
    } catch (e) {
        statusDiv.innerHTML = `<span style="color:#ef4444;">❌ 错误: ${e.message}</span>`;
    }
}

/**
 * Geoapify Geocoding API — High accuracy, 3000 free requests/day
 * https://www.geoapify.com/geocoding-api
 */
async function _geoapifySearch(query, countryCode, apiKey) {
    try {
        let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${apiKey}&limit=1&format=json`;
        if (countryCode) {
            url += `&filter=countrycode:${countryCode.toLowerCase()}`;
        }
        
        const resp = await fetch(url);
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data && data.results && data.results.length > 0) {
            const r = data.results[0];
            return {
                lat: r.lat,
                lng: r.lon,
                displayName: r.formatted || query
            };
        }
    } catch (e) {
        console.warn("Geoapify geocoding error:", e);
    }
    return null;
}

// ======================== Photon ========================

/**
 * Photon Geocoding API (by Komoot) — Based on OpenStreetMap data
 * No API key required, no strict rate limit
 */
async function _photonSearch(query, countryCode) {
    try {
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
        
        const resp = await fetch(url);
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data && data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties;
            const displayName = [props.name, props.city, props.state, props.country]
                .filter(Boolean).join(', ');
            return { lat, lng, displayName };
        }
    } catch (e) {
        console.warn("Photon geocoding error:", e);
    }
    return null;
}

// ======================== Nominatim ========================

/**
 * Nominatim Geocoding API (OpenStreetMap) — Backup provider
 * Requires User-Agent, 1 request/second limit
 */
async function _nominatimSearch(query, countryCode) {
    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        if (countryCode) {
            url += `&countrycodes=${countryCode}`;
        }
        
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'SmartGroupMap/1.0 (map-geocoding-tool)',
                'Accept-Language': 'en,zh-CN;q=0.9'
            }
        });
        
        if (resp.status === 429) return null;
        if (!resp.ok) return null;
        
        const data = await resp.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }
    } catch (e) {
        console.warn("Nominatim geocoding error:", e);
    }
    return null;
}

// ======================== Google Places 搜索 (双模式) ========================

/**
 * Get/Save/Load Google Script URL (Apps Script 部署地址)
 */
function getGoogleScriptUrl() {
    const input = document.getElementById('google-script-url');
    return input ? input.value.trim() : (localStorage.getItem('google_script_url') || '');
}
function saveGoogleScriptUrl() {
    localStorage.setItem('google_script_url', getGoogleScriptUrl());
}
function loadGoogleScriptUrl() {
    const saved = localStorage.getItem('google_script_url');
    if (saved) {
        const input = document.getElementById('google-script-url');
        if (input) input.value = saved;
    }
}

/**
 * Get/Save/Load Google Maps API Key
 */
function getGoogleMapsKey() {
    const input = document.getElementById('google-maps-api-key');
    return input ? input.value.trim() : (localStorage.getItem('google_maps_api_key') || '');
}
function saveGoogleMapsKey() {
    localStorage.setItem('google_maps_api_key', getGoogleMapsKey());
}
function loadGoogleMapsKey() {
    const saved = localStorage.getItem('google_maps_api_key');
    if (saved) {
        const input = document.getElementById('google-maps-api-key');
        if (input) input.value = saved;
    }
}

/**
 * 搜索附近场所 — 双模式自动选择
 * 优先级: 1. Google Apps Script URL (免费) → 2. 直接 Google Places API (需 Key)
 */
async function searchNearbyPlaces(lat, lng, radiusMeters, placeTypes) {
    const scriptUrl = getGoogleScriptUrl();
    
    // 模式 1: 通过 Google Apps Script 代理 (推荐·免费·Key 隐藏)
    if (scriptUrl) {
        console.log('[Places] 使用 Google Apps Script 代理搜索');
        return await _searchViaAppsScript(scriptUrl, lat, lng, radiusMeters, placeTypes);
    }
    
    // 模式 2: 直接调用 Google Places API (需要浏览器端 API Key)
    const apiKey = getGoogleMapsKey();
    if (apiKey) {
        console.log('[Places] 使用 Google Places API 直接搜索');
        return await _searchViaGoogleDirect(apiKey, lat, lng, radiusMeters, placeTypes);
    }
    
    alert('请先配置以下任一项：\n1. Google Apps Script URL（推荐·免费）\n2. Google Maps API Key\n\n在【人员管理】面板中配置。');
    return [];
}

/**
 * 模式 1: 通过 Apps Script 代理搜索
 */
async function _searchViaAppsScript(scriptUrl, lat, lng, radiusMeters, placeTypes) {
    const typesStr = Array.isArray(placeTypes) ? placeTypes.join(',') : placeTypes;
    const url = `${scriptUrl}?action=places&lat=${lat}&lng=${lng}&radius=${radiusMeters}&types=${typesStr}`;
    
    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            console.warn('Apps Script error:', resp.status);
            return [];
        }
        const data = await resp.json();
        if (data.success && data.places) {
            return data.places.map(p => ({
                ...p,
                typeLabel: p.typeLabel || _getPlaceTypeLabel(p.types || [])
            }));
        } else {
            console.warn('Apps Script returned:', data.error);
            return [];
        }
    } catch (e) {
        console.warn('Apps Script fetch error:', e);
        return [];
    }
}

/**
 * 模式 2: 直接调用 Google Places API (New)
 */
async function _searchViaGoogleDirect(apiKey, lat, lng, radiusMeters, placeTypes) {
    const url = 'https://places.googleapis.com/v1/places:searchNearby';

    const body = {
        includedTypes: placeTypes,
        maxResultCount: 20,
        locationRestriction: {
            circle: {
                center: { latitude: lat, longitude: lng },
                radius: radiusMeters
            }
        }
    };

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri'
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.warn('Google Places API error:', resp.status, errText);
            return [];
        }

        const data = await resp.json();
        if (data && data.places) {
            return data.places.map(place => {
                const distMeters = _haversineDistance(
                    lat, lng,
                    place.location.latitude, place.location.longitude
                );
                return {
                    name: place.displayName?.text || '未知场所',
                    address: place.formattedAddress || '',
                    lat: place.location.latitude,
                    lng: place.location.longitude,
                    distance: distMeters,
                    types: place.types || [],
                    googleMapsUri: place.googleMapsUri || '',
                    typeLabel: _getPlaceTypeLabel(place.types || [])
                };
            }).sort((a, b) => a.distance - b.distance);
        }
    } catch (e) {
        console.warn('Google Places search error:', e);
    }
    return [];
}

/**
 * Haversine 公式计算两点间直线距离 (米)
 */
function _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 将 Google Places 类型转为中文友好标签
 */
function _getPlaceTypeLabel(types) {
    for (const t of types) {
        if (t === 'library') return '📚 图书馆';
        if (t === 'community_center') return '🏛️ 社区中心';
        if (t === 'church') return '⛪ 教会';
        if (t === 'cafe') return '☕ 咖啡厅';
        if (t === 'park') return '🌳 公园';
        if (t === 'restaurant') return '🍽️ 餐厅';
        if (t === 'school') return '🏫 学校';
        if (t === 'city_hall' || t === 'local_government_office') return '🏢 政府办公';
        if (t === 'museum') return '🏛️ 博物馆';
    }
    return '📍 场所';
}
