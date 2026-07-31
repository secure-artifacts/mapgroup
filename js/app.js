/**
 * Main Application Bootstrap & Event Handlers
 */
let mapManager = null;
let peopleData = [];
let targetPoints = [];
let activeTargetId = null;
let tempLatLng = null;
let tempAddressName = "";
let currentTempRadius = 50.0; // Current exclusive radius for temporary search/probe location (Default 50km)

// Group metadata: { groupName: { color, visible } }
let groupMeta = {};
let activeGroupFilter = null; // null = show all, string = filter by group name

// Global Modifier Keys State for Alt-drag and Alt-wheel interaction
window.isAltKeyPressed = false;
window.isShiftKeyPressed = false;
window.isTargetDragLocked = false; // 默认开放灵活微调，可随时一键加锁

function toggleTargetDragLock(forceState) {
    if (forceState !== undefined) {
        window.isTargetDragLocked = forceState;
    } else {
        window.isTargetDragLocked = !window.isTargetDragLocked;
    }
    const btn = document.getElementById('drag-lock-btn');
    if (btn) {
        if (window.isTargetDragLocked) {
            btn.innerHTML = '<i class="fa-solid fa-lock"></i> 位置已锁定';
            btn.style.color = 'var(--accent-amber)';
            btn.style.borderColor = 'rgba(245,158,11,0.4)';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-lock-open"></i> 拖拽微调中';
            btn.style.color = 'var(--accent-emerald)';
            btn.style.borderColor = 'rgba(16,185,129,0.5)';
        }
    }
}
window.toggleTargetDragLock = toggleTargetDragLock;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' || e.altKey) window.isAltKeyPressed = true;
    if (e.key === 'Shift' || e.shiftKey) window.isShiftKeyPressed = true;
}, true);

window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' || !e.altKey) window.isAltKeyPressed = false;
    if (e.key === 'Shift' || !e.shiftKey) window.isShiftKeyPressed = false;
}, true);

window.onload = function() {
    mapManager = new MapManager('map-container');
    mapManager.init(APP_CONFIG.DEFAULT_CENTER, APP_CONFIG.DEFAULT_ZOOM, handleMapClick, handleMapMouseMove, onAltWheelResizeHandler);

    // Initialize searchable country selector
    if (typeof initCountrySelector === 'function') initCountrySelector();
    
    // Load saved Geoapify API Key
    if (typeof loadGeoapifyKey === 'function') loadGeoapifyKey();

    loadSavedData();
    updateGlobalStats();
};

function handleMapClick(e) {
    if (mapManager.isProbeMode) {
        setTempTarget(e.latlng, "探针锁定坐标点");
        toggleProbeMode(); 
    }
}

function handleMapMouseMove(e) {
    if (!mapManager.isProbeMode) return;
    const radiusKm = parseFloat(document.getElementById('search-radius-slider').value) || 5;
    const radiusM = radiusKm * 1000;

    if (mapManager.probeCircle) {
        mapManager.probeCircle.setLatLng(e.latlng);
        mapManager.probeCircle.setRadius(radiusM);
    } else {
        mapManager.probeCircle = L.circle(e.latlng, {
            radius: radiusM,
            color: '#f59e0b',
            weight: 2,
            dashArray: '5, 5',
            fill: true,
            fillOpacity: 0.08
        }).addTo(mapManager.map);
    }

    mapManager.probeLines.forEach(l => mapManager.map.removeLayer(l));
    mapManager.probeLines = [];

    peopleData.forEach(p => {
        const dist = e.latlng.distanceTo(L.latLng(p.lat, p.lng)) / 1000;
        if (dist <= radiusKm) {
            const l = L.polyline([e.latlng, [p.lat, p.lng]], {
                color: '#f59e0b',
                weight: 1.5,
                dashArray: '3, 4',
                opacity: 0.8
            }).addTo(mapManager.map);
            mapManager.probeLines.push(l);
        }
    });
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', nextTheme);
    document.getElementById('theme-icon').className = nextTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

function togglePersonNameLabels() {
    const btn = document.getElementById('toggle-names-btn');
    const currentState = mapManager.showPersonLabels;
    mapManager.setShowPersonLabels(!currentState);

    if (!currentState) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-tag"></i> 姓名标签: 显示';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-tag"></i> 姓名标签: 隐藏';
    }

    renderAllMapVisuals();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    let activeIdx = 0;
    if(tabId === 'target-tab') activeIdx = 1;
    if(tabId === 'ai-tab') activeIdx = 2;
    if(tabId === 'analysis-tab') activeIdx = 3;
    document.querySelectorAll('.tab-btn')[activeIdx].classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if(mapManager.isProbeMode && tabId !== 'target-tab') {
        toggleProbeMode();
    }
}

/**
 * 字符串清洗函数：彻底消除首尾残留的反斜杠 \ 和畸形未配对双引号 "（解决来自 Google Sheets 类似于 "\"Michigan" 的坏数据）
 */
function sanitizeImportedString(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // 剔除首尾不配对的引号与转义符
    str = str.replace(/^["'\\]+|["'\\]+$/g, '').trim();
    // 内部换行替换为单个空格
    str = str.replace(/[\r\n]+/g, ' ').trim();
    return str;
}

function loadSavedData() {
    const savedPeople = localStorage.getItem('global_map_people');
    const savedTargets = localStorage.getItem('global_map_targets');
    const savedActiveId = localStorage.getItem('global_map_active_id');
    const savedGroupMeta = localStorage.getItem('global_map_group_meta');

    if (savedPeople) {
        peopleData = JSON.parse(savedPeople);
        // 自动修缮清洗历史数据中残留的坏字符
        peopleData.forEach(p => {
            p.name = sanitizeImportedString(p.name);
            p.address = sanitizeImportedString(p.address);
            p.group = sanitizeImportedString(p.group) || '未分组';
        });
        saveData(); // 重写清洗后的规范数据到 localStorage
    }
    if (savedTargets) {
        targetPoints = JSON.parse(savedTargets);
        targetPoints.forEach(t => { 
            t.name = sanitizeImportedString(t.name);
            if (t.address) t.address = sanitizeImportedString(t.address);
            if(t.visible === undefined) t.visible = true; 
        });
    }
    if (savedGroupMeta) {
        groupMeta = JSON.parse(savedGroupMeta);
    }

    // Rebuild groupMeta for any groups not yet tracked
    rebuildGroupMeta();
    renderAllMapVisuals();

    if (savedActiveId) {
        activeTargetId = parseInt(savedActiveId);
        selectTarget(activeTargetId);
    }
}

function renderAllMapVisuals() {
    renderGroupPanel();
    renderRosterList();
    renderTargetsList();
    // Filter people by group visibility
    const visiblePeople = getVisiblePeople();
    mapManager.renderPeopleMarkers(visiblePeople, targetPoints, groupMeta);
    mapManager.renderTargetMarkers(targetPoints, visiblePeople, selectTarget, onTargetMoveHandler, onTargetResizeHandler);
    mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
    mapManager.drawAllGroupSpokeLines(visiblePeople, targetPoints);
    mapManager.drawGroupTerritoryPolygons(visiblePeople, targetPoints);
}

function onTargetMoveHandler(id, lat, lng, isFinal = false) {
    const target = targetPoints.find(t => t.id === id);
    if (!target) return;
    target.lat = lat;
    target.lng = lng;
    target.address = `自定义位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    if (isFinal) {
        saveData();
        renderAllMapVisuals();
    } else {
        const visiblePeople = getVisiblePeople();
        mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
        mapManager.drawAllGroupSpokeLines(visiblePeople, targetPoints);
        mapManager.drawGroupTerritoryPolygons(visiblePeople, targetPoints);
    }
}

function onTargetResizeHandler(id, newRadius) {
    const target = targetPoints.find(t => t.id === id);
    if (!target) return;
    target.radius = newRadius;

    if (id === activeTargetId) {
        const slider = document.getElementById('search-radius-slider');
        if (slider) slider.value = newRadius;
        const numberInput = document.getElementById('search-radius-number');
        if (numberInput) numberInput.value = newRadius;
        const label = document.getElementById('radius-val-label');
        if (label) label.innerText = `${newRadius.toFixed(1)} km`;
    }

    saveData();
    renderAllMapVisuals();
}

function onAltWheelResizeHandler(deltaKm) {
    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) {
            const newR = Math.max(0.5, parseFloat((target.radius + deltaKm).toFixed(1)));
            onTargetResizeHandler(activeTargetId, newR);
        }
    } else if (tempLatLng) {
        const newR = Math.max(0.5, parseFloat((currentTempRadius + deltaKm).toFixed(1)));
        onTempRadiusInput(newR);
    }
}

function saveData() {
    localStorage.setItem('global_map_people', JSON.stringify(peopleData));
    localStorage.setItem('global_map_targets', JSON.stringify(targetPoints));
    localStorage.setItem('global_map_active_id', activeTargetId);
    localStorage.setItem('global_map_group_meta', JSON.stringify(groupMeta));
    updateGlobalStats();
}

function updateGlobalStats() {
    document.getElementById('stat-total-people').innerText = peopleData.length;
    document.getElementById('stat-total-groups').innerText = targetPoints.length;
    
    if (peopleData.length === 0 || targetPoints.length === 0) {
        document.getElementById('stat-cover-rate').innerText = '0%';
        document.getElementById('stat-avg-dist').innerText = '0 km';
        return;
    }

    let coveredSet = new Set();
    let totalDist = 0;
    let count = 0;

    peopleData.forEach(p => {
        let minDist = Infinity;
        let covered = false;
        targetPoints.forEach(t => {
            if(!t.visible) return;
            const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng)) / 1000;
            if (d <= t.radius) {
                covered = true;
                if (d < minDist) minDist = d;
            }
        });
        if (covered) {
            coveredSet.add(p.name);
            totalDist += minDist;
            count++;
        }
    });

    const rate = ((coveredSet.size / peopleData.length) * 100).toFixed(1);
    const avg = count > 0 ? (totalDist / count).toFixed(1) : 0;
    
    document.getElementById('stat-cover-rate').innerText = `${rate}%`;
    document.getElementById('stat-avg-dist').innerText = `${avg} km`;
}

function loadSampleDemoData() {
    peopleData = [...APP_CONFIG.SAMPLE_PEOPLE];
    peopleData.forEach(p => { if (!p.group) p.group = '未分组'; });
    rebuildGroupMeta();
    saveData();
    renderAllMapVisuals();
    mapManager.fitBoundsToPeople(peopleData);
    alert("已成功加载 11 名示范人员数据！地图已生成常驻姓名标签与高亮定位。");
}

// ===================== Group Management =====================

const GROUP_COLORS = ['#4285F4','#34A853','#EA4335','#FBBC04','#8E44AD','#E67E22','#1ABC9C','#E84393','#00B894','#6C5CE7','#FD79A8','#00CEC9','#D63031','#0984E3','#A29BFE'];

function rebuildGroupMeta() {
    const existingGroups = new Set(Object.keys(groupMeta));
    const currentGroups = new Set(peopleData.map(p => p.group || '未分组'));
    
    // Add new groups
    let colorIdx = existingGroups.size;
    currentGroups.forEach(g => {
        if (!groupMeta[g]) {
            groupMeta[g] = {
                color: GROUP_COLORS[colorIdx % GROUP_COLORS.length],
                visible: true,
                expanded: false
            };
            colorIdx++;
        }
    });
    
    // Remove groups with no members
    Object.keys(groupMeta).forEach(g => {
        if (!currentGroups.has(g)) delete groupMeta[g];
    });
}

function getVisiblePeople() {
    return peopleData.filter(p => {
        const gm = groupMeta[p.group];
        return gm ? gm.visible : true;
    });
}

function getGroupNames() {
    return Object.keys(groupMeta).sort((a, b) => {
        if (a === '未分组') return 1;
        if (b === '未分组') return -1;
        return a.localeCompare(b);
    });
}

function getGroupCount(groupName) {
    return peopleData.filter(p => p.group === groupName).length;
}

function toggleGroupVisibility(groupName) {
    if (groupMeta[groupName]) {
        groupMeta[groupName].visible = !groupMeta[groupName].visible;
        saveData();
        renderAllMapVisuals();
    }
}

function changeGroupColor(groupName, color) {
    if (groupMeta[groupName]) {
        groupMeta[groupName].color = color;
        saveData();
        renderAllMapVisuals();
    }
}

function toggleGroupExpand(groupName) {
    if (groupMeta[groupName]) {
        groupMeta[groupName].expanded = !groupMeta[groupName].expanded;
        renderGroupPanel();
        renderRosterList();
    }
}

function filterByGroup(groupName) {
    activeGroupFilter = (activeGroupFilter === groupName) ? null : groupName;
    renderGroupPanel();
    renderRosterList();
}

function showAllGroups() {
    Object.keys(groupMeta).forEach(g => groupMeta[g].visible = true);
    activeGroupFilter = null;
    saveData();
    renderAllMapVisuals();
}

function hideAllGroups() {
    Object.keys(groupMeta).forEach(g => groupMeta[g].visible = false);
    saveData();
    renderAllMapVisuals();
}

function renderGroupPanel() {
    const panel = document.getElementById('group-panel');
    if (!panel) return;
    
    const groups = getGroupNames();
    if (groups.length === 0) {
        panel.innerHTML = '<div style="color:var(--text-muted); font-size:11px; text-align:center; padding:8px;">暂无分组数据</div>';
        return;
    }
    
    let html = '';
    groups.forEach(g => {
        const gm = groupMeta[g];
        const count = getGroupCount(g);
        const isExpanded = gm.expanded;
        const isFiltered = activeGroupFilter === g;
        
        html += `<div class="group-item ${isFiltered ? 'group-filtered' : ''}" data-group="${g}">
            <div class="group-header" onclick="toggleGroupExpand('${g.replace(/'/g, "\\'")}')">
                <div style="display:flex;align-items:center;gap:6px;flex:1;overflow:hidden;">
                    <input type="checkbox" ${gm.visible ? 'checked' : ''} onclick="event.stopPropagation();toggleGroupVisibility('${g.replace(/'/g, "\\'")}')" title="显示/隐藏该组标记">
                    <input type="color" class="color-picker-input" value="${gm.color}" onclick="event.stopPropagation()" onchange="changeGroupColor('${g.replace(/'/g, "\\'")}', this.value)">
                    <span class="group-name" title="${g}">${g}</span>
                    <span class="badge badge-blue">${count}人</span>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();filterByGroup('${g.replace(/'/g, "\\'")}')" title="单独查看该组">
                        <i class="fa-solid fa-eye${isFiltered ? '' : '-slash'}" style="font-size:10px;"></i>
                    </button>
                    <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}" style="font-size:10px;color:var(--text-muted);"></i>
                </div>
            </div>`;
        
        if (isExpanded) {
            const members = peopleData.filter(p => p.group === g);
            html += `<div class="group-members">`;
            members.forEach((p, i) => {
                const idx = peopleData.indexOf(p);
                html += `<div class="group-member-item">
                    <span style="color:${gm.color};margin-right:4px;">●</span>
                    <span class="member-name">${p.name}</span>
                    <span class="member-addr">${p.address}</span>
                    <button class="btn btn-danger btn-sm" onclick="deletePerson(${idx})" title="删除" style="padding:1px 4px;font-size:9px;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`;
            });
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    panel.innerHTML = html;
}

