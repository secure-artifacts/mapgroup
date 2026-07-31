/**
 * Free Geocoding Service — Multi-provider with fallback
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

// ======================== Geoapify Places API ========================

/**
 * 搜索指定经纬度附近的公共聚会场所
 * @param {number} lat - 中心纬度
 * @param {number} lng - 中心经度
 * @param {number} radiusMeters - 搜索半径 (米)
 * @param {string[]} categories - Geoapify 场所分类
 * @returns {Promise<Array>} - 场所列表
 */
async function searchNearbyPlaces(lat, lng, radiusMeters, categories) {
    const apiKey = getGeoapifyKey();
    if (!apiKey) {
        alert('请先在【目标规划】面板中配置 Geoapify API Key！');
        return [];
    }

    const categoriesStr = categories.join(',');
    const url = `https://api.geoapify.com/v2/places?categories=${categoriesStr}&filter=circle:${lng},${lat},${radiusMeters}&bias=proximity:${lng},${lat}&limit=20&apiKey=${apiKey}`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            console.warn('Geoapify Places API error:', resp.status);
            return [];
        }
        const data = await resp.json();
        if (data && data.features) {
            return data.features.map(f => {
                const p = f.properties;
                return {
                    name: p.name || p.address_line1 || '未知场所',
                    address: p.formatted || p.address_line2 || '',
                    lat: p.lat,
                    lng: p.lon,
                    distance: p.distance, // 距中心距离 (米)
                    categories: p.categories || [],
                    placeId: p.place_id,
                    // 场所类型友好名称
                    typeLabel: _getPlaceTypeLabel(p.categories || [])
                };
            });
        }
    } catch (e) {
        console.warn('Geoapify Places search error:', e);
    }
    return [];
}

/**
 * 将 Geoapify 分类转为中文友好标签
 */
function _getPlaceTypeLabel(categories) {
    for (const cat of categories) {
        if (cat.includes('library')) return '📚 图书馆';
        if (cat.includes('community_centre') || cat.includes('community_center')) return '🏛️ 社区中心';
        if (cat.includes('church') || cat.includes('christian') || cat.includes('religion')) return '⛪ 教会';
        if (cat.includes('coffee') || cat.includes('cafe')) return '☕ 咖啡厅';
        if (cat.includes('park')) return '🌳 公园';
        if (cat.includes('restaurant')) return '🍽️ 餐厅';
    }
    return '📍 场所';
}
