/**
 * Free Geocoding Service (Nominatim OpenStreetMap & Lat/Lng Parser)
 */
async function freeGeocode(address) {
    if (!address || !address.trim()) return null;
    
    // Check if input is already formatted as "Lat, Lng"
    const coordMatch = address.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
        return {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2]),
            displayName: address
        };
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const resp = await fetch(url, {
            headers: {
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            }
        });
        const data = await resp.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }
    } catch (e) {
        console.error("Geocoding service error:", e);
    }
    return null;
}