// ===================== Data Export/Import =====================

function exportAllData() {
    const data = {
        version: '5.0',
        exportDate: new Date().toISOString(),
        people: peopleData,
        targets: targetPoints,
        groupMeta: groupMeta
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `智能分组地图_数据_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function triggerImportData() {
    document.getElementById('import-data-input').click();
}

async function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.people || !Array.isArray(data.people)) {
            alert('❌ 无效的数据文件格式！');
            return;
        }
        
        // Ensure group field
        data.people.forEach(p => { if (!p.group) p.group = '未分组'; });
        
        // Check for duplicates
        const existingNames = new Set(peopleData.map(p => p.name));
        const duplicates = data.people.filter(p => existingNames.has(p.name));
        const newPeople = data.people.filter(p => !existingNames.has(p.name));
        
        let mergeChoice = 'add_new'; // default
        
        if (duplicates.length > 0) {
            const choice = prompt(
                `检测到 ${duplicates.length} 个重名人员：\n` +
                duplicates.slice(0, 5).map(p => `  · ${p.name}`).join('\n') +
                (duplicates.length > 5 ? `\n  ... 等 ${duplicates.length} 人` : '') +
                `\n\n请选择处理方式：\n` +
                `1 = 跳过重名 (仅导入 ${newPeople.length} 名新人员)\n` +
                `2 = 覆盖重名 (用新数据替换)\n` +
                `3 = 全部导入 (包括重名，作为不同人员)\n` +
                `0 = 取消导入`,
                '1'
            );
            
            if (choice === '0' || choice === null) return;
            if (choice === '2') mergeChoice = 'overwrite';
            else if (choice === '3') mergeChoice = 'add_all';
            // else: default 'add_new' (skip duplicates)
        }
        
        if (mergeChoice === 'overwrite') {
            // Remove existing duplicates, then add all imported
            const dupNames = new Set(duplicates.map(p => p.name));
            peopleData = peopleData.filter(p => !dupNames.has(p.name));
            peopleData = peopleData.concat(data.people);
        } else if (mergeChoice === 'add_all') {
            peopleData = peopleData.concat(data.people);
        } else {
            // add_new: only non-duplicates
            peopleData = peopleData.concat(newPeople);
        }
        
        // Import targets if present
        if (data.targets && Array.isArray(data.targets)) {
            const existingTargetNames = new Set(targetPoints.map(t => t.name));
            data.targets.forEach(t => {
                if (!existingTargetNames.has(t.name)) {
                    t.id = Date.now() + Math.random(); // ensure unique id
                    if (t.visible === undefined) t.visible = true;
                    targetPoints.push(t);
                }
            });
        }
        
        // Import group meta
        if (data.groupMeta) {
            Object.keys(data.groupMeta).forEach(g => {
                if (!groupMeta[g]) groupMeta[g] = data.groupMeta[g];
            });
        }
        
        rebuildGroupMeta();
        saveData();
        renderAllMapVisuals();
        
        const importedCount = mergeChoice === 'add_new' ? newPeople.length : data.people.length;
        alert(`✅ 成功导入 ${importedCount} 名人员数据！` +
            (duplicates.length > 0 ? ` (${duplicates.length} 名重名${mergeChoice === 'overwrite' ? '已覆盖' : mergeChoice === 'add_all' ? '已全部导入' : '已跳过'})` : ''));
    } catch (e) {
        alert('❌ 文件解析失败：' + e.message);
    }
    
    event.target.value = '';
}

function clearAllPeople() {
    if(confirm("确定要清空所有已导入的人员数据吗？")) {
        peopleData = [];
        groupMeta = {};
        activeGroupFilter = null;
        saveData();
        renderAllMapVisuals();
        updateResults();
        document.getElementById('csv-file-input').value = '';
        document.getElementById('csv-status').innerText = '';
    }
}

async function addSinglePerson() {
    const name = document.getElementById('add-name').value.trim();
    const address = document.getElementById('add-address').value.trim();
    const group = (document.getElementById('add-group') ? document.getElementById('add-group').value.trim() : '') || '未分组';
    const status = document.getElementById('add-status');

    if (!name || !address) {
        alert("请输入完整的姓名和地址/坐标！");
        return;
    }
    status.innerText = "🔍 智能定位中...";

    const coords = await freeGeocode(address);
    if(coords) {
        peopleData.push({ name, lat: coords.lat, lng: coords.lng, address, group });
        rebuildGroupMeta();
        saveData();
        renderAllMapVisuals();
        status.innerText = `✅ 成功添加人员: ${name} → ${group}`;
        document.getElementById('add-name').value = '';
        document.getElementById('add-address').value = '';
        if (document.getElementById('add-group')) document.getElementById('add-group').value = '';
        updateResultsByActiveTarget();
    } else {
        status.innerText = "❌ 检索未果，请尝试更详细的地址或输入 Lat,Lng 坐标。";
    }
}

/**
 * 手动添加单个人员 - 智能解包剪贴板数据并填入输入框
 */
async function pasteSinglePersonFromClipboard() {
    try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            alert('请直接在姓名或地址输入框内按 Ctrl+V 粘贴！');
            return;
        }
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
            alert('📋 当前剪贴板无内容！\n请先在表格或 Excel 中复制单元格数据。');
            return;
        }
        const lines = text.trim().split(/\r?\n/).filter(Boolean);
        if (lines.length > 1) {
            if (confirm(`📋 剪贴板中检测到 ${lines.length} 行表格数据！\n是否直接批量导入？`)) {
                importFromRawText(text);
            }
            return;
        }
        const row = (lines[0].includes('\t') ? lines[0].split('\t') : lines[0].split(',')).map(c => c.trim()).filter(Boolean);
        if (row.length >= 3) {
            if (document.getElementById('add-group')) document.getElementById('add-group').value = row[0];
            document.getElementById('add-name').value = row[1];
            document.getElementById('add-address').value = row[2];
        } else if (row.length === 2) {
            document.getElementById('add-name').value = row[0];
            document.getElementById('add-address').value = row[1];
        } else {
            document.getElementById('add-name').value = lines[0];
        }
        const status = document.getElementById('add-status');
        if (status) status.innerText = `📋 已自动将剪贴板内容拆分填入框内，点击“添加”按钮完成定位！`;
    } catch (e) {
        alert('读取剪贴板受限，请在姓名或地址框内按 Ctrl+V 粘贴！');
    }
}

function deletePerson(idx) {
    peopleData.splice(idx, 1);
    rebuildGroupMeta();
    saveData();
    renderAllMapVisuals();
    updateResultsByActiveTarget();
}

async function editPerson(idx, event) {
    if(event) event.stopPropagation();
    const p = peopleData[idx];
    if(!p) return;

    const newName = prompt("编辑人员姓名：", p.name);
    if(newName === null) return;
    
    const newAddress = prompt("编辑人员地址或 Lat,Lng 坐标：", p.address);
    if(newAddress === null) return;

    const trimmedName = newName.trim() || p.name;
    const trimmedAddress = newAddress.trim() || p.address;

    if (trimmedAddress !== p.address) {
        const coords = await freeGeocode(trimmedAddress);
        if (coords) {
            peopleData[idx] = { name: trimmedName, lat: coords.lat, lng: coords.lng, address: trimmedAddress, group: p.group || '未分组' };
        } else {
            alert("该地址无法定位，已保留原坐标。");
            peopleData[idx].name = trimmedName;
            peopleData[idx].address = trimmedAddress;
        }
    } else {
        peopleData[idx].name = trimmedName;
    }

    saveData();
    renderAllMapVisuals();
}

function renderRosterList(filterText = '') {
    const listDiv = document.getElementById('roster-list');
    listDiv.innerHTML = '';
    document.getElementById('roster-count').innerText = peopleData.length;

    peopleData.forEach((p, idx) => {
        // Filter by group
        if (activeGroupFilter && p.group !== activeGroupFilter) return;
        
        // Filter by search text
        if(filterText && !p.name.toLowerCase().includes(filterText.toLowerCase()) && !p.address.toLowerCase().includes(filterText.toLowerCase())) {
            return;
        }
        
        const gm = groupMeta[p.group];
        const groupColor = gm ? gm.color : '#4285F4';
        
        const div = document.createElement('div');
        div.className = 'person-item';
        div.innerHTML = `
            <div class="person-info">
                <div class="person-name">
                    <span style="color:${groupColor};font-size:10px;">●</span>
                    ${p.name}
                    <span class="badge" style="background:${groupColor}22;color:${groupColor};font-size:8px;padding:1px 5px;">${p.group}</span>
                </div>
                <div class="person-addr">${p.address}</div>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="editPerson(${idx}, event)" title="编辑姓名/地址">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deletePerson(${idx})" title="删除人员">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        listDiv.appendChild(div);
    });
}

