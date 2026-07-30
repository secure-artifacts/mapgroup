/**
 * Main Application Bootstrap & Event Handlers
 */
let mapManager = null;
let peopleData = [];
let targetPoints = [];
let activeTargetId = null;
let tempLatLng = null;
let tempAddressName = "";

window.onload = function() {
    mapManager = new MapManager('map-container');
    mapManager.init(APP_CONFIG.DEFAULT_CENTER, APP_CONFIG.DEFAULT_ZOOM, handleMapClick, handleMapMouseMove);

    loadSavedData();
    updateGlobalStats();
};

function handleMapClick(e) {
    if (mapManager.isProbeMode) {
        setTempTarget(e.latlng, "探针锁定坐标点");
        toggleProbeMode(); 
    } else {
        setTempTarget(e.latlng, "地图点击位置");
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

function loadSavedData() {
    const savedPeople = localStorage.getItem('global_map_people');
    const savedTargets = localStorage.getItem('global_map_targets');
    const savedActiveId = localStorage.getItem('global_map_active_id');

    if (savedPeople) {
        peopleData = JSON.parse(savedPeople);
        mapManager.renderPeopleMarkers(peopleData);
        renderRosterList();
    }
    if (savedTargets) {
        targetPoints = JSON.parse(savedTargets);
        targetPoints.forEach(t => { if(t.visible === undefined) t.visible = true; });
        renderTargetsList();
        mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
    }
    if (savedActiveId) {
        activeTargetId = parseInt(savedActiveId);
        selectTarget(activeTargetId);
    }
}

function saveData() {
    localStorage.setItem('global_map_people', JSON.stringify(peopleData));
    localStorage.setItem('global_map_targets', JSON.stringify(targetPoints));
    localStorage.setItem('global_map_active_id', activeTargetId);
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
    saveData();
    mapManager.renderPeopleMarkers(peopleData);
    renderRosterList();
    mapManager.fitBoundsToPeople(peopleData);
    alert("已成功加载 11 名示范人员数据！您现在可以尝试点击【智能分组】体验自动算法选址。");
}

function clearAllPeople() {
    if(confirm("确定要清空所有已导入的人员数据吗？")) {
        peopleData = [];
        saveData();
        mapManager.renderPeopleMarkers(peopleData);
        renderRosterList();
        updateResults();
        document.getElementById('csv-file-input').value = '';
        document.getElementById('csv-status').innerText = '';
    }
}

async function addSinglePerson() {
    const name = document.getElementById('add-name').value.trim();
    const address = document.getElementById('add-address').value.trim();
    const status = document.getElementById('add-status');

    if (!name || !address) {
        alert("请输入完整的姓名和地址/坐标！");
        return;
    }
    status.innerText = "🔍 智能定位中...";

    const coords = await freeGeocode(address);
    if(coords) {
        peopleData.push({ name, lat: coords.lat, lng: coords.lng, address });
        saveData();
        mapManager.renderPeopleMarkers(peopleData);
        renderRosterList();
        status.innerText = `✅ 成功添加人员: ${name}`;
        document.getElementById('add-name').value = '';
        document.getElementById('add-address').value = '';
        updateResultsByActiveTarget();
    } else {
        status.innerText = "❌ 检索未果，请尝试更详细的地址或输入 Lat,Lng 坐标。";
    }
}

function deletePerson(idx) {
    peopleData.splice(idx, 1);
    saveData();
    mapManager.renderPeopleMarkers(peopleData);
    renderRosterList();
    updateResultsByActiveTarget();
}

function renderRosterList(filterText = '') {
    const listDiv = document.getElementById('roster-list');
    listDiv.innerHTML = '';
    document.getElementById('roster-count').innerText = peopleData.length;

    peopleData.forEach((p, idx) => {
        if(filterText && !p.name.toLowerCase().includes(filterText.toLowerCase()) && !p.address.toLowerCase().includes(filterText.toLowerCase())) {
            return;
        }
        const div = document.createElement('div');
        div.className = 'person-item';
        div.innerHTML = `
            <div class="person-info">
                <div class="person-name"><i class="fa-solid fa-user-tag" style="color:var(--accent-blue)"></i> ${p.name}</div>
                <div class="person-addr">${p.address}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deletePerson(${idx})">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        listDiv.appendChild(div);
    });
}

function filterRoster() {
    const q = document.getElementById('roster-search').value;
    renderRosterList(q);
}

// CSV Event listener
document.getElementById('csv-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async function(results) {
            const rows = results.data;
            const tempPeople = [];
            const statusDiv = document.getElementById('csv-status');
            const progressWrap = document.getElementById('csv-progress-wrap');
            const progressFill = document.getElementById('csv-progress-fill');
            
            progressWrap.style.display = 'block';
            statusDiv.innerText = "正在解析并同步地理位置...";

            for (let i = 0; i < rows.length; i++) {
                progressFill.style.width = `${((i + 1) / rows.length) * 100}%`;
                if (i === 0 && (rows[i][0].includes("姓") || rows[i][0].toLowerCase().includes("name"))) {
                    continue;
                }
                const name = rows[i][0];
                const colB = rows[i][1];
                const colC = rows[i][2];

                if (!name || !colB) continue;

                const lat = parseFloat(colB);
                const lng = parseFloat(colC);

                if (!isNaN(lat) && !isNaN(lng)) {
                    tempPeople.push({ name, lat, lng, address: rows[i][3] || "GPS Location" });
                } else {
                    statusDiv.innerText = `解析中: (${i + 1}/${rows.length}) ${name}...`;
                    const coords = await freeGeocode(colB);
                    if (coords) {
                        tempPeople.push({ name, lat: coords.lat, lng: coords.lng, address: colB });
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            peopleData = peopleData.concat(tempPeople);
            saveData();
            mapManager.renderPeopleMarkers(peopleData);
            renderRosterList();
            statusDiv.innerText = `🎉 成功解析并导入 ${tempPeople.length} 名人员数据！`;
            mapManager.fitBoundsToPeople(peopleData);
            updateResultsByActiveTarget();
        }
    });
});

// 探针雷达开关
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

function setTempTarget(latlng, name = "定位位置") {
    tempLatLng = latlng;
    tempAddressName = name;
    document.getElementById('center-info').innerHTML = `📍 临时选定 (未保存): <br><strong>${name}</strong>`;
    mapManager.clearRoutesAndSpokes();
    drawCircle(latlng, parseFloat(document.getElementById('search-radius-slider').value) || 5);
}

function onRadiusSliderInput(val) {
    document.getElementById('radius-val-label').innerText = `${parseFloat(val).toFixed(1)} km`;
    updateActiveTargetRadius();
}

function saveCurrentAsTarget() {
    if (!tempLatLng) {
        alert("请先在地图上点击或搜索选择目标位置！");
        return;
    }
    const name = prompt("请为此选址中心命名：", tempAddressName);
    if (!name) return;

    const radius = parseFloat(document.getElementById('search-radius-slider').value) || 5;
    const color = APP_CONFIG.COLORS[targetPoints.length % APP_CONFIG.COLORS.length];

    const newTarget = {
        id: Date.now(),
        name: name,
        lat: tempLatLng.lat,
        lng: tempLatLng.lng,
        radius: radius,
        color: color,
        visible: true
    };

    targetPoints.push(newTarget);
    activeTargetId = newTarget.id;
    saveData();
    renderTargetsList();
    mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
    selectTarget(newTarget.id);
}

function renderTargetsList() {
    const listDiv = document.getElementById('targets-list');
    listDiv.innerHTML = '';

    mapManager.renderTargetMarkers(targetPoints, selectTarget);

    targetPoints.forEach(t => {
        const isActive = t.id === activeTargetId;
        const div = document.createElement('div');
        div.className = `target-box ${isActive ? 'active' : ''}`;
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; flex:1;" onclick="selectTarget(${t.id})">
                <input type="checkbox" ${t.visible ? 'checked' : ''} onclick="toggleTargetVisibility(${t.id}, event)">
                <span class="target-dot" style="background-color:${t.color}"></span>
                <strong>${t.name}</strong> 
                <span class="badge badge-amber">${t.radius} km</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteTarget(${t.id}, event)">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        listDiv.appendChild(div);
    });
}

function toggleTargetVisibility(id, event) {
    event.stopPropagation();
    const target = targetPoints.find(t => t.id === id);
    if (target) {
        target.visible = !target.visible;
        saveData();
        mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
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
        mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
        mapManager.clearRoutesAndSpokes();
        
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
        renderTargetsList();
        mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
        if (activeTargetId) {
            selectTarget(activeTargetId);
        } else {
            document.getElementById('center-info').innerText = '当前未选定目标中心';
            mapManager.clearRoutesAndSpokes();
            updateResults();
        }
    }
}

function updateActiveTargetRadius() {
    const radius = parseFloat(document.getElementById('search-radius-slider').value) || 5;
    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) {
            target.radius = radius;
            saveData();
            renderTargetsList();
            mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
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

function switchAlgoUI() {
    const algo = document.getElementById('algo-select').value;
    if (algo === 'greedy_cover') {
        document.getElementById('greedy-param').style.display = 'block';
        document.getElementById('kmeans-param').style.display = 'none';
    } else {
        document.getElementById('greedy-param').style.display = 'none';
        document.getElementById('kmeans-param').style.display = 'block';
    }
}

function runSmartGrouping() {
    if (peopleData.length === 0) {
        alert("请先在【人员管理】中导入或加载人员名单数据！");
        return;
    }

    const algo = document.getElementById('algo-select').value;
    let computedCenters = []; 
    let reportHTML = "";

    if (algo === 'greedy_cover') {
        const radiusKm = parseFloat(document.getElementById('algo-radius').value) || 5;
        computedCenters = runGreedyCoverAlgorithm(peopleData, radiusKm);

        const totalPeople = peopleData.length;
        let coveredCount = 0;
        computedCenters.forEach(c => coveredCount += c.people.length);
        const coverRate = ((coveredCount / totalPeople) * 100).toFixed(1);
        const isolatedCount = totalPeople - coveredCount;

        reportHTML = `
            <h4><i class="fa-solid fa-chart-line"></i> 【最大覆盖模式】 AI 智能决策报告</h4>
            <div class="report-item">• <strong>约束条件</strong>：单中心通勤半径 <= ${radiusKm} km。</div>
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
        computedCenters = runKMeansAlgorithm(peopleData, k);

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

        reportHTML = `
            <h4><i class="fa-solid fa-diagram-project"></i> 【K-Means 聚类】 AI 强制分组报告</h4>
            <div class="report-item">• <strong>约束条件</strong>：强行无死角划分为 <strong style="color:var(--accent-purple)">${k} 个核心分组</strong>。</div>
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
            color: APP_CONFIG.COLORS[idx % APP_CONFIG.COLORS.length],
            visible: true
        });
    });

    activeTargetId = targetPoints.length > 0 ? targetPoints[0].id : null;
    saveData();
    renderTargetsList();
    mapManager.renderAllTargetCircles(targetPoints, activeTargetId);
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
    
    mapManager.clearRoutesAndSpokes(); 

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
        mapManager.drawSpokeLines(centerLatLng, results, color);
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
    if (activeTargetId) {
        const target = targetPoints.find(t => t.id === activeTargetId);
        if (target) targetName = target.name;
    } else if (tempAddressName) {
        targetName = tempAddressName;
    }
    copySingleCircleResults(window.lastResults, targetName);
}

function handleCopyAllOriginalOrder() {
    copyAllTargetsOriginalOrder(peopleData, targetPoints);
}

function handleExportCSV() {
    exportCSVResults(peopleData, targetPoints);
}
