/**
 * Country Data for Searchable Selector
 * Format: { code: ISO 3166-1 alpha-2, en: English name, zh: Chinese name }
 */
const COUNTRY_LIST = [
    { code: 'US', en: 'United States', zh: '美国' },
    { code: 'CN', en: 'China', zh: '中国' },
    { code: 'JP', en: 'Japan', zh: '日本' },
    { code: 'KR', en: 'South Korea', zh: '韩国' },
    { code: 'GB', en: 'United Kingdom', zh: '英国' },
    { code: 'DE', en: 'Germany', zh: '德国' },
    { code: 'FR', en: 'France', zh: '法国' },
    { code: 'IT', en: 'Italy', zh: '意大利' },
    { code: 'ES', en: 'Spain', zh: '西班牙' },
    { code: 'PT', en: 'Portugal', zh: '葡萄牙' },
    { code: 'NL', en: 'Netherlands', zh: '荷兰' },
    { code: 'BE', en: 'Belgium', zh: '比利时' },
    { code: 'CH', en: 'Switzerland', zh: '瑞士' },
    { code: 'AT', en: 'Austria', zh: '奥地利' },
    { code: 'SE', en: 'Sweden', zh: '瑞典' },
    { code: 'NO', en: 'Norway', zh: '挪威' },
    { code: 'DK', en: 'Denmark', zh: '丹麦' },
    { code: 'FI', en: 'Finland', zh: '芬兰' },
    { code: 'IE', en: 'Ireland', zh: '爱尔兰' },
    { code: 'PL', en: 'Poland', zh: '波兰' },
    { code: 'CZ', en: 'Czech Republic', zh: '捷克' },
    { code: 'HU', en: 'Hungary', zh: '匈牙利' },
    { code: 'RO', en: 'Romania', zh: '罗马尼亚' },
    { code: 'GR', en: 'Greece', zh: '希腊' },
    { code: 'TR', en: 'Turkey', zh: '土耳其' },
    { code: 'RU', en: 'Russia', zh: '俄罗斯' },
    { code: 'UA', en: 'Ukraine', zh: '乌克兰' },
    { code: 'CA', en: 'Canada', zh: '加拿大' },
    { code: 'MX', en: 'Mexico', zh: '墨西哥' },
    { code: 'BR', en: 'Brazil', zh: '巴西' },
    { code: 'AR', en: 'Argentina', zh: '阿根廷' },
    { code: 'CL', en: 'Chile', zh: '智利' },
    { code: 'CO', en: 'Colombia', zh: '哥伦比亚' },
    { code: 'PE', en: 'Peru', zh: '秘鲁' },
    { code: 'VE', en: 'Venezuela', zh: '委内瑞拉' },
    { code: 'AU', en: 'Australia', zh: '澳大利亚' },
    { code: 'NZ', en: 'New Zealand', zh: '新西兰' },
    { code: 'IN', en: 'India', zh: '印度' },
    { code: 'PK', en: 'Pakistan', zh: '巴基斯坦' },
    { code: 'BD', en: 'Bangladesh', zh: '孟加拉国' },
    { code: 'TH', en: 'Thailand', zh: '泰国' },
    { code: 'VN', en: 'Vietnam', zh: '越南' },
    { code: 'PH', en: 'Philippines', zh: '菲律宾' },
    { code: 'MY', en: 'Malaysia', zh: '马来西亚' },
    { code: 'SG', en: 'Singapore', zh: '新加坡' },
    { code: 'ID', en: 'Indonesia', zh: '印度尼西亚' },
    { code: 'MM', en: 'Myanmar', zh: '缅甸' },
    { code: 'KH', en: 'Cambodia', zh: '柬埔寨' },
    { code: 'LA', en: 'Laos', zh: '老挝' },
    { code: 'TW', en: 'Taiwan', zh: '台湾' },
    { code: 'HK', en: 'Hong Kong', zh: '香港' },
    { code: 'MO', en: 'Macau', zh: '澳门' },
    { code: 'SA', en: 'Saudi Arabia', zh: '沙特阿拉伯' },
    { code: 'AE', en: 'United Arab Emirates', zh: '阿联酋' },
    { code: 'IL', en: 'Israel', zh: '以色列' },
    { code: 'EG', en: 'Egypt', zh: '埃及' },
    { code: 'ZA', en: 'South Africa', zh: '南非' },
    { code: 'NG', en: 'Nigeria', zh: '尼日利亚' },
    { code: 'KE', en: 'Kenya', zh: '肯尼亚' },
    { code: 'ET', en: 'Ethiopia', zh: '埃塞俄比亚' },
    { code: 'GH', en: 'Ghana', zh: '加纳' },
    { code: 'TZ', en: 'Tanzania', zh: '坦桑尼亚' },
    { code: 'MA', en: 'Morocco', zh: '摩洛哥' },
    { code: 'DZ', en: 'Algeria', zh: '阿尔及利亚' },
    { code: 'TN', en: 'Tunisia', zh: '突尼斯' },
    { code: 'QA', en: 'Qatar', zh: '卡塔尔' },
    { code: 'KW', en: 'Kuwait', zh: '科威特' },
    { code: 'IQ', en: 'Iraq', zh: '伊拉克' },
    { code: 'IR', en: 'Iran', zh: '伊朗' },
    { code: 'AF', en: 'Afghanistan', zh: '阿富汗' },
    { code: 'LK', en: 'Sri Lanka', zh: '斯里兰卡' },
    { code: 'NP', en: 'Nepal', zh: '尼泊尔' },
    { code: 'MN', en: 'Mongolia', zh: '蒙古' },
    { code: 'KZ', en: 'Kazakhstan', zh: '哈萨克斯坦' },
    { code: 'UZ', en: 'Uzbekistan', zh: '乌兹别克斯坦' },
    { code: 'CU', en: 'Cuba', zh: '古巴' },
    { code: 'PA', en: 'Panama', zh: '巴拿马' },
    { code: 'CR', en: 'Costa Rica', zh: '哥斯达黎加' },
    { code: 'EC', en: 'Ecuador', zh: '厄瓜多尔' },
    { code: 'UY', en: 'Uruguay', zh: '乌拉圭' },
    { code: 'PY', en: 'Paraguay', zh: '巴拉圭' },
    { code: 'BO', en: 'Bolivia', zh: '玻利维亚' },
    { code: 'DO', en: 'Dominican Republic', zh: '多米尼加' },
    { code: 'GT', en: 'Guatemala', zh: '危地马拉' },
    { code: 'HN', en: 'Honduras', zh: '洪都拉斯' },
    { code: 'SV', en: 'El Salvador', zh: '萨尔瓦多' },
    { code: 'NI', en: 'Nicaragua', zh: '尼加拉瓜' },
    { code: 'JM', en: 'Jamaica', zh: '牙买加' },
    { code: 'TT', en: 'Trinidad and Tobago', zh: '特立尼达和多巴哥' },
    { code: 'IS', en: 'Iceland', zh: '冰岛' },
    { code: 'LU', en: 'Luxembourg', zh: '卢森堡' },
    { code: 'SK', en: 'Slovakia', zh: '斯洛伐克' },
    { code: 'SI', en: 'Slovenia', zh: '斯洛文尼亚' },
    { code: 'HR', en: 'Croatia', zh: '克罗地亚' },
    { code: 'RS', en: 'Serbia', zh: '塞尔维亚' },
    { code: 'BG', en: 'Bulgaria', zh: '保加利亚' },
    { code: 'LT', en: 'Lithuania', zh: '立陶宛' },
    { code: 'LV', en: 'Latvia', zh: '拉脱维亚' },
    { code: 'EE', en: 'Estonia', zh: '爱沙尼亚' },
    { code: 'CY', en: 'Cyprus', zh: '塞浦路斯' },
    { code: 'MT', en: 'Malta', zh: '马耳他' },
    { code: 'GE', en: 'Georgia', zh: '格鲁吉亚' },
    { code: 'AM', en: 'Armenia', zh: '亚美尼亚' },
    { code: 'AZ', en: 'Azerbaijan', zh: '阿塞拜疆' },
    { code: 'JO', en: 'Jordan', zh: '约旦' },
    { code: 'LB', en: 'Lebanon', zh: '黎巴嫩' },
    { code: 'OM', en: 'Oman', zh: '阿曼' },
    { code: 'BH', en: 'Bahrain', zh: '巴林' },
    { code: 'LY', en: 'Libya', zh: '利比亚' },
    { code: 'SD', en: 'Sudan', zh: '苏丹' },
    { code: 'SN', en: 'Senegal', zh: '塞内加尔' },
    { code: 'CI', en: 'Ivory Coast', zh: '科特迪瓦' },
    { code: 'CM', en: 'Cameroon', zh: '喀麦隆' },
    { code: 'UG', en: 'Uganda', zh: '乌干达' },
    { code: 'RW', en: 'Rwanda', zh: '卢旺达' },
    { code: 'MZ', en: 'Mozambique', zh: '莫桑比克' },
    { code: 'AO', en: 'Angola', zh: '安哥拉' },
    { code: 'ZW', en: 'Zimbabwe', zh: '津巴布韦' },
    { code: 'BW', en: 'Botswana', zh: '博茨瓦纳' },
    { code: 'NA', en: 'Namibia', zh: '纳米比亚' },
    { code: 'MG', en: 'Madagascar', zh: '马达加斯加' },
    { code: 'FJ', en: 'Fiji', zh: '斐济' },
    { code: 'PG', en: 'Papua New Guinea', zh: '巴布亚新几内亚' },
    { code: 'KP', en: 'North Korea', zh: '朝鲜' },
    { code: 'PR', en: 'Puerto Rico', zh: '波多黎各' },
    { code: 'BN', en: 'Brunei', zh: '文莱' },
    { code: 'BA', en: 'Bosnia and Herzegovina', zh: '波黑' },
    { code: 'AL', en: 'Albania', zh: '阿尔巴尼亚' },
    { code: 'MK', en: 'North Macedonia', zh: '北马其顿' },
    { code: 'ME', en: 'Montenegro', zh: '黑山' },
    { code: 'XK', en: 'Kosovo', zh: '科索沃' },
    { code: 'MD', en: 'Moldova', zh: '摩尔多瓦' },
    { code: 'BY', en: 'Belarus', zh: '白俄罗斯' },
];