function filterRoster() {
    const q = document.getElementById('roster-search').value;
    renderRosterList(q);
}

// Failed geocoding entries (global, persisted during session)
let failedGeoEntries = [];

// CSV Upload event
document.getElementById('csv-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async function(results) {
            await processParsedRows(results.data);
            e.target.value = '';
        }
    });
});

/**
 * 核心导入引擎：解析并同步地理编码 (共享用于 CSV文件、剪贴板粘贴、文本框粘贴)
 */
async function processParsedRows(rows) {
    if (!rows || rows.length === 0) return;

    // Mandatory: must select a country first
    const countryCode = (typeof getSelectedCountryCode === 'function') ? getSelectedCountryCode() : '';
    if (!countryCode) {
        alert('⚠️ 请先选择人员所在国家！\n\n在“选择人员所在国家”输入框中搜索并选择国家后再导入。');
        return;
    }

    const tempPeople = [];
    const statusDiv = document.getElementById('csv-status');
    const progressWrap = document.getElementById('csv-progress-wrap');
    const progressFill = document.getElementById('csv-progress-fill');
    
    progressWrap.style.display = 'block';
    statusDiv.innerText = "正在解析并同步地理位置...";

    let skippedCount = 0;
    failedGeoEntries = []; // Reset failed list

    // Helper: detect if a row is a header or empty row
    function isHeaderOrEmpty(row) {
        const col0 = (row[0] || '').trim();
        if (!col0) return true;
        const lower = col0.toLowerCase();
        if (lower.includes('name') || lower.includes('姓') || lower.includes('名字') ||
            lower.includes('新人') || lower.includes('地址') || lower.includes('address') ||
            lower.includes('town') || lower.includes('believer') || lower.includes('street') ||
            lower.includes('village') || lower.includes('组') || lower.includes('group')) {
            return true;
        }
        return false;
    }

    // Detect column format by checking first data row
    let dataStartIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (isHeaderOrEmpty(rows[i])) {
            dataStartIdx = i + 1;
        } else {
            break;
        }
    }

    // Detect format from column count of first data row
    const sampleRow = rows[dataStartIdx] || [];
    const colCount = sampleRow.filter(c => (c || '').trim()).length;
    
    let format = '2col'; // name, address
    if (colCount >= 4) {
        const testLat = parseFloat((sampleRow[1] || '').trim());
        const testLng = parseFloat((sampleRow[2] || '').trim());
        if (!isNaN(testLat) && !isNaN(testLng) && Math.abs(testLat) <= 90) {
            format = '4col'; // name, lat, lng, address
        } else {
            format = '3col'; // group, name, address
        }
    } else if (colCount === 3) {
        const testLat = parseFloat((sampleRow[1] || '').trim());
        const testLng = parseFloat((sampleRow[2] || '').trim());
        if (!isNaN(testLat) && !isNaN(testLng) && Math.abs(testLat) <= 90) {
            format = '4col'; // name, lat, lng
        } else {
            format = '3col'; // group, name, address
        }
    }

    statusDiv.innerText = `检测到 ${format === '3col' ? '3列(组名,姓名,地址)' : format === '4col' ? '4列(姓名,纬度,经度,地址)' : '2列(姓名,地址)'} 格式`;

    const directRows = [];
    const geocodeRows = [];

    for (let i = dataStartIdx; i < rows.length; i++) {
        let group = '未分组';
        let name, address, lat, lng;

        if (format === '3col') {
            group = sanitizeImportedString(rows[i][0]) || '未分组';
            name = sanitizeImportedString(rows[i][1]);
            address = sanitizeImportedString(rows[i][2]);
        } else if (format === '4col') {
            name = sanitizeImportedString(rows[i][0]);
            lat = parseFloat(sanitizeImportedString(rows[i][1]));
            lng = parseFloat(sanitizeImportedString(rows[i][2]));
            address = sanitizeImportedString(rows[i][3]) || 'GPS Location';
        } else {
            name = sanitizeImportedString(rows[i][0]);
            address = sanitizeImportedString(rows[i][1]);
        }

        if (!name) { skippedCount++; continue; }

        if (format === '4col' && !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            directRows.push({ name, lat, lng, address, group });
        } else if (address) {
            geocodeRows.push({ name, address, group });
        } else {
            skippedCount++;
        }
    }

    // Duplicate detection
    const existingNames = new Set(peopleData.map(p => p.name));
    const allNewRows = [...directRows, ...geocodeRows];
    const dupRows = allNewRows.filter(r => existingNames.has(r.name));

    let skipDupNames = new Set();
    if (dupRows.length > 0) {
        const choice = prompt(
            `检测到 ${dupRows.length} 个已存在的人员：\n` +
            dupRows.slice(0, 5).map(r => `  · ${r.name}`).join('\n') +
            (dupRows.length > 5 ? `\n  ... 等` : '') +
            `\n\n1 = 跳过重名\n2 = 覆盖重名\n3 = 全部导入\n0 = 取消`,
            '1'
        );
        if (choice === '0' || choice === null) {
            progressWrap.style.display = 'none';
            statusDiv.innerText = '已取消导入。';
            return;
        }
        if (choice === '1') {
            skipDupNames = new Set(dupRows.map(r => r.name));
        } else if (choice === '2') {
            const dupNameSet = new Set(dupRows.map(r => r.name));
            peopleData = peopleData.filter(p => !dupNameSet.has(p.name));
        }
    }

    const filteredDirect = directRows.filter(r => !skipDupNames.has(r.name));
    const filteredGeocode = geocodeRows.filter(r => !skipDupNames.has(r.name));

    tempPeople.push(...filteredDirect);

    const totalGeocode = filteredGeocode.length;
    const MAX_RETRIES = 4;

    for (let i = 0; i < totalGeocode; i++) {
        const row = filteredGeocode[i];
        statusDiv.innerText = `🌍 地址解析中: (${i + 1}/${totalGeocode}) ${row.name}...`;
        progressFill.style.width = `${((i + 1) / totalGeocode) * 100}%`;

        let coords = null;
        let retryDelay = 500;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            coords = await freeGeocode(row.address);
            if (coords) break;

            if (attempt < MAX_RETRIES) {
                statusDiv.innerText = `⏳ 重试 ${row.name}... (${attempt + 1}/${MAX_RETRIES}, 等待 ${retryDelay / 1000}s)`;
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay *= 2;
            }
        }

        if (coords) {
            tempPeople.push({ name: row.name, lat: coords.lat, lng: coords.lng, address: row.address, group: row.group || '未分组' });
        } else {
            failedGeoEntries.push({ name: row.name, address: row.address, group: row.group || '未分组' });
        }

        if (i < totalGeocode - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    peopleData = peopleData.concat(tempPeople);
    rebuildGroupMeta();
    saveData();
    renderAllMapVisuals();
    
    let resultMsg = `🎉 成功解析并导入 ${tempPeople.length} 名人员数据！`;
    if (failedGeoEntries.length > 0) {
        resultMsg += ` (${failedGeoEntries.length} 条地址解析失败)`;
    }
    if (skippedCount > 0) {
        resultMsg += ` (跳过 ${skippedCount} 条空行)`;
    }
    statusDiv.innerText = resultMsg;
    
    renderFailedList();
    mapManager.fitBoundsToPeople(peopleData);
    updateResultsByActiveTarget();
}

