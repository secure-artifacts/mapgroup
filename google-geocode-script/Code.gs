// ========================================================
// 智能地图 - Google 地理编码 API 服务
// 部署步骤:
// 1. 打开 https://script.google.com
// 2. 新建项目，将此代码粘贴到 Code.gs
// 3. 点击「部署」→「新建部署」
// 4. 类型选「网页应用」
// 5. 执行身份: 「以我的身份」
// 6. 访问权限: 「任何人」
// 7. 点击部署，复制生成的 URL
// 8. 将 URL 粘贴到地图应用的「Google API 地址」配置框
// ========================================================

function doGet(e) {
  var address = e.parameter.address || '';
  var region = e.parameter.region || '';
  
  if (!address) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'No address provided' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var geocoder = Maps.newGeocoder();
    
    if (region) {
      geocoder.setRegion(region);
    }
    
    var result = geocoder.geocode(address);
    
    if (result.status === 'OK' && result.results.length > 0) {
      var location = result.results[0].geometry.location;
      var formatted = result.results[0].formatted_address;
      
      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          lat: location.lat,
          lng: location.lng,
          displayName: formatted
        })
      ).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'No results for: ' + address })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 测试函数 (可在 Apps Script 编辑器中运行测试)
function testGeocode() {
  var result = doGet({ parameter: { address: 'Cincinnati, Ohio, USA', region: 'us' } });
  Logger.log(result.getContent());
}
