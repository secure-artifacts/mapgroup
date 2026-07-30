/**
 * Application Configuration & Constants
 */
const APP_CONFIG = {
    DEFAULT_CENTER: [31.2304, 121.4737], // Default view (e.g. Shanghai)
    DEFAULT_ZOOM: 11,
    COLORS: ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6'],
    TILE_PROVIDERS: {
        google_road: {
            url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            attribution: '© Google Maps'
        },
        google_hybrid: {
            url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            attribution: '© Google Maps'
        },
        carto_dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '© CartoDB'
        },
        osm_standard: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap'
        }
    },
    SAMPLE_PEOPLE: [
        { name: "张明 (陆家嘴分部)", lat: 31.2397, lng: 121.4998, address: "上海市浦东新区陆家嘴环路" },
        { name: "李华 (世纪大道)", lat: 31.2291, lng: 121.5283, address: "上海市浦东新区世纪大道100号" },
        { name: "王伟 (静安寺)", lat: 31.2248, lng: 121.4485, address: "上海市静安区南京西路1688号" },
        { name: "赵芳 (徐家汇)", lat: 31.1942, lng: 121.4372, address: "上海市徐汇区虹桥路1号" },
        { name: "陈杰 (人民广场)", lat: 31.2337, lng: 121.4726, address: "上海市黄浦区人民大道200号" },
        { name: "杨光 (中山公园)", lat: 31.2185, lng: 121.4173, address: "上海市长宁区长宁路1018号" },
        { name: "周强 (张江高科)", lat: 31.2005, lng: 121.5878, address: "上海市浦东新区科苑路88号" },
        { name: "吴敏 (金桥开发区)", lat: 31.2589, lng: 121.6012, address: "上海市浦东新区金桥路1388号" },
        { name: "郑磊 (虹桥火车站)", lat: 31.1953, lng: 121.3197, address: "上海市闵行区申贵路900号" },
        { name: "孙丽 (五角场)", lat: 31.2982, lng: 121.5147, address: "上海市杨浦区淞沪路8号" },
        { name: "马超 (偏远孤立人员)", lat: 31.4052, lng: 121.4893, address: "上海市宝山区牡丹江路1800号" }
    ]
};