/**
 * 打开粘贴导入弹窗面板 (100% 交互响应)
 */
async function openPasteModal(mode = 'batch') {
    console.log(`[PasteSystem] 🚀 触发 openPasteModal，当前模式:`, mode);
    window.currentPasteMode = mode;
    const modal = document.getElementById('paste-modal');
    const textarea = document.getElementById('paste-textarea');
    const status = document.getElementById('paste-preview-status');
    
    if (!modal || !textarea) {
        console.error('[PasteSystem] ❌ 找不到 paste-modal 或 paste-textarea DOM 节点！');
        alert('页面粘贴组件未就绪，请刷新页面再试。');
        return;
    }

    modal.style.display = 'flex';
    status.innerText = '';
    
    setTimeout(() => textarea.focus(), 100);

    // 尝试直接自动从系统剪贴板读取
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            console.log('[PasteSystem] 📥 成功从剪贴板读取到文本:', text);
            if (text && text.trim()) {
                textarea.value = text;
                previewPasteText();
            }
        }
    } catch (e) {
        console.warn('[PasteSystem] ⚠️ 浏览器未允许剪贴板自动读取授权，已聚焦文本框等待用户按 Ctrl+V 粘贴:', e);
    }
}

function closePasteModal() {
    console.log('[PasteSystem] ✖️ 关闭粘贴弹窗');
    const modal = document.getElementById('paste-modal');
    if (modal) modal.style.display = 'none';
}

function previewPasteText() {
    const text = document.getElementById('paste-textarea').value;
    const status = document.getElementById('paste-preview-status');
    if (!text || !text.trim()) {
        status.innerText = '';
        return;
    }
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    console.log(`[PasteSystem] 🔍 实时预览检测，当前有效数据行数:`, lines.length);
    status.innerText = `🔍 已识别出 ${lines.length} 行表格数据，点击“立即解析”即可开始打点！`;
}

function submitPasteModal() {
    const text = document.getElementById('paste-textarea').value;
    console.log('[PasteSystem] ⚡ 提交粘贴文本进行解析，模式:', window.currentPasteMode, '文本长度:', text ? text.length : 0);
    if (!text || !text.trim()) {
        alert('请先在框内按 Ctrl+V 粘贴表格内容！');
        return;
    }

    closePasteModal();

    if (window.currentPasteMode === 'single') {
        const rows = parseRFC4180CSVOrTSV(text);
        if (rows.length === 1) {
            const row = rows[0];
            console.log('[PasteSystem] 📋 拆分单条人员数据:', row);
            if (row.length >= 3) {
                if (document.getElementById('add-group')) document.getElementById('add-group').value = row[0];
                if (document.getElementById('add-name')) document.getElementById('add-name').value = row[1];
                if (document.getElementById('add-address')) document.getElementById('add-address').value = row[2];
            } else if (row.length === 2) {
                if (document.getElementById('add-name')) document.getElementById('add-name').value = row[0];
                if (document.getElementById('add-address')) document.getElementById('add-address').value = row[1];
            } else {
                if (document.getElementById('add-name')) document.getElementById('add-name').value = text.trim();
            }
            const addStatus = document.getElementById('add-status');
            if (addStatus) addStatus.innerText = `📋 已成功自动拆分填入输入框，点击“添加”按钮完成发布定位！`;
            return;
        }
    }

    importFromRawText(text);
}

// 显式挂载到 window 作用域，确保 onclick 内联事件绝对可访问
window.openPasteModal = openPasteModal;
window.closePasteModal = closePasteModal;
window.previewPasteText = previewPasteText;
window.submitPasteModal = submitPasteModal;
window.onTempRadiusInput = onTempRadiusInput;
window.quickSetTempRadius = quickSetTempRadius;
window.editTargetRadius = editTargetRadius;
window.switchSearchMode = switchSearchMode;
window.batchSearchTargetAddresses = batchSearchTargetAddresses;
window.syncAlgoRadiusInput = syncAlgoRadiusInput;
window.syncAlgoRadiusSlider = syncAlgoRadiusSlider;
window.syncAlgoKInput = syncAlgoKInput;
window.syncAlgoKSlider = syncAlgoKSlider;
window.toggleAlgoPreviewMode = toggleAlgoPreviewMode;
window.applySmartGroupingPreview = applySmartGroupingPreview;
window.searchNearbyVenues = searchNearbyVenues;
window.clearNearbyVenues = clearNearbyVenues;

// ======================== 附近聚会场所推荐 ========================

/**
 * 搜索当前选中分组中心附近的聚会场所
 */
