// ======================== 地址缓存系统 ========================

const GEOCODE_CACHE_KEY = 'geocode_cache';

function _getGeocodeCache() {
    try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'); } 
    catch(e) { return {}; }
}
function _saveGeocodeCache(cache) {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
}
function _getCachedResult(address) {
    const cache = _getGeocodeCache();
    return cache[address.trim().toLowerCase()] || null;
}
function _setCachedResult(address, result) {
    const cache = _getGeocodeCache();
    cache[address.trim().toLowerCase()] = { lat: result.lat, lng: result.lng, displayName: result.displayName };
    _saveGeocodeCache(cache);
}
function getGeocodeCacheForExport() { return _getGeocodeCache(); }
function mergeGeocodeCache(importedCache) {
    if (!importedCache || typeof importedCache !== 'object') return;
    const cache = _getGeocodeCache();
    Object.assign(cache, importedCache);
    _saveGeocodeCache(cache);
}
function clearGeocodeCache() {
    localStorage.removeItem(GEOCODE_CACHE_KEY);
    updateCacheCountLabel();
    showToast('地址缓存已清空', 'success');
}
function updateCacheCountLabel() {
    const label = document.getElementById('cache-count-label');
    if (label) {
        const count = Object.keys(_getGeocodeCache()).length;
        label.textContent = `当前缓存 ${count} 条地址`;
    }
}

/**
 * Free Geocoding Service — Multi-provider with fallback + 本地缓存
 * Provider 0: 本地缓存 (零 API 调用)
 * Provider 1: Google Apps Script (完全免费)
 * Provider 2: Geoapify (3000/day)
 * Provider 3: Photon (无限制)
 * Provider 4: Nominatim (1/sec)
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

    // Check cache first (zero API calls)
    const cached = _getCachedResult(address);
    if (cached) {
        console.log('[Geocode] ✅ 缓存命中:', address);
        return cached;
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

    let result = null;

    // Provider 1: Google Apps Script (最高优先级 — Google 数据 + 完全免费)
    const scriptUrl = getGoogleScriptUrl();
    if (!result && scriptUrl) {
        result = await _googleScriptGeocode(scriptUrl, query, countryCode);
    }

    // Provider 2: Geoapify (if API key configured)
    const apiKey = getGeoapifyKey();
    if (!result && apiKey) {
        result = await _geoapifySearch(query, countryCode, apiKey);
    }

    // Provider 3: Photon (fast, no strict rate limit)
    if (!result) {
        result = await _photonSearch(query, countryCode);
    }
    
    // Provider 4: Nominatim (backup)
    if (!result) {
        result = await _nominatimSearch(query, countryCode);
    }

    // Cache the result for future use
    if (result) {
        _setCachedResult(address, result);
        updateCacheCountLabel();
    }

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
    
    showToast('请先配置 Google Script URL 或 Google Maps API Key（在【⚙️ 配置】面板中设置）', 'warning', 5000);
    return [];
}

/**
 * 模式 1: 通过 Apps Script 代理搜索
 */
