/**
 * Location-Allocation & Clustering Algorithms
 * 支持固定锚点模式：已有中心作为不可移动的锚点，算法只补充计算新中心
 */

// 核心算法 1：贪心最大半径覆盖算法 (Greedy Radius Cover)
// anchors: 可选，已保存的固定锚点数组 [{ lat, lng, radius, name, color }]
function runGreedyCoverAlgorithm(peopleData, radiusKm, anchors = []) {
    let uncovered = [...peopleData];
    let centers = [];
    let groupIndex = 1;

    // 第一步：将固定锚点的覆盖人员先行分配
    anchors.forEach(anchor => {
        let coveredByAnchor = [];
        uncovered.forEach(p => {
            const dist = L.latLng(p.lat, p.lng).distanceTo(L.latLng(anchor.lat, anchor.lng)) / 1000;
            if (dist <= anchor.radius) {
                coveredByAnchor.push(p);
            }
        });

        centers.push({
            name: anchor.name || `${groupIndex}号区域`,
            lat: anchor.lat,
            lng: anchor.lng,
            radius: anchor.radius, // 保留锚点原有半径
            people: coveredByAnchor,
            isAnchor: true,
            color: anchor.color
        });

        const coveredNames = new Set(coveredByAnchor.map(p => p.name));
        uncovered = uncovered.filter(p => !coveredNames.has(p.name));
        groupIndex++;
    });

    // 第二步：对剩余未覆盖人员执行贪心覆盖
    while (uncovered.length > 0) {
        let bestPerson = null;
        let bestCoveredPeople = [];

        uncovered.forEach(p => {
            let covered = [];
            uncovered.forEach(other => {
                const dist = L.latLng(p.lat, p.lng).distanceTo(L.latLng(other.lat, other.lng)) / 1000;
                if (dist <= radiusKm) {
                    covered.push(other);
                }
            });

            if (covered.length > bestCoveredPeople.length) {
                bestCoveredPeople = covered;
                bestPerson = p;
            }
        });

        if (bestCoveredPeople.length <= 1) {
            break; 
        }

        centers.push({
            name: `${groupIndex}号区域`,
            lat: bestPerson.lat,
            lng: bestPerson.lng,
            radius: radiusKm,
            people: bestCoveredPeople
        });

        const coveredNames = new Set(bestCoveredPeople.map(p => p.name));
        uncovered = uncovered.filter(p => !coveredNames.has(p.name));
        groupIndex++;
    }

    return centers;
}

// 核心算法 2：K-Means 聚类算法 (支持固定锚点种子)
// anchors: 可选，已保存的固定锚点数组 [{ lat, lng, radius, name, color }]
function runKMeansAlgorithm(peopleData, k, anchors = []) {
    const anchorCount = anchors.length;
    const newCenterCount = Math.max(0, k - anchorCount);

    let centroids = [];
    let isFixed = []; // 标记哪些质心是固定锚点，迭代时不更新

    // 第一步：将锚点作为前 N 个固定质心
    anchors.forEach(anchor => {
        centroids.push({ lat: anchor.lat, lng: anchor.lng });
        isFixed.push(true);
    });

    // 第二步：从人员中随机选取剩余 K-N 个初始质心
    let tempPeople = [...peopleData];
    for (let i = 0; i < newCenterCount; i++) {
        if (tempPeople.length === 0) break;
        const randIdx = Math.floor(Math.random() * tempPeople.length);
        const p = tempPeople.splice(randIdx, 1)[0];
        centroids.push({ lat: p.lat, lng: p.lng });
        isFixed.push(false);
    }

    const actualK = centroids.length;
    let clusters = [];
    let iterations = 0;
    let converged = false;

    while (!converged && iterations < 100) {
        iterations++;
        clusters = Array.from({ length: actualK }, (_, idx) => ({
            lat: centroids[idx].lat,
            lng: centroids[idx].lng,
            people: []
        }));

        // 归属分配：每个人分配到最近的质心
        peopleData.forEach(p => {
            let minDist = Infinity;
            let bestIdx = 0;
            centroids.forEach((c, idx) => {
                const d = L.latLng(p.lat, p.lng).distanceTo(L.latLng(c.lat, c.lng));
                if (d < minDist) {
                    minDist = d;
                    bestIdx = idx;
                }
            });
            clusters[bestIdx].people.push(p);
        });

        // 重心更新：只更新非固定锚点的质心
        let newCentroids = [];
        converged = true;

        for (let idx = 0; idx < actualK; idx++) {
            if (isFixed[idx]) {
                // 固定锚点：质心位置永不改变
                newCentroids.push({ lat: centroids[idx].lat, lng: centroids[idx].lng });
                continue;
            }

            const c = clusters[idx];
            if (c.people.length === 0) {
                const p = peopleData[Math.floor(Math.random() * peopleData.length)];
                newCentroids.push({ lat: p.lat, lng: p.lng });
                converged = false;
                continue;
            }

            let sumLat = 0, sumLng = 0;
            c.people.forEach(p => {
                sumLat += p.lat;
                sumLng += p.lng;
            });
            const avgLat = sumLat / c.people.length;
            const avgLng = sumLng / c.people.length;

            if (Math.abs(avgLat - centroids[idx].lat) > 0.0001 || Math.abs(avgLng - centroids[idx].lng) > 0.0001) {
                converged = false;
            }
            newCentroids.push({ lat: avgLat, lng: avgLng });
        }

        centroids = newCentroids;
    }

    return clusters.map((c, idx) => {
        // 固定锚点保留原有半径，新中心使用算法计算的半径
        if (isFixed[idx] && anchors[idx]) {
            return {
                name: anchors[idx].name || `${idx + 1}号区域`,
                lat: c.lat,
                lng: c.lng,
                radius: anchors[idx].radius,
                people: c.people,
                isAnchor: true,
                color: anchors[idx].color
            };
        }

        let maxR = 0.5;
        c.people.forEach(p => {
            const d = L.latLng(c.lat, c.lng).distanceTo(L.latLng(p.lat, p.lng)) / 1000;
            if(d > maxR) maxR = d;
        });

        return {
            name: `${idx + 1}号区域`,
            lat: c.lat,
            lng: c.lng,
            radius: parseFloat(maxR.toFixed(1)),
            people: c.people
        };
    });
}
