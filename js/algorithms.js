/**
 * Location-Allocation & Clustering Algorithms
 */

// 核心算法 1：贪心最大半径覆盖算法 (Greedy Radius Cover)
function runGreedyCoverAlgorithm(peopleData, radiusKm) {
    let uncovered = [...peopleData];
    let centers = [];
    let groupIndex = 1;

    while (uncovered.length > 0) {
        let bestPerson = null;
        let bestCoveredPeople = [];

        // 评估每一个未覆盖人所在经纬度作为潜在中心
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

        // 孤立点判定：无法覆盖超过 1 人时退出循环
        if (bestCoveredPeople.length <= 1) {
            break; 
        }

        centers.push({
            name: `覆盖区-${groupIndex}号中心`,
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

// 核心算法 2：K-Means 聚类算法
function runKMeansAlgorithm(peopleData, k) {
    let centroids = [];
    let tempPeople = [...peopleData];
    
    for (let i = 0; i < k; i++) {
        const randIdx = Math.floor(Math.random() * tempPeople.length);
        const p = tempPeople.splice(randIdx, 1)[0];
        centroids.push({ lat: p.lat, lng: p.lng });
    }

    let clusters = [];
    let iterations = 0;
    let converged = false;

    while (!converged && iterations < 100) {
        iterations++;
        clusters = Array.from({ length: k }, (_, idx) => ({
            lat: centroids[idx].lat,
            lng: centroids[idx].lng,
            people: []
        }));

        // 归属分配
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

        // 重心更新
        let newCentroids = [];
        converged = true;

        for (let idx = 0; idx < k; idx++) {
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
        let maxR = 0.5;
        c.people.forEach(p => {
            const d = L.latLng(c.lat, c.lng).distanceTo(L.latLng(p.lat, p.lng)) / 1000;
            if(d > maxR) maxR = d;
        });

        return {
            name: `分组-${idx + 1} 重心`,
            lat: c.lat,
            lng: c.lng,
            radius: parseFloat(maxR.toFixed(1)),
            people: c.people
        };
    });
}
