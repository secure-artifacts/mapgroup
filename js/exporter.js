/**
 * 字段级 TSV/CSV 格式净化器 (规范化内包换行与 Tab，防止粘贴到 Google Sheets / Excel 时分栏打乱或产生非法拆行)
 */
function cleanFieldForTSV(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // 替换所有内部回车换行符为单个空格，防止破坏表格行
    str = str.replace(/[\r\n]+/g, ' ');
    // 如果包含 Tab，替换为标准空格
    str = str.replace(/\t/g, ' ');
    return str;
}

// 复制单圈匹配人员名单
function copySingleCircleResults(results, targetName, targetAddress) {
    if (!results || results.length === 0) return;

    const targetAddr = targetAddress || targetName;
    let text = `姓名\t人员地址\t目标地址\t匹配目标中心\t距离(公里)\n`;
    results.forEach(r => {
        const name = cleanFieldForTSV(r.name);
        const addr = cleanFieldForTSV(r.address);
        const tAddr = cleanFieldForTSV(targetAddr);
        const tName = cleanFieldForTSV(targetName);
        text += `${name}\t${addr}\t${tAddr}\t${tName}\t${r.distance.toFixed(2)}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('单圈人员名单已成功复制到剪贴板！可以直接粘贴到 Excel。');
    }).catch(() => { alert('复制失败，请重试。'); });
}

// 复制全员匹配结果 (保持原表顺序)
function copyAllTargetsOriginalOrder(peopleData, targetPoints) {
    if (peopleData.length === 0) {
        alert("请先导入人员名单！");
        return;
    }
    if (targetPoints.length === 0) {
        alert("请至少建立一个目标选址中心！");
        return;
    }

    let text = "姓名\t人员地址\t目标地址\t匹配最近中心\t距离(公里)\n";

    peopleData.forEach(p => {
        let matchedTarget = null;
        let minDistance = Infinity;

        targetPoints.forEach(t => {
            if(!t.visible) return;
            const distMeters = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng));
            const distKm = distMeters / 1000;

            if (distKm <= t.radius) {
                if (distKm < minDistance) {
                    minDistance = distKm;
                    matchedTarget = t;
                }
            }
        });

        const name = cleanFieldForTSV(p.name);
        const addr = cleanFieldForTSV(p.address);

        if (matchedTarget) {
            const targetAddr = cleanFieldForTSV(matchedTarget.address || matchedTarget.name);
            const tName = cleanFieldForTSV(matchedTarget.name);
            text += `${name}\t${addr}\t${targetAddr}\t${tName}\t${minDistance.toFixed(2)}\n`;
        } else {
            text += `${name}\t${addr}\t-\t不在覆盖范围内\t-\n`;
        }
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('全员匹配结果已按原名单顺序复制！可以直接在 Excel 表中按 Ctrl+V 完整对齐粘贴。');
    }).catch(() => { alert('复制失败。'); });
}

// 导出匹配结果为 CSV 文件
function exportCSVResults(peopleData, targetPoints) {
    if (peopleData.length === 0) {
        alert("目前没有人员数据可导出。");
        return;
    }
    
    let rows = [["姓名", "人员地址", "纬度", "经度", "目标地址", "归属组/选址中心", "距离(km)"]];
    
    peopleData.forEach(p => {
        let matchedTarget = null;
        let minDistance = Infinity;

        targetPoints.forEach(t => {
            if(!t.visible) return;
            const distMeters = L.latLng(p.lat, p.lng).distanceTo(L.latLng(t.lat, t.lng));
            const distKm = distMeters / 1000;

            if (distKm <= t.radius && distKm < minDistance) {
                minDistance = distKm;
                matchedTarget = t;
            }
        });

        if (matchedTarget) {
            const targetAddr = matchedTarget.address || matchedTarget.name;
            rows.push([p.name, p.address, p.lat, p.lng, targetAddr, matchedTarget.name, minDistance.toFixed(2)]);
        } else {
            rows.push([p.name, p.address, p.lat, p.lng, "-", "未覆盖孤立点", "-"]);
        }
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `智能选址分组决策结果_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