/**
 * Get the selected country code from the country selector
 * Returns the ISO code (lowercase) or empty string if "all countries"
 */
function getSelectedCountryCode() {
    const input = document.getElementById('country-selector');
    if (!input) return '';
    const val = input.value.trim();
    if (!val) return '';
    
    const match = COUNTRY_LIST.find(c => 
        c.en.toLowerCase() === val.toLowerCase() || 
        c.zh === val ||
        `${c.zh} ${c.en}` === val ||
        `${c.en} (${c.zh})` === val
    );
    return match ? match.code.toLowerCase() : '';
}

/**
 * Get the English country name for appending to addresses
 */
function getSelectedCountryName() {
    const input = document.getElementById('country-selector');
    if (!input) return '';
    const val = input.value.trim();
    if (!val) return '';
    
    const match = COUNTRY_LIST.find(c => 
        c.en.toLowerCase() === val.toLowerCase() || 
        c.zh === val ||
        `${c.zh} ${c.en}` === val ||
        `${c.en} (${c.zh})` === val
    );
    return match ? match.en : '';
}

/**
 * Initialize the country selector with searchable datalist
 */
function initCountrySelector() {
    const datalist = document.getElementById('country-datalist');
    if (!datalist) return;
    
    datalist.innerHTML = '';
    COUNTRY_LIST.forEach(c => {
        const option = document.createElement('option');
        option.value = `${c.en} (${c.zh})`;
        option.setAttribute('data-code', c.code);
        datalist.appendChild(option);
    });

    // Restore saved country
    const saved = localStorage.getItem('selected_country');
    const input = document.getElementById('country-selector');
    if (saved && input) input.value = saved;

    // Save on change
    if (input) {
        input.addEventListener('change', () => localStorage.setItem('selected_country', input.value));
        input.addEventListener('input', () => localStorage.setItem('selected_country', input.value));
    }
}
