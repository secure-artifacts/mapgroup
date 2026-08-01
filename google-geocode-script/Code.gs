// ========================================================
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

// ⚠️ 仅场所搜索需要，请替换为您自己的 Google Maps API Key
var API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

// ======================== 路由入口 ========================

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

// ======================== 1. 地址解析 (完全免费) ========================

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

// ======================== 2. 附近场所搜索 (需 API Key) ========================

function handlePlacesSearch(e) {
  var lat = parseFloat(e.parameter.lat);
  var lng = parseFloat(e.parameter.lng);
  var radius = parseFloat(e.parameter.radius) || 10000;
  var types = e.parameter.types || 'library,community_center';
  
  if (isNaN(lat) || isNaN(lng)) {
    return jsonResponse({ success: false, error: 'Invalid lat/lng' });
  }
  
  var typesArray = types.split(',');
  var places = [];
  
  for (var i = 0; i < typesArray.length; i++) {
    var results = searchPlacesAPI(lat, lng, radius, typesArray[i].trim());
    places = places.concat(results);
  }
  
  // 去重 + 排序
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

function searchPlacesAPI(lat, lng, radius, placeType) {
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
  
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': API_KEY,
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

// ======================== 3. 驾车路线 (完全免费) ========================

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
  
  // 解码 polyline 为坐标数组
  var coords = decodePolyline(route.overview_polyline.points);
  
  return jsonResponse({
    success: true,
    distance: leg.distance.value,       // 米
    distanceText: leg.distance.text,     // 如 "15.2 km"
    duration: leg.duration.value,        // 秒
    durationText: leg.duration.text,     // 如 "18 mins"
    coordinates: coords                  // [[lat, lng], ...]
  });
}

/**
 * 解码 Google Encoded Polyline 为坐标数组
 */
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

// ======================== 工具函数 ========================

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

// ======================== 测试函数 ========================

function testGeocode() {
  var r = doGet({ parameter: { action: 'geocode', address: 'Cincinnati, Ohio', region: 'us' } });
  Logger.log(r.getContent());
}

function testPlaces() {
  var r = doGet({ parameter: { action: 'places', lat: '39.1031', lng: '-84.5120', radius: '10000', types: 'library' } });
  Logger.log(r.getContent());
}

function testDirections() {
  var r = doGet({ parameter: { action: 'directions', olat: '39.1031', olng: '-84.5120', dlat: '39.1280', dlng: '-84.5160' } });
  Logger.log(r.getContent());
}