async function _searchViaAppsScript(scriptUrl, lat, lng, radiusMeters, placeTypes) {
    const typesStr = Array.isArray(placeTypes) ? placeTypes.join(',') : placeTypes;
    const apiKey = getGoogleMapsKey();
    let url = `${scriptUrl}?action=places&lat=${lat}&lng=${lng}&radius=${radiusMeters}&types=${encodeURIComponent(typesStr)}`;
    if (apiKey) {
        url += `&key=${encodeURIComponent(apiKey)}`;
    }
    
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

// ======================== Google Apps Script Code & Copy System ========================

const GOOGLE_APPS_SCRIPT_CODE = `// ========================================================
// 智能地图 - Google 全功能 API 服务 (一站式)
// 
// 功能:
//   1. 地址解析 (Geocoding) — 内置免费 Maps.newGeocoder()
//   2. 附近场所搜索 (Places) — Google Places API (New)
//   3. 驾车路线规划 (Directions) — 内置免费 Maps.newDirectionFinder()
//
// 部署步骤:
// 1. 打开 https://script.google.com
// 2. 新建项目，将此代码粘贴到 Code.gs
// 3. ⚠️ 将第 23 行的 API_KEY 替换为您的 Google Maps API Key
//    (仅「附近场所搜索」需要，其余功能无需 Key)
// 4. 点击「部署」→「新建部署」
// 5. 类型选「网页应用」
// 6. 执行身份: 「以我的身份」
// 7. 访问权限: 「任何人」
// 8. 点击部署，复制生成的 URL
// 9. 将 URL 粘贴到地图应用的配置框
// ========================================================

var API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

function doGet(e) {
  var action = e.parameter.action || 'geocode';
  
  try {
    if (action === 'geocode') return handleGeocode(e);
    if (action === 'places') return handlePlacesSearch(e);
    if (action === 'directions') return handleDirections(e);
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleGeocode(e) {
  var address = e.parameter.address || '';
  var region = e.parameter.region || '';
  
  if (!address) {
    return jsonResponse({ success: false, error: 'No address provided' });
  }
  
  var geocoder = Maps.newGeocoder();
  if (region) geocoder.setRegion(region);
  
  var result = geocoder.geocode(address);
  
  if (result.status === 'OK' && result.results.length > 0) {
    var location = result.results[0].geometry.location;
    var formatted = result.results[0].formatted_address;
    
    return jsonResponse({
      success: true,
      lat: location.lat,
      lng: location.lng,
      displayName: formatted
    });
  }
  
  return jsonResponse({ success: false, error: 'No results for: ' + address });
}

function handlePlacesSearch(e) {
  var lat = parseFloat(e.parameter.lat);
  var lng = parseFloat(e.parameter.lng);
  var radius = parseFloat(e.parameter.radius) || 10000;
  var types = e.parameter.types || 'library,community_center';
  var apiKey = e.parameter.key || API_KEY;
  
  if (isNaN(lat) || isNaN(lng)) {
    return jsonResponse({ success: false, error: 'Invalid lat/lng' });
  }
  
  var typesArray = types.split(',');
  var places = [];
  
  for (var i = 0; i < typesArray.length; i++) {
    var results = searchPlacesAPI(lat, lng, radius, typesArray[i].trim(), apiKey);
    places = places.concat(results);
  }
  
  var seen = {};
  var unique = [];
  for (var j = 0; j < places.length; j++) {
    var key = places[j].name + '|' + places[j].lat + '|' + places[j].lng;
    if (!seen[key]) {
      seen[key] = true;
      unique.push(places[j]);
    }
  }
  unique.sort(function(a, b) { return a.distance - b.distance; });
  
  return jsonResponse({ success: true, count: unique.length, places: unique });
}

function searchPlacesAPI(lat, lng, radius, placeType, apiKey) {
  var url = 'https://places.googleapis.com/v1/places:searchNearby';
  var keyToUse = apiKey || API_KEY;
  
  var payload = {
    includedTypes: [placeType],
    maxResultCount: 10,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius
      }
    }
  };
  
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': keyToUse,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  var data = JSON.parse(resp.getContentText());
  if (!data.places) return [];
  
  return data.places.map(function(p) {
    var d = haversine(lat, lng, p.location.latitude, p.location.longitude);
    return {
      name: p.displayName ? p.displayName.text : 'Unknown',
      address: p.formattedAddress || '',
      lat: p.location.latitude,
      lng: p.location.longitude,
      distance: Math.round(d),
      types: p.types || [],
      googleMapsUri: p.googleMapsUri || '',
      typeLabel: typeLabel(p.types || [])
    };
  });
}

function handleDirections(e) {
  var originLat = parseFloat(e.parameter.olat);
  var originLng = parseFloat(e.parameter.olng);
  var destLat = parseFloat(e.parameter.dlat);
  var destLng = parseFloat(e.parameter.dlng);
  
  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    return jsonResponse({ success: false, error: 'Invalid coordinates' });
  }
  
  var directions = Maps.newDirectionFinder()
    .setOrigin(originLat, originLng)
    .setDestination(destLat, destLng)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .getDirections();
  
  if (directions.status !== 'OK' || !directions.routes || directions.routes.length === 0) {
    return jsonResponse({ success: false, error: 'No route found' });
  }
  
  var route = directions.routes[0];
  var leg = route.legs[0];
  var coords = decodePolyline(route.overview_polyline.points);
  
  return jsonResponse({
    success: true,
    distance: leg.distance.value,
    distanceText: leg.distance.text,
    duration: leg.duration.value,
    durationText: leg.duration.text,
    coordinates: coords
  });
}

function decodePolyline(encoded) {
  var points = [];
  var index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    var b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function typeLabel(types) {
  for (var i = 0; i < types.length; i++) {
    if (types[i] === 'library') return '📚 图书馆';
    if (types[i] === 'community_center') return '🏛️ 社区中心';
    if (types[i] === 'church') return '⛪ 教会';
    if (types[i] === 'cafe') return '☕ 咖啡厅';
    if (types[i] === 'park') return '🌳 公园';
  }
  return '📍 场所';
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

function copyGoogleAppsScriptCode() {
    const text = GOOGLE_APPS_SCRIPT_CODE;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof showToast === 'function') showToast('📋 已复制 Google 脚本代码！在 script.google.com 粘贴到 Code.gs 即可');
            else alert('已成功复制 Google 脚本代码！');
        }).catch(() => {
            _fallbackCopy(text);
        });
    } else {
        _fallbackCopy(text);
    }
}

function _fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast('📋 已复制 Google 脚本代码！在 script.google.com 粘贴到 Code.gs 即可');
        else alert('已成功复制 Google 脚本代码！');
    } catch (e) {
        alert('复制失败，请手动打开查看代码框全选复制。');
    }
    document.body.removeChild(textarea);
}

function showGoogleScriptModal() {
    const modal = document.getElementById('google-script-modal');
    const textarea = document.getElementById('google-script-code-text');
    if (modal && textarea) {
        textarea.value = GOOGLE_APPS_SCRIPT_CODE;
        modal.style.display = 'flex';
    }
}

function closeGoogleScriptModal() {
    const modal = document.getElementById('google-script-modal');
    if (modal) modal.style.display = 'none';
}

function toggleKeyVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isPassword ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        }
    }
}

window.copyGoogleAppsScriptCode = copyGoogleAppsScriptCode;
window.showGoogleScriptModal = showGoogleScriptModal;
window.closeGoogleScriptModal = closeGoogleScriptModal;
window.toggleKeyVisibility = toggleKeyVisibility;