async function searchNearbyVenues() {
    if (!activeTargetId) {
        alert('请先选择一个分组中心！点击地图上的分组水滴即可选中。');
        return;
    }

    const target = targetPoints.find(t => t.id === activeTargetId);
    if (!target) return;

    const btn = document.getElementById('search-venues-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 搜索中...';
    }

    // 搜索半径：取分组覆盖半径 (km) 转为米，最小5km最大50km
    const searchRadiusM = Math.min(50000, Math.max(5000, target.radius * 1000));

    // Google Places 搜索类型：图书馆 + 社区活动中心
    const placeTypes = ['library', 'community_center'];

    try {
        const places = await searchNearbyPlaces(target.lat, target.lng, searchRadiusM, placeTypes);

        if (places.length === 0) {
            const venuesPanel = document.getElementById('venues-results');
            if (venuesPanel) {
                venuesPanel.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:15px; font-size:12px;">
                    在 ${target.name} 附近 ${(searchRadiusM/1000).toFixed(0)}km 范围内未找到图书馆或社区中心。<br>
                    <span style="font-size:11px;">💡 提示：可以尝试扩大分组覆盖半径后重新搜索。</span>
                </div>`;
                venuesPanel.style.display = 'block';
            }
            mapManager.clearPlaceMarkers();
        } else {
            // 在地图上渲染场所标记
            mapManager.renderPlaceMarkers(places, target);

            // 在面板中渲染场所列表
            renderVenuesList(places, target);
        }
    } catch (e) {
        console.error('搜索附近场所出错:', e);
        alert('搜索附近场所时出现网络错误，请检查 API Key 或网络连接。');
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> 搜索附近聚会场所';
    }
}

/**
 * 清除附近场所标记和列表
 */
function clearNearbyVenues() {
    mapManager.clearPlaceMarkers();
    const venuesPanel = document.getElementById('venues-results');
    if (venuesPanel) {
        venuesPanel.style.display = 'none';
        venuesPanel.innerHTML = '';
    }
}

/**
 * 渲染附近场所列表到面板
 */
function renderVenuesList(places, target) {
    const panel = document.getElementById('venues-results');
    if (!panel) return;

    let html = `<div style="font-weight:700; font-size:13px; margin-bottom:8px; color:var(--accent-purple);">
        <i class="fa-solid fa-location-dot"></i> ${target.name} 附近找到 ${places.length} 个聚会场所
        <button class="btn btn-outline btn-sm" onclick="clearNearbyVenues()" style="float:right; font-size:10px; padding:2px 8px;">
            <i class="fa-solid fa-xmark"></i> 清除
        </button>
    </div>`;

    places.forEach((place, idx) => {
        const distText = place.distance < 1000
            ? `${Math.round(place.distance)}m`
            : `${(place.distance / 1000).toFixed(1)}km`;

        html += `<div class="venue-item" style="
            padding:8px 10px; margin-bottom:4px; border-radius:8px; cursor:pointer;
            background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.15);
            transition:background 0.2s;
        " onmouseenter="this.style.background='rgba(139,92,246,0.15)'"
           onmouseleave="this.style.background='rgba(139,92,246,0.06)'"
           onclick="mapManager.map.setView([${place.lat}, ${place.lng}], 15); mapManager.placeMarkers[${idx}]?.openPopup();">
            <div style="font-weight:600; font-size:12px;">${place.typeLabel} ${place.name}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${place.address}</div>
            <div style="font-size:11px; color:var(--accent-purple); margin-top:2px; font-weight:600;">📏 距离: ${distText}
                <a href="https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}" target="_blank"
                   style="float:right; font-size:10px; color:var(--accent-blue); text-decoration:none;">🔗 Google Maps</a>
            </div>
        </div>`;
    });

    panel.innerHTML = html;
    panel.style.display = 'block';
}

console.log('[PasteSystem] 💡 app.js (v2.6) 已成功加载并绑定全范围 500km 数字/滑块双模调控接口！');

/**
 * 符合 RFC 4180 标准的状态机解析器：严格尊重双引号包裹与单元格内换行，绝不产生非法多余拆行
 */
function parseRFC4180CSVOrTSV(text) {
    if (!text || !text.trim()) return [];

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    // 智能检测主要分隔符：优先检测 Tab (\t) ，其次为逗号 (,)
    const tabCount = (text.match(/\t/g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    const delimiter = tabCount >= commaCount ? '\t' : ',';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // 转义的双引号 ""
                currentCell += '"';
                i++;
            } else {
                // 切换双引号状态
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            // 单元格结束 -> 规范化内部换行并入行
            currentRow.push(currentCell.replace(/[\r\n]+/g, ' ').trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            // 只有在双引号外面遇到的 \n 才表示真正的表格“换行”！
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.replace(/[\r\n]+/g, ' ').trim());
            if (currentRow.some(c => c !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.replace(/[\r\n]+/g, ' ').trim());
        if (currentRow.some(c => c !== '')) {
            rows.push(currentRow);
        }
    }

    return rows;
}

/**
 * 解析原始文本并导入（支持从 Google Sheets / Excel 复制的数据，标准解析多行及内包换行）
 */
function importFromRawText(text) {
    if (!text || !text.trim()) return;

    const rows = parseRFC4180CSVOrTSV(text);

    if (rows.length > 0) {
        processParsedRows(rows);
    } else {
        alert('未在剪贴板或输入的文本中识别到有效的数据行。');
    }
}

// 监听全局 Ctrl+V 粘贴事件：若未在普通输入框打字，直接粘贴表格文本亦可自动触发导入
document.addEventListener('paste', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea') return;

    const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (pastedText && (pastedText.includes('\t') || pastedText.includes('\n'))) {
        e.preventDefault();
        importFromRawText(pastedText);
    }
});

/**
 * Render the failed geocoding list with individual retry buttons
 */
function renderFailedList() {
    const panel = document.getElementById('geocode-fail-panel');
    const list = document.getElementById('geocode-fail-list');
    const countSpan = document.getElementById('fail-count');
    
    if (failedGeoEntries.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    countSpan.textContent = failedGeoEntries.length;
    
    list.innerHTML = failedGeoEntries.map((entry, idx) => `
        <div class="geocode-fail-item" id="fail-item-${idx}">
            <div class="geocode-fail-info">
                <div class="geocode-fail-name">${entry.name}</div>
                <div class="geocode-fail-addr" title="${entry.address}">${entry.address}</div>
            </div>
            <button class="geocode-retry-btn" id="retry-btn-${idx}" onclick="retrySingleGeocode(${idx})">
                <i class="fa-solid fa-rotate"></i> 重试
            </button>
        </div>
    `).join('');
}

/**
 * Retry a single failed geocoding entry
 */
async function retrySingleGeocode(idx) {
    const entry = failedGeoEntries[idx];
    if (!entry) return;
    
    const btn = document.getElementById(`retry-btn-${idx}`);
    const item = document.getElementById(`fail-item-${idx}`);
    
    btn.className = 'geocode-retry-btn retrying';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 解析中...';
    
    const coords = await freeGeocode(entry.address);
    
    if (coords) {
        // Success! Add to people data
        peopleData.push({ name: entry.name, lat: coords.lat, lng: coords.lng, address: entry.address, group: entry.group || '未分组' });
        saveData();
        renderAllMapVisuals();
        updateResultsByActiveTarget();
        
        btn.className = 'geocode-retry-btn done';
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 成功';
        item.className = 'geocode-fail-item success';
        
        // Remove from failed list
        failedGeoEntries[idx] = null;
        updateFailCount();
    } else {
        btn.className = 'geocode-retry-btn';
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重试';
    }
}

/**
 * Retry all failed entries sequentially with exponential backoff
 */
async function retryAllFailed() {
    const retryBtn = document.getElementById('retry-all-btn');
    retryBtn.disabled = true;
    retryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 重试中...';
    
    const statusDiv = document.getElementById('csv-status');
    const remaining = failedGeoEntries.filter(e => e !== null);
    let successCount = 0;
    
    for (let idx = 0; idx < failedGeoEntries.length; idx++) {
        const entry = failedGeoEntries[idx];
        if (!entry) continue; // Already resolved
        
        const btn = document.getElementById(`retry-btn-${idx}`);
        const item = document.getElementById(`fail-item-${idx}`);
        
        btn.className = 'geocode-retry-btn retrying';
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 解析中...';
        statusDiv.innerText = `🔄 批量重试中: ${entry.name}...`;
        
        let coords = null;
        let retryDelay = 500;
        
        // Exponential backoff: up to 4 retries (0.5s, 1s, 2s, 4s)
        for (let attempt = 0; attempt < 4; attempt++) {
            coords = await freeGeocode(entry.address);
            if (coords) break;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2;
        }
        
        if (coords) {
            peopleData.push({ name: entry.name, lat: coords.lat, lng: coords.lng, address: entry.address, group: entry.group || '未分组' });
            btn.className = 'geocode-retry-btn done';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 成功';
            item.className = 'geocode-fail-item success';
            failedGeoEntries[idx] = null;
            successCount++;
        } else {
            btn.className = 'geocode-retry-btn';
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重试';
        }
        
        // Short delay between entries (Photon is fast)
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    saveData();
    renderAllMapVisuals();
    updateResultsByActiveTarget();
    updateFailCount();
    
    retryBtn.disabled = false;
    retryBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 全部重试';
    statusDiv.innerText = `🔄 重试完成: 成功 ${successCount} 条，剩余 ${failedGeoEntries.filter(e => e !== null).length} 条`;
}

/**
 * Update the fail count display
 */
function updateFailCount() {
    const remaining = failedGeoEntries.filter(e => e !== null).length;
    document.getElementById('fail-count').textContent = remaining;
    if (remaining === 0) {
        document.getElementById('geocode-fail-panel').style.display = 'none';
        document.getElementById('csv-status').innerText = `🎉 所有人员数据已成功导入！共 ${peopleData.length} 人`;
    }
}

function toggleProbeMode() {
    mapManager.isProbeMode = !mapManager.isProbeMode;
    const btn = document.getElementById('probe-btn');
    if(mapManager.isProbeMode) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> 探针中 (点击地图锁定)';
        mapManager.map.getContainer().style.cursor = 'crosshair';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> 开启探针';
        mapManager.map.getContainer().style.cursor = '';
        if(mapManager.probeCircle) {
            mapManager.map.removeLayer(mapManager.probeCircle);
            mapManager.probeCircle = null;
        }
        mapManager.probeLines.forEach(l => mapManager.map.removeLayer(l));
        mapManager.probeLines = [];
    }
}

function switchSearchMode(mode) {
    const singlePanel = document.getElementById('single-search-panel');
    const batchPanel = document.getElementById('batch-search-panel');
    const singleBtn = document.getElementById('search-mode-single-btn');
    const batchBtn = document.getElementById('search-mode-batch-btn');

    if (mode === 'single') {
        singlePanel.style.display = 'block';
        batchPanel.style.display = 'none';
        singleBtn.style.background = 'var(--accent-blue)';
        singleBtn.style.color = '#fff';
        batchBtn.style.background = 'transparent';
        batchBtn.style.color = 'var(--text-muted)';
    } else {
        singlePanel.style.display = 'none';
        batchPanel.style.display = 'block';
        batchBtn.style.background = 'var(--accent-blue)';
        batchBtn.style.color = '#fff';
        singleBtn.style.background = 'transparent';
        singleBtn.style.color = 'var(--text-muted)';
    }
}

async function searchTargetAddress() {
    const query = document.getElementById('search-address-input').value.trim();
    if (!query) return;
    const statusDiv = document.getElementById('search-status');
    statusDiv.innerText = "🔍 定位中...";

    const coords = await freeGeocode(query);
    if (coords) {
        statusDiv.innerText = "✅ 定位成功！";
        const latlng = L.latLng(coords.lat, coords.lng);
        mapManager.map.setView(latlng, 14); 
        setTempTarget(latlng, query);
    } else {
        statusDiv.innerText = "❌ 检索未果，请尝试更准确的名称。";
    }
}

async function batchSearchTargetAddresses() {
    const textarea = document.getElementById('batch-address-input');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) {
        alert('请先在框内粘贴或输入多个选址地址（一行一个）！');
        return;
    }

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
        alert('未检测到有效的地址行！');
        return;
    }

    const statusDiv = document.getElementById('search-status');
    statusDiv.innerText = `⏳ 开始批量解析 ${lines.length} 个选址目标地址...`;

    let successCount = 0;
    let failCount = 0;
    const radius = currentTempRadius || 5.0;

    for (let i = 0; i < lines.length; i++) {
        const addressName = lines[i];
        statusDiv.innerText = `🌍 批量定位中 (${i + 1}/${lines.length}): ${addressName}...`;

        const coords = await freeGeocode(addressName);
        if (coords) {
            const color = APP_CONFIG.COLORS[targetPoints.length % APP_CONFIG.COLORS.length];
            const newTarget = {
                id: Date.now() + i,
                name: addressName.length > 18 ? addressName.substring(0, 18) + '...' : addressName,
                address: addressName,
                lat: coords.lat,
                lng: coords.lng,
                radius: radius,
                color: color,
                visible: true
            };
            targetPoints.push(newTarget);
            activeTargetId = newTarget.id;
            successCount++;
        } else {
            failCount++;
        }

        if (i < lines.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    saveData();
    renderAllMapVisuals();

    if (targetPoints.length > 0) {
        mapManager.fitBoundsToTargets(targetPoints);
    }

    let msg = `🎉 批量导入完成！成功解析保存 ${successCount} 个选址中心`;
    if (failCount > 0) msg += ` (${failCount} 个地址检索未果)`;
    statusDiv.innerText = msg;
}

function setTempTarget(latlng, name = "定位位置") {
    tempLatLng = latlng;
    tempAddressName = name;
    document.getElementById('center-info').innerHTML = `📍 临时选定 (未保存): <br><strong>${name}</strong> (覆盖半径: ${currentTempRadius.toFixed(1)} km)`;
    mapManager.clearRoutesAndSpokes();
    drawCircle(latlng, currentTempRadius);
}

function onTempRadiusInput(val) {
    currentTempRadius = parseFloat(val) || 50.0;
    const label = document.getElementById('temp-radius-val-label');
    if (label) label.innerText = `${currentTempRadius.toFixed(1)} km`;
    const slider = document.getElementById('temp-radius-slider');
    if (slider && parseFloat(slider.value) !== currentTempRadius) slider.value = currentTempRadius;
    const numberInput = document.getElementById('temp-radius-number');
    if (numberInput && parseFloat(numberInput.value) !== currentTempRadius) numberInput.value = currentTempRadius;

    // 若当前存在临时搜索定位中心（未保存为目标点），实时以独占半径重绘其覆盖圆
    if (tempLatLng && !activeTargetId) {
        drawCircle(tempLatLng, currentTempRadius);
        document.getElementById('center-info').innerHTML = `📍 临时选定 (未保存): <br><strong>${tempAddressName}</strong> (覆盖半径: ${currentTempRadius.toFixed(1)} km)`;
    }
}

function quickSetTempRadius(km) {
    onTempRadiusInput(km);
}

function onRadiusSliderInput(val) {
    const r = parseFloat(val) || 50.0;
    const label = document.getElementById('radius-val-label');
    if (label) label.innerText = `${r.toFixed(1)} km`;
    const slider = document.getElementById('search-radius-slider');
    if (slider && parseFloat(slider.value) !== r) slider.value = r;
    const numberInput = document.getElementById('search-radius-number');
    if (numberInput && parseFloat(numberInput.value) !== r) numberInput.value = r;

    updateActiveTargetRadius();
}

function selectTarget(id) {
    activeTargetId = id;
    const target = targetPoints.find(t => t.id === id);
    if (target) {
        const slider = document.getElementById('search-radius-slider');
        if (slider) slider.value = target.radius;
        const numberInput = document.getElementById('search-radius-number');
        if (numberInput) numberInput.value = target.radius;
        const label = document.getElementById('radius-val-label');
        if (label) label.innerText = `${target.radius.toFixed(1)} km`;
        document.getElementById('center-info').innerHTML = `当前选定：【<strong>${target.name}</strong>】 (专属半径: ${target.radius} km)`;
        
        renderTargetsList();
        renderAllMapVisuals();
        updateResults(L.latLng(target.lat, target.lng), target.radius, target.color);
    }
    saveData();
}

function updateActiveTargetRadius() {
    const numberInput = document.getElementById('search-radius-number');
    const sliderInput = document.getElementById('search-radius-slider');
    const radius = parseFloat(numberInput && numberInput.value ? numberInput.value : (sliderInput ? sliderInput.value : 50)) || 50;

    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) {
            target.radius = radius;
            saveData();
            renderAllMapVisuals();
            updateResults(L.latLng(target.lat, target.lng), radius, target.color);
        }
    } else if (tempLatLng) {
        currentTempRadius = radius;
        drawCircle(tempLatLng, radius);
    }
}

function saveCurrentAsTarget() {
    if (!tempLatLng) {
        alert("请先在地图上点击或搜索选择目标位置！");
        return;
    }
    const name = prompt("请为此选址中心命名：", tempAddressName);
    if (!name) return;

    // 精确使用该搜索定位中心独立设定的半径
    const radius = currentTempRadius || 50.0;
    const color = APP_CONFIG.COLORS[targetPoints.length % APP_CONFIG.COLORS.length];

    const newTarget = {
        id: Date.now(),
        name: name,
        address: tempAddressName || `${tempLatLng.lat.toFixed(5)}, ${tempLatLng.lng.toFixed(5)}`,
        lat: tempLatLng.lat,
        lng: tempLatLng.lng,
        radius: radius,
        color: color,
        visible: true
    };

    targetPoints.push(newTarget);
    activeTargetId = newTarget.id;
    saveData();
    renderAllMapVisuals();
    selectTarget(newTarget.id);
}

function editTargetName(id, event) {
    if (event) event.stopPropagation();
    const target = targetPoints.find(t => t.id === id);
    if (!target) return;

    const newName = prompt("编辑该目标选址/中心名称：", target.name);
    if (newName && newName.trim() && newName.trim() !== target.name) {
        target.name = newName.trim();
        saveData();
        renderAllMapVisuals();
    }
}

function editTargetRadius(id, event) {
    if (event) event.stopPropagation();
    const target = targetPoints.find(t => t.id === id);
    if (!target) return;

    const input = prompt(`修改【${target.name}】的独立覆盖半径 (公里):`, target.radius);
    if (input !== null) {
        const newR = parseFloat(input);
        if (!isNaN(newR) && newR > 0) {
            target.radius = newR;
            if (activeTargetId === id) {
                const slider = document.getElementById('search-radius-slider');
                if (slider) slider.value = newR;
                const label = document.getElementById('radius-val-label');
                if (label) label.innerText = `${newR.toFixed(1)} km`;
            }
            saveData();
            renderAllMapVisuals();
        } else {
            alert("请输入有效的数字半径（大于 0）！");
        }
    }
}

function changeTargetColor(id, hexColor, event) {
    if (event) event.stopPropagation();
    const target = targetPoints.find(t => t.id === id);
    if (!target) return;

    target.color = hexColor;
    saveData();
    renderAllMapVisuals();
}

function renderTargetsList() {
    const listDiv = document.getElementById('targets-list');
    listDiv.innerHTML = '';

    targetPoints.forEach(t => {
        const isActive = t.id === activeTargetId;
        const div = document.createElement('div');
        div.className = `target-box ${isActive ? 'active' : ''}`;
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;" onclick="selectTarget(${t.id})">
                <input type="checkbox" ${t.visible ? 'checked' : ''} onclick="toggleTargetVisibility(${t.id}, event)">
                <input type="color" class="color-picker-input" value="${t.color}" onclick="event.stopPropagation()" onchange="changeTargetColor(${t.id}, this.value, event)" title="自定义分组主题颜色">
                <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t.name}">${t.name}</strong> 
                <span class="badge badge-amber" onclick="editTargetRadius(${t.id}, event)" style="cursor:pointer;" title="点击修改该中心独占的覆盖半径">${t.radius} km <i class="fa-solid fa-pen" style="font-size:8px;"></i></span>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="copyTargetAreaPeople(${t.id}, event)" title="复制该覆盖区域内的人员信息">
                    <i class="fa-solid fa-copy"></i>
                </button>
                <button class="btn btn-outline btn-sm" onclick="editTargetName(${t.id}, event)" title="修改中心名称">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteTarget(${t.id}, event)" title="删除中心">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        listDiv.appendChild(div);
    });

    // Show/hide batch toolbar
    const batchBar = document.getElementById('targets-batch-bar');
    if (batchBar) batchBar.style.display = targetPoints.length > 0 ? 'flex' : 'none';
}

function toggleTargetVisibility(id, event) {
    event.stopPropagation();
    const target = targetPoints.find(t => t.id === id);
    if (target) {
        target.visible = !target.visible;
        saveData();
        renderAllMapVisuals();
        if(id === activeTargetId && !target.visible) {
            mapManager.clearActiveCircle();
        } else if (id === activeTargetId && target.visible) {
            selectTarget(id);
        }
    }
}

function selectTarget(id) {
    activeTargetId = id;
    const target = targetPoints.find(t => t.id === id);
    if (target) {
        document.getElementById('search-radius-slider').value = target.radius;
        document.getElementById('radius-val-label').innerText = `${target.radius.toFixed(1)} km`;
        document.getElementById('center-info').innerHTML = `当前选定：【<strong>${target.name}</strong>】`;
        
        renderTargetsList();
        renderAllMapVisuals();
        
        if (target.visible) {
            drawCircle(L.latLng(target.lat, target.lng), target.radius, target.color);
        } else {
            mapManager.clearActiveCircle();
            updateResults(L.latLng(target.lat, target.lng), target.radius);
        }
    }
    saveData();
}

function deleteTarget(id, event) {
    event.stopPropagation();
    if (confirm("确定要删除该目标中心吗？")) {
        targetPoints = targetPoints.filter(t => t.id !== id);
        if (activeTargetId === id) {
            activeTargetId = targetPoints.length > 0 ? targetPoints[0].id : null;
            if (!activeTargetId) mapManager.clearActiveCircle();
        }
        saveData();
        renderAllMapVisuals();
        if (activeTargetId) {
            selectTarget(activeTargetId);
        } else {
            document.getElementById('center-info').innerText = '当前未选定目标中心';
            mapManager.clearRoutesAndSpokes();
            updateResults();
        }
    }
}

// ===================== Batch Operations =====================

function batchSelectAll() {
    targetPoints.forEach(t => t.visible = true);
    saveData();
    renderAllMapVisuals();
}

function batchInvertSelect() {
    targetPoints.forEach(t => t.visible = !t.visible);
    saveData();
    renderAllMapVisuals();
}

// 按人员去重导出：每人仅对应距离最近的1个勾选中心
function batchCopyByNearestTarget() {
    const selected = targetPoints.filter(t => t.visible);
    if (selected.length === 0) {
        alert('请先勾选至少一个覆盖区！');
        return;
    }
    
    let text = `姓名\t人员地址\t目标地址\t所属覆盖区\t距离(公里)\n`;
    let totalCount = 0;
    
    peopleData.forEach(p => {
        let nearestTarget = null;
        let minDist = Infinity;
        
        selected.forEach(target => {
            const distKm = L.latLng(p.lat, p.lng).distanceTo(L.latLng(target.lat, target.lng)) / 1000;
            if (distKm <= target.radius && distKm < minDist) {
                minDist = distKm;
                nearestTarget = target;
            }
        });
        
        if (nearestTarget) {
            const name = cleanFieldForTSV(p.name);
            const addr = cleanFieldForTSV(p.address);
            const targetAddr = cleanFieldForTSV(nearestTarget.address || nearestTarget.name);
            const targetName = cleanFieldForTSV(nearestTarget.name);
            text += `${name}\t${addr}\t${targetAddr}\t${targetName}\t${minDist.toFixed(2)}\n`;
            totalCount++;
        }
    });
    
    if (totalCount === 0) {
        alert('勾选的覆盖区内没有人员数据。');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        alert(`已成功复制 ${totalCount} 名人员数据（已自动去重，每人对应最近中心）！可以直接粘贴到 Excel。`);
    }).catch(() => alert('复制失败，请重试。'));
}

// 按覆盖区明细导出：包含重叠区域人员
function batchCopyAllDetails() {
    const selected = targetPoints.filter(t => t.visible);
    if (selected.length === 0) {
        alert('请先勾选至少一个覆盖区！');
        return;
    }
    
    let text = `姓名\t人员地址\t目标地址\t所属覆盖区\t距离(公里)\n`;
    let totalCount = 0;
    
    selected.forEach(target => {
        const targetAddr = cleanFieldForTSV(target.address || target.name);
        const targetName = cleanFieldForTSV(target.name);
        peopleData.forEach(p => {
            const distKm = L.latLng(p.lat, p.lng).distanceTo(L.latLng(target.lat, target.lng)) / 1000;
            if (distKm <= target.radius) {
                const name = cleanFieldForTSV(p.name);
                const addr = cleanFieldForTSV(p.address);
                text += `${name}\t${addr}\t${targetAddr}\t${targetName}\t${distKm.toFixed(2)}\n`;
                totalCount++;
            }
        });
    });
    
    if (totalCount === 0) {
        alert('勾选的覆盖区内没有人员数据。');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        alert(`已成功复制 ${selected.length} 个覆盖区共 ${totalCount} 条明细数据！可以直接粘贴到 Excel。`);
    }).catch(() => alert('复制失败，请重试。'));
}

function batchDeleteSelected() {
    const selected = targetPoints.filter(t => t.visible);
    if (selected.length === 0) {
        alert('请先勾选要删除的覆盖区！');
        return;
    }
    
    if (!confirm(`确定要删除勾选的 ${selected.length} 个覆盖区吗？`)) return;
    
    const selectedIds = new Set(selected.map(t => t.id));
    targetPoints = targetPoints.filter(t => !selectedIds.has(t.id));
    
    if (selectedIds.has(activeTargetId)) {
        activeTargetId = targetPoints.length > 0 ? targetPoints[0].id : null;
        if (!activeTargetId) {
            mapManager.clearActiveCircle();
            document.getElementById('center-info').innerText = '当前未选定目标中心';
        }
    }
    
    saveData();
    renderAllMapVisuals();
    if (activeTargetId) {
        selectTarget(activeTargetId);
    } else {
        mapManager.clearRoutesAndSpokes();
        updateResults();
    }
}

function updateActiveTargetRadius() {
    const radius = parseFloat(document.getElementById('search-radius-slider').value) || 5;
    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) {
            target.radius = radius;
            saveData();
            renderAllMapVisuals();
            if (target.visible) {
                drawCircle(L.latLng(target.lat, target.lng), radius, target.color);
            }
        }
    } else if (tempLatLng) {
        drawCircle(tempLatLng, radius);
    }
}

function drawCircle(latlng, radiusKm, color = '#3b82f6') {
    mapManager.drawCircle(latlng, radiusKm, color);
    updateResults(latlng, radiusKm, color);
}

let isAlgoPreviewMode = true;
let latestPreviewCenters = [];
let previewDebounceTimer = null;

function switchAlgoUI() {
    const algo = document.getElementById('algo-select').value;
    if (algo === 'greedy_cover') {
        document.getElementById('greedy-param').style.display = 'block';
        document.getElementById('kmeans-param').style.display = 'none';
    } else {
        document.getElementById('greedy-param').style.display = 'none';
        document.getElementById('kmeans-param').style.display = 'block';
    }
    if (isAlgoPreviewMode) {
        triggerAlgoLivePreview();
    }
}

function syncAlgoRadiusInput(val) {
    const num = parseFloat(val) || 5.0;
    const label = document.getElementById('algo-radius-val-label');
    if (label) label.innerText = `${num.toFixed(1)} km`;
    const slider = document.getElementById('algo-radius-slider');
    if (slider) slider.value = num;

    if (isAlgoPreviewMode) {
        triggerAlgoLivePreview();
    }
}

function syncAlgoRadiusSlider(val) {
    const num = parseFloat(val) || 5.0;
    const input = document.getElementById('algo-radius');
    if (input) input.value = num;
    const label = document.getElementById('algo-radius-val-label');
    if (label) label.innerText = `${num.toFixed(1)} km`;

    if (isAlgoPreviewMode) {
        triggerAlgoLivePreview();
    }
}

function syncAlgoKInput(val) {
    const k = parseInt(val) || 3;
    const label = document.getElementById('algo-k-val-label');
    if (label) label.innerText = `${k} 组`;
    const slider = document.getElementById('algo-k-slider');
    if (slider) slider.value = k;

    if (isAlgoPreviewMode) {
        triggerAlgoLivePreview();
    }
}

function syncAlgoKSlider(val) {
    const k = parseInt(val) || 3;
    const input = document.getElementById('algo-k-input');
    if (input) input.value = k;
    const label = document.getElementById('algo-k-val-label');
    if (label) label.innerText = `${k} 组`;

    if (isAlgoPreviewMode) {
        triggerAlgoLivePreview();
    }
}

function toggleAlgoPreviewMode(enabled) {
    isAlgoPreviewMode = enabled;
    const toggleText = document.getElementById('preview-toggle-text');
    const applyBtn = document.getElementById('apply-preview-btn');

    if (enabled) {
        if (toggleText) toggleText.innerText = '已开启';
        if (applyBtn) applyBtn.style.display = 'inline-block';
        triggerAlgoLivePreview();
    } else {
        if (toggleText) toggleText.innerText = '未开启';
        if (applyBtn) applyBtn.style.display = 'none';
        if (mapManager) mapManager.clearPreviewLayer();
    }
}

function triggerAlgoLivePreview() {
    if (previewDebounceTimer) clearTimeout(previewDebounceTimer);

    previewDebounceTimer = setTimeout(() => {
        if (peopleData.length === 0) return;
        const algo = document.getElementById('algo-select').value;
        let computed = [];
        let reportHTML = "";

        if (algo === 'greedy_cover') {
            const radiusKm = parseFloat(document.getElementById('algo-radius').value) || 5;
            computed = runGreedyCoverAlgorithm(peopleData, radiusKm);
            
            const total = peopleData.length;
            let covered = 0;
            computed.forEach(c => covered += c.people.length);
            const rate = ((covered / total) * 100).toFixed(1);
            const isolated = total - covered;

            reportHTML = `
                <h4><i class="fa-solid fa-eye" style="color:var(--accent-amber);"></i> 🔍 实时预览中 (最大覆盖模式)</h4>
                <div class="report-item">• <strong>当前预览半径</strong>：<strong style="color:var(--accent-blue)">${radiusKm} km</strong>。</div>
                <div class="report-item">• <strong>智能匹配中心</strong>：共产生 <strong style="color:var(--accent-emerald)">${computed.length} 个最佳目标中心</strong>。</div>
                <div class="report-item">• <strong>预估有效覆盖</strong>：涵盖 <strong>${covered} 人 (${rate}%)</strong>。</div>
                <div class="report-item">• <strong>离群人员</strong>：有 <strong style="color:var(--accent-rose)">${isolated} 人</strong> 超出半径。</div>
                <div style="font-size:11px; color:var(--accent-amber); margin-top:8px;">滑动上方半径滑块可实时看效果；调整满意后点击下方“确定保存方案”即可生效。</div>
            `;
        } else {
            const k = parseInt(document.getElementById('algo-k-slider').value) || 3;
            if (k <= peopleData.length) {
                computed = runKMeansAlgorithm(peopleData, k);
                reportHTML = `
                    <h4><i class="fa-solid fa-eye" style="color:var(--accent-purple);"></i> 🔍 实时预览中 (K-Means 强行划分)</h4>
                    <div class="report-item">• <strong>当前划分组数</strong>：<strong style="color:var(--accent-purple)">${k} 组</strong>。</div>
                    <div class="report-item">• <strong>聚类中心</strong>：已自动找到 ${k} 个全局几何中心点。</div>
                    <div style="font-size:11px; color:var(--accent-amber); margin-top:8px;">滑动滑块可实时观察核心点变动，满意后点击“确定保存方案”。</div>
                `;
            }
        }

        latestPreviewCenters = computed;
        if (mapManager) mapManager.renderPreviewLayer(computed, peopleData);
        const rBox = document.getElementById('report-box');
        if (rBox) rBox.innerHTML = reportHTML;
    }, 80);
}

function applySmartGroupingPreview() {
    if (!latestPreviewCenters || latestPreviewCenters.length === 0) {
        runSmartGrouping();
        return;
    }

    targetPoints = [];
    latestPreviewCenters.forEach((c, idx) => {
        targetPoints.push({
            id: idx + 1,
            name: c.name,
            lat: c.lat,
            lng: c.lng,
            radius: c.radius,
            color: APP_CONFIG.COLORS[idx % APP_CONFIG.COLORS.length],
            visible: true
        });
    });

    activeTargetId = targetPoints.length > 0 ? targetPoints[0].id : null;
    toggleAlgoPreviewMode(false);
    
    // 取消选中 toggle
    const toggle = document.getElementById('algo-preview-toggle');
    if (toggle) toggle.checked = false;

    saveData();
    renderAllMapVisuals();
    switchTab('analysis-tab');
    if (activeTargetId) {
        selectTarget(activeTargetId);
    }
}

function runSmartGrouping() {
    if (peopleData.length === 0) {
        alert("请先在【人员管理】中导入或加载人员名单数据！");
        return;
    }

    const algo = document.getElementById('algo-select').value;
    const useAnchors = document.getElementById('algo-anchor-toggle')?.checked && targetPoints.length > 0;
    const anchors = useAnchors ? targetPoints.filter(t => t.visible).map(t => ({
        lat: t.lat,
        lng: t.lng,
        radius: t.radius,
        name: t.name,
        color: t.color
    })) : [];

    let computedCenters = []; 
    let reportHTML = "";

    if (algo === 'greedy_cover') {
        const radiusKm = parseFloat(document.getElementById('algo-radius').value) || 5;
        computedCenters = runGreedyCoverAlgorithm(peopleData, radiusKm, anchors);

        const totalPeople = peopleData.length;
        let coveredCount = 0;
        computedCenters.forEach(c => coveredCount += c.people.length);
        const coverRate = ((coveredCount / totalPeople) * 100).toFixed(1);
        const isolatedCount = totalPeople - coveredCount;
        const anchorCount = computedCenters.filter(c => c.isAnchor).length;
        const newCount = computedCenters.length - anchorCount;

        reportHTML = `
            <h4><i class="fa-solid fa-chart-line"></i> 【最大覆盖模式】 AI 智能决策报告</h4>
            <div class="report-item">• <strong>约束条件</strong>：单中心通勤半径 <= ${radiusKm} km。</div>
            ${anchorCount > 0 ? `<div class="report-item">• <strong>固定锚点</strong>：保留 <strong style="color:var(--accent-emerald)">${anchorCount} 个已有中心</strong>不动，算法额外计算了 <strong style="color:var(--accent-blue)">${newCount} 个新中心</strong>。</div>` : ''}
            <div class="report-item">• <strong>计算结果</strong>：自动将 ${totalPeople} 人划分为 <strong style="color:var(--accent-blue)">${computedCenters.length} 个最佳覆盖中心</strong>。</div>
            <div class="report-item">• <strong>有效覆盖率</strong>：涵盖 <strong style="color:var(--accent-emerald)">${coveredCount} 人 (${coverRate}%)</strong>。</div>
            <div class="report-item">• <strong>离群孤立点</strong>：有 <strong style="color:var(--accent-rose)">${isolatedCount} 人</strong> 偏离社区，${radiusKm}km内无合适中心，建议单独线上联络。</div>
            <br>
            <div style="font-weight:700; color:var(--accent-amber);">💡 核心运营建议：</div>
            1. 系统已自动在地图上绘制出这 ${computedCenters.length} 个中心的辐射圈与连线。<br>
            2. 优先在人数最紧密的前 2 个中心配置线下物资与驻点领队。
        `;

    } else {
        const k = parseInt(document.getElementById('algo-k').value) || 3;
        if(k > peopleData.length) {
            alert("设定的分组数 K 不能大于人员总数！");
            return;
        }
        if(useAnchors && anchors.length >= k) {
            alert(`已有 ${anchors.length} 个固定锚点，但分组数仅为 ${k}。请增大分组数（至少 > ${anchors.length}），或关闭锚点开关。`);
            return;
        }
        computedCenters = runKMeansAlgorithm(peopleData, k, anchors);

        let totalDist = 0;
        let maxDist = 0;
        let peopleCount = 0;
        computedCenters.forEach(c => {
            c.people.forEach(p => {
                const d = L.latLng(c.lat, c.lng).distanceTo(L.latLng(p.lat, p.lng)) / 1000;
                totalDist += d;
                if(d > maxDist) maxDist = d;
                peopleCount++;
            });
        });
        const avgDist = (totalDist / peopleCount).toFixed(2);
        const anchorCount = computedCenters.filter(c => c.isAnchor).length;
        const newCount = computedCenters.length - anchorCount;

        reportHTML = `
            <h4><i class="fa-solid fa-diagram-project"></i> 【K-Means 聚类】 AI 强制分组报告</h4>
            <div class="report-item">• <strong>约束条件</strong>：强行无死角划分为 <strong style="color:var(--accent-purple)">${k} 个核心分组</strong>。</div>
            ${anchorCount > 0 ? `<div class="report-item">• <strong>固定锚点</strong>：保留 <strong style="color:var(--accent-emerald)">${anchorCount} 个已有中心</strong>位置与半径不变，算法补充计算了 <strong style="color:var(--accent-blue)">${newCount} 个新中心</strong>。</div>` : ''}
            <div class="report-item">• <strong>计算结果</strong>：成功在全局收敛寻找到 ${k} 个最佳几何坐标重心。</div>
            <div class="report-item">• <strong>平均通勤距离</strong>：组员到重心的平均直线距离为 <strong>${avgDist} km</strong>。</div>
            <div class="report-item">• <strong>最大通勤跨度</strong>：组内最远人员距离达 <strong style="color:var(--accent-rose)">${maxDist.toFixed(2)} km</strong>。</div>
            <br>
            <div style="font-weight:700; color:var(--accent-amber);">💡 核心运营建议：</div>
            1. 强制聚类已实现 100% 全员归档归组。<br>
            2. 对于跨度最远 (${maxDist.toFixed(2)}km) 的边缘成员，请注意提供差旅补助或交通引导。
        `;
    }

    targetPoints = [];
    computedCenters.forEach((c, idx) => {
        targetPoints.push({
            id: idx + 1,
            name: c.name,
            lat: c.lat,
            lng: c.lng,
            radius: c.radius,
            color: c.color || APP_CONFIG.COLORS[idx % APP_CONFIG.COLORS.length],
            visible: true
        });
    });

    activeTargetId = targetPoints.length > 0 ? targetPoints[0].id : null;

    if (isAlgoPreviewMode) {
        toggleAlgoPreviewMode(false);
        const toggle = document.getElementById('algo-preview-toggle');
        if (toggle) toggle.checked = false;
    }

    saveData();
    renderAllMapVisuals();
    document.getElementById('report-box').innerHTML = reportHTML;

    switchTab('analysis-tab');
    if(activeTargetId) {
        selectTarget(activeTargetId);
    }
}

function updateResults(centerLatLng = null, radiusKm = 0, color = '#3b82f6') {
    const listContent = document.getElementById('list-content');
    const copyBtn = document.getElementById('copy-btn');
    const routesBtn = document.getElementById('all-routes-btn');
    
    if (!centerLatLng) {
        document.getElementById('count').innerText = '0';
        listContent.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px 10px;">请先选择或创建一个目标中心</div>';
        copyBtn.style.display = 'none';
        routesBtn.style.display = 'none';
        return;
    }

    const results = [];
    peopleData.forEach(p => {
        const distMeters = centerLatLng.distanceTo(L.latLng(p.lat, p.lng));
        const distKm = distMeters / 1000;
        if (distKm <= radiusKm) {
            results.push({ name: p.name, lat: p.lat, lng: p.lng, address: p.address, distance: distKm });
        }
    });

    results.sort((a, b) => a.distance - b.distance);
    document.getElementById('count').innerText = results.length;

    if (results.length > 0) {
        copyBtn.style.display = 'inline-flex';
        routesBtn.style.display = 'inline-flex';
        let html = '';
        results.forEach((r, idx) => {
            html += `
                <div class="person-match-card">
                    <span class="dist-badge">${r.distance.toFixed(2)} km</span>
                    <div style="font-weight:700; color:var(--text-main);">${idx + 1}. ${r.name}</div>
                    <div style="font-size:11px; color:var(--text-muted); padding-right:60px;">${r.address}</div>
                    <div style="margin-top:4px;">
                        <button class="btn btn-outline btn-sm" onclick="mapManager.fetchSingleRoute(${centerLatLng.lat}, ${centerLatLng.lng}, ${r.lat}, ${r.lng})">
                            <i class="fa-solid fa-car"></i> 真实驾车路线
                        </button>
                    </div>
                </div>
            `;
        });
        listContent.innerHTML = html;
    } else {
        copyBtn.style.display = 'none';
        routesBtn.style.display = 'none';
        listContent.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px 10px;">当前所选圈内暂无匹配人员</div>';
    }

    window.lastResults = results;
}

function updateResultsByActiveTarget() {
    if(activeTargetId) {
        selectTarget(activeTargetId);
    } else if (tempLatLng) {
        setTempTarget(tempLatLng, tempAddressName);
    }
}

// Wrapper export functions for exporter.js
function handleCopySingleCircle() {
    let targetName = "未保存中心";
    let targetAddress = "";
    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) {
            targetName = target.name;
            targetAddress = target.address || '';
        }
    } else if (tempAddressName) {
        targetName = tempAddressName;
        targetAddress = tempAddressName;
    }
    copySingleCircleResults(window.lastResults, targetName, targetAddress);
}

function handleCopyAllOriginalOrder() {
    copyAllTargetsOriginalOrder(peopleData, targetPoints);
}

function handleExportCSV() {
    exportCSVResults(peopleData, targetPoints);
}

/**
 * Copy people within a specific target's coverage area to clipboard
 */
function copyTargetAreaPeople(targetId, event) {
    if (event) event.stopPropagation();
    
    const target = targetPoints.find(t => t.id === targetId);
    if (!target) return;
    
    // Find all people within this target's radius
    const results = [];
    peopleData.forEach(p => {
        const distKm = L.latLng(p.lat, p.lng).distanceTo(L.latLng(target.lat, target.lng)) / 1000;
        if (distKm <= target.radius) {
            results.push({ name: p.name, address: p.address, distance: distKm });
        }
    });
    
    if (results.length === 0) {
        alert(`「${target.name}」覆盖范围内没有人员数据。`);
        return;
    }
    
    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    
    // Build TSV text for clipboard (paste-friendly for Excel)
    const targetAddr = target.address || target.name;
    let text = `覆盖区: ${target.name} (半径: ${target.radius} km, 共 ${results.length} 人)\n`;
    text += `姓名\t人员地址\t目标地址\t距离(公里)\n`;
    results.forEach(r => {
        text += `${r.name}\t${r.address}\t${targetAddr}\t${r.distance.toFixed(2)}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback on the button
        const btns = document.querySelectorAll(`[onclick*="copyTargetAreaPeople(${targetId}"]`);
        btns.forEach(btn => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            btn.style.color = 'var(--accent-emerald)';
            btn.style.borderColor = 'var(--accent-emerald)';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.color = '';
                btn.style.borderColor = '';
            }, 1500);
        });
    }).catch(() => { alert('复制失败，请重试。'); });
}

