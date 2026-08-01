// ========================================================
// 智能地图 - Google Places 附近场所搜索 API 服务
// 
// 功能: 搜索指定位置附近的图书馆、社区中心等公共场所
// 
// 部署步骤:
// 1. 打开 https://script.google.com
// 2. 新建项目，将此代码粘贴到 Code.gs
// 3. 点击「部署」→「新建部署」
// 4. 类型选「网页应用」
// 5. 执行身份: 「以我的身份」
// 6. 访问权限: 「任何人」
// 7. 点击部署，复制生成的 URL
// 8. 将 URL 粘贴到地图应用的「Google Script URL」配置框
//
// 注意: 将下面的 API_KEY 替换为您自己的 Google Maps API Key
// 此 Key 只存在于您的 Apps Script 中，不会暴露在公开代码里
// ========================================================

// ⚠️ 请替换为您的 Google Maps API Key
var API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

// ======================== 入口 ========================

function doGet(e) {
  var action = e.parameter.action || 'geocode';
  
  if (action === 'geocode') {
    return handleGeocode(e);
  } else if (action === 'places') {
    return handlePlacesSearch(e);
  } else {
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  }
}

// ======================== 地理编码 (原有功能) ========================

function handleGeocode(e) {
  var address = e.parameter.address || '';
  var region = e.parameter.region || '';
  
  if (!address) {
    return jsonResponse({ success: false, error: 'No address provided' });
  }
  
  try {
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
    } else {
      return jsonResponse({ success: false, error: 'No results for: ' + address });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ======================== 附近场所搜索 (Places API New) ========================

function handlePlacesSearch(e) {
  var lat = parseFloat(e.parameter.lat);
  var lng = parseFloat(e.parameter.lng);
  var radius = parseFloat(e.parameter.radius) || 10000; // 默认 10km
  var types = e.parameter.types || 'library,community_center';
  
  if (isNaN(lat) || isNaN(lng)) {
    return jsonResponse({ success: false, error: 'Invalid lat/lng' });
  }
  
  try {
    var typesArray = types.split(',').map(function(t) { return t.trim(); });
    var places = [];
    
    // 对每种类型分别搜索（Google Places API 每次只支持一种 includedType）
    for (var i = 0; i < typesArray.length; i++) {
      var results = searchNearbyPlaces(lat, lng, radius, typesArray[i]);
      places = places.concat(results);
    }
    
    // 按距离排序
    places.sort(function(a, b) { return a.distance - b.distance; });
    
    // 去重（按名称+地址）
    var seen = {};
    var uniquePlaces = [];
    for (var j = 0; j < places.length; j++) {
      var key = places[j].name + '|' + places[j].address;
      if (!seen[key]) {
        seen[key] = true;
        uniquePlaces.push(places[j]);
      }
    }
    
    return jsonResponse({
      success: true,
      count: uniquePlaces.length,
      places: uniquePlaces
    });
    
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * 调用 Google Places API (New) Nearby Search
 */
function searchNearbyPlaces(lat, lng, radius, placeType) {
  var url = 'https://places.googleapis.com/v1/places:searchNearby';
  
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
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var data = JSON.parse(response.getContentText());
  
  if (!data.places) return [];
  
  return data.places.map(function(place) {
    var dist = haversineDistance(lat, lng, place.location.latitude, place.location.longitude);
    return {
      name: place.displayName ? place.displayName.text : 'Unknown',
      address: place.formattedAddress || '',
      lat: place.location.latitude,
      lng: place.location.longitude,
      distance: Math.round(dist),
      types: place.types || [],
      googleMapsUri: place.googleMapsUri || '',
      typeLabel: getTypeLabel(place.types || [])
    };
  });
}

// ======================== 工具函数 ========================

/**
 * Haversine 公式计算两点间距离 (米)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 类型标签映射
 */
function getTypeLabel(types) {
  for (var i = 0; i < types.length; i++) {
    if (types[i] === 'library') return '📚 图书馆';
    if (types[i] === 'community_center') return '🏛️ 社区中心';
    if (types[i] === 'church') return '⛪ 教会';
    if (types[i] === 'cafe') return '☕ 咖啡厅';
    if (types[i] === 'park') return '🌳 公园';
  }
  return '📍 场所';
}

/**
 * 统一 JSON 响应
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======================== 测试函数 ========================

/**
 * 测试地理编码 (在编辑器中运行)
 */
function testGeocode() {
  var result = doGet({ parameter: { action: 'geocode', address: 'Cincinnati, Ohio, USA', region: 'us' } });
  Logger.log(result.getContent());
}

/**
 * 测试附近场所搜索 (在编辑器中运行)
 * 示例: 搜索 Cincinnati 附近的图书馆和社区中心
 */
function testPlacesSearch() {
  var result = doGet({ 
    parameter: { 
      action: 'places', 
      lat: '39.1031', 
      lng: '-84.5120',
      radius: '10000',
      types: 'library,community_center'
    } 
  });
  Logger.log(result.getContent());
}