// 初始化给【手动添加单个人员】输入框绑定粘贴拆分监听
document.addEventListener('DOMContentLoaded', () => {
    const addNameInput = document.getElementById('add-name');
    const addGroupInput = document.getElementById('add-group');
    const addAddrInput = document.getElementById('add-address');

    function handleInputPaste(e) {
        const text = (e.clipboardData || window.clipboardData)?.getData('text');
        if (!text) return;

        if (text.includes('\t') || text.includes('\n')) {
            const lines = text.trim().split(/\r?\n/).filter(Boolean);
            if (lines.length > 1) {
                e.preventDefault();
                if (confirm(`📋 检测到您粘贴了 ${lines.length} 行表格数据！\n是否直接导入这 ${lines.length} 名人员？`)) {
                    importFromRawText(text);
                }
                return;
            }

            const row = lines[0].split('\t').map(c => c.trim()).filter(Boolean);
            if (row.length >= 2) {
                e.preventDefault();
                if (row.length >= 3) {
                    if (addGroupInput) addGroupInput.value = row[0];
                    if (addNameInput) addNameInput.value = row[1];
                    if (addAddrInput) addAddrInput.value = row[2];
                } else {
                    if (addNameInput) addNameInput.value = row[0];
                    if (addAddrInput) addAddrInput.value = row[1];
                }
                const status = document.getElementById('add-status');
                if (status) status.innerText = `📋 已自动智能拆分填入框内，点击“添加”即可发布！`;
            }
        }
    }

    if (addNameInput) addNameInput.addEventListener('paste', handleInputPaste);
    if (addAddrInput) addAddrInput.addEventListener('paste', handleInputPaste);
    if (addGroupInput) addGroupInput.addEventListener('paste', handleInputPaste);
});
