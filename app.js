/**
 * Project Management Flight Simulator - Frontend Controller (app.js)
 * 協同 engine.js 與 Chart.js 處理即時互動、圖表渲染、情境切換與 Google 試算表同步
 */

document.addEventListener("DOMContentLoaded", function () {
  // 1. 初始化系統動力學模擬引擎
  const engine = new ProjectManagementEngine({
    totalWeeks: 50,
    initialScope: 1000,
    targetCompletionWeek: 40,
    initialBudget: 2500000
  });

  // 2. DOM 元素快取
  const dom = {
    // 頂部狀態列
    currentWeekBadge: document.getElementById("currentWeekBadge"),
    projectStatusBadge: document.getElementById("projectStatusBadge"),
    resetBtn: document.getElementById("resetBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    openSubmitModalBtn: document.getElementById("openSubmitModalBtn"),
    openCausalModalBtn: document.getElementById("openCausalModalBtn"),

    // KPI 卡片
    kpiScheduleVariance: document.getElementById("kpiScheduleVariance"),
    kpiCostVariance: document.getElementById("kpiCostVariance"),
    kpiTasksRemaining: document.getElementById("kpiTasksRemaining"),
    kpiUndiscoveredRework: document.getElementById("kpiUndiscoveredRework"),
    kpiMoraleFatigue: document.getElementById("kpiMoraleFatigue"),
    kpiProgressBar: document.getElementById("kpiProgressBar"),
    kpiProgressText: document.getElementById("kpiProgressText"),

    // 控制面板 (Sliders & Switches)
    sliderHeadcount: document.getElementById("sliderHeadcount"),
    valHeadcount: document.getElementById("valHeadcount"),
    sliderWorkHours: document.getElementById("sliderWorkHours"),
    valWorkHours: document.getElementById("valWorkHours"),
    sliderQaIntensity: document.getElementById("sliderQaIntensity"),
    valQaIntensity: document.getElementById("valQaIntensity"),
    checkScopeAcceptance: document.getElementById("checkScopeAcceptance"),
    scopeNoticeBox: document.getElementById("scopeNoticeBox"),
    stepOneWeekBtn: document.getElementById("stepOneWeekBtn"),
    stepFourWeeksBtn: document.getElementById("stepFourWeeksBtn"),

    // 決策情境按鈕 (Presets)
    presetBalanced: document.getElementById("presetBalanced"),
    presetCrunch: document.getElementById("presetCrunch"),
    presetQuality: document.getElementById("presetQuality"),
    presetBrooks: document.getElementById("presetBrooks"),

    // 歷史營運記錄表格
    logTableBody: document.getElementById("logTableBody"),

    // 模態視窗與通知
    causalModal: document.getElementById("causalModal"),
    closeCausalModalBtn: document.getElementById("closeCausalModalBtn"),
    submitModal: document.getElementById("submitModal"),
    closeSubmitModalBtn: document.getElementById("closeSubmitModalBtn"),
    cancelSubmitBtn: document.getElementById("cancelSubmitBtn"),
    submitForm: document.getElementById("submitForm"),
    submitBtn: document.getElementById("submitBtn"),
    submitStatusMsg: document.getElementById("submitStatusMsg"),

    // 輸入欄位 (送出試算表)
    inputGasUrl: document.getElementById("inputGasUrl"),
    inputClassName: document.getElementById("inputClassName"),
    inputStudentId: document.getElementById("inputStudentId"),
    inputStudentName: document.getElementById("inputStudentName"),
    inputReportUrl: document.getElementById("inputReportUrl")
  };

  // 從 LocalStorage 載入上次填寫的 Google Webhook URL
  const savedGasUrl = localStorage.getItem("pm_sim_gas_url");
  if (savedGasUrl && dom.inputGasUrl) {
    dom.inputGasUrl.value = savedGasUrl;
  }

  // 3. Chart.js 實例管理
  let chartProgress = null;
  let chartWorkforce = null;
  let chartCost = null;
  let chartQuality = null;

  function initCharts() {
    const ctxProgress = document.getElementById("chartProgress").getContext("2d");
    const ctxWorkforce = document.getElementById("chartWorkforce").getContext("2d");
    const ctxCost = document.getElementById("chartCost").getContext("2d");
    const ctxQuality = document.getElementById("chartQuality").getContext("2d");

    // 圖表 1: 工作進度與返工循環 (Done vs Undiscovered Rework vs Remaining)
    chartProgress = new Chart(ctxProgress, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "尚待完成 (Pending Tasks)",
            data: [1000],
            borderColor: "#64748b", // slate-500
            backgroundColor: "rgba(100, 116, 139, 0.1)",
            fill: true,
            tension: 0.2
          },
          {
            label: "表觀完成 (Apparent Done)",
            data: [0],
            borderColor: "#3b82f6", // blue-500
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.2
          },
          {
            label: "未發現返工 (潛在缺陷)",
            data: [0],
            borderColor: "#ef4444", // red-500
            borderDash: [5, 5],
            fill: false,
            tension: 0.2
          },
          {
            label: "真正合格無瑕疵 (Truly Done)",
            data: [0],
            borderColor: "#10b981", // emerald-500
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "任務點數 (Tasks)" }, min: 0 }
        }
      }
    });

    // 圖表 2: 人力資源配置與加班工時 (Staffing & Overtime)
    chartWorkforce = new Chart(ctxWorkforce, {
      type: "bar",
      data: {
        labels: [1],
        datasets: [
          {
            type: "bar",
            label: "資深工程師",
            data: [18],
            backgroundColor: "#3b82f6",
            stack: "staff"
          },
          {
            type: "bar",
            label: "新人工程師 (需帶領)",
            data: [4],
            backgroundColor: "#93c5fd",
            stack: "staff"
          },
          {
            type: "line",
            label: "每週排定工時 (h)",
            data: [40],
            borderColor: "#f59e0b",
            borderWidth: 2,
            yAxisID: "yHours"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "工程師人數" }, min: 0, max: 45 },
          yHours: {
            position: "right",
            title: { display: true, text: "工時 (小時/週)" },
            min: 30,
            max: 70,
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // 圖表 3: 累計成本 vs. 預算上限 (Cost Trajectory)
    chartCost = new Chart(ctxCost, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "累計實際成本 ($k)",
            data: [0],
            borderColor: "#8b5cf6", // purple-500
            backgroundColor: "rgba(139, 92, 246, 0.15)",
            fill: true,
            tension: 0.1
          },
          {
            label: "預算上限 ($2,500k)",
            data: [2500],
            borderColor: "#dc2626", // red-600
            borderDash: [6, 4],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: $${context.raw.toLocaleString()} k`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "成本金額 ($k USD)" }, min: 0 }
        }
      }
    });

    // 圖表 4: 疲勞指數、錯誤產生率與品質水準
    chartQuality = new Chart(ctxQuality, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "錯誤產生率 (%)",
            data: [12],
            borderColor: "#ef4444",
            fill: false,
            tension: 0.2
          },
          {
            label: "團隊士氣指數 (Morale)",
            data: [100],
            borderColor: "#10b981",
            fill: false,
            tension: 0.2
          },
          {
            label: "疲勞乘數 (Fatigue x100)",
            data: [100],
            borderColor: "#f59e0b",
            borderDash: [4, 4],
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "指數 / 百分比" }, min: 0, max: 130 }
        }
      }
    });
  }

  // 4. 更新圖表數據
  function updateCharts(history) {
    const labels = history.map(h => `W${h.week}`);
    
    // 更新 Progress
    chartProgress.data.labels = labels;
    chartProgress.data.datasets[0].data = history.map(h => h.tasksRemaining);
    chartProgress.data.datasets[1].data = history.map(h => h.tasksDoneApparent);
    chartProgress.data.datasets[2].data = history.map(h => h.undiscoveredRework);
    chartProgress.data.datasets[3].data = history.map(h => h.tasksTrulyDone);
    chartProgress.update();

    // 更新 Workforce
    chartWorkforce.data.labels = labels;
    chartWorkforce.data.datasets[0].data = history.map(h => h.experiencedStaff);
    chartWorkforce.data.datasets[1].data = history.map(h => h.rookieStaff);
    chartWorkforce.data.datasets[2].data = history.map(h => h.scheduledWorkHours);
    chartWorkforce.update();

    // 更新 Cost
    chartCost.data.labels = labels;
    chartCost.data.datasets[0].data = history.map(h => Math.round(h.cumulativeCost / 1000));
    chartCost.data.datasets[1].data = history.map(() => 2500);
    chartCost.update();

    // 更新 Quality
    chartQuality.data.labels = labels;
    chartQuality.data.datasets[0].data = history.map(h => h.errorGenerationRate);
    chartQuality.data.datasets[1].data = history.map(h => h.moraleIndex);
    chartQuality.data.datasets[2].data = history.map(h => Math.round(h.fatigueIndex * 100));
    chartQuality.update();
  }

  // 5. 更新 UI 儀表板
  function updateUI() {
    const state = engine.getCurrentStatus();

    // 狀態標籤
    dom.currentWeekBadge.textContent = `第 ${state.currentWeek} / ${state.totalWeeks} 週`;
    if (state.gameOver) {
      dom.projectStatusBadge.textContent = state.isCompleted ? "專案已交付結案" : "強制終止 (逾期)";
      dom.projectStatusBadge.className = state.isCompleted 
        ? "px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"
        : "px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800";
      dom.stepOneWeekBtn.disabled = true;
      dom.stepFourWeeksBtn.disabled = true;
    } else {
      dom.projectStatusBadge.textContent = "進行中 (In Progress)";
      dom.projectStatusBadge.className = "px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800";
      dom.stepOneWeekBtn.disabled = false;
      dom.stepFourWeeksBtn.disabled = false;
    }

    // KPI: 時程差異 (預計完工週 vs 當前進度估算)
    const weeksRemaining = state.targetCompletionWeek - state.currentWeek;
    if (state.isCompleted) {
      const diff = state.targetCompletionWeek - state.currentWeek;
      dom.kpiScheduleVariance.textContent = diff >= 0 ? `提前 ${diff} 週如期完工` : `延遲 ${Math.abs(diff)} 週完工`;
      dom.kpiScheduleVariance.className = diff >= 0 ? "text-xl font-bold text-emerald-600" : "text-xl font-bold text-rose-600";
    } else {
      dom.kpiScheduleVariance.textContent = `距離目標交付尚餘 ${weeksRemaining} 週`;
      dom.kpiScheduleVariance.className = weeksRemaining < 5 ? "text-xl font-bold text-amber-600" : "text-xl font-bold text-slate-800";
    }

    // KPI: 成本差異 (預算結餘)
    const costVarianceK = Math.round(state.costVariance / 1000);
    dom.kpiCostVariance.textContent = costVarianceK >= 0 ? `+$${costVarianceK.toLocaleString()} k` : `-$${Math.abs(costVarianceK).toLocaleString()} k`;
    dom.kpiCostVariance.className = costVarianceK >= 0 ? "text-xl font-bold text-emerald-600" : "text-xl font-bold text-rose-600";

    // KPI: 剩餘任務與未發現返工
    dom.kpiTasksRemaining.textContent = `${state.tasksRemaining} / ${state.totalCurrentScope}`;
    dom.kpiUndiscoveredRework.textContent = `${state.undiscoveredRework} 項 (已浮現: ${state.discoveredRework})`;
    if (state.undiscoveredRework > 100) {
      dom.kpiUndiscoveredRework.className = "text-xl font-bold text-rose-600 animate-pulse";
    } else {
      dom.kpiUndiscoveredRework.className = "text-xl font-bold text-amber-600";
    }

    // KPI: 士氣與疲勞
    dom.kpiMoraleFatigue.textContent = `士氣 ${state.moraleIndex}分 / 疲勞 ${state.fatigueIndex}x`;

    // 進度條
    dom.kpiProgressBar.style.width = `${state.scheduleProgressPercent}%`;
    dom.kpiProgressText.textContent = `${state.scheduleProgressPercent}%`;

    // 範疇追加通知提示
    if ([7, 8, 15, 16, 23, 24, 31, 32].includes(state.currentWeek)) {
      dom.scopeNoticeBox.classList.remove("hidden");
    } else {
      dom.scopeNoticeBox.classList.add("hidden");
    }

    // 更新圖表
    updateCharts(state.history);

    // 更新表格日誌
    renderLogTable(state.history);

    // 若結案跳出通知
    if (state.gameOver && !dom.hasAlertedGameOver) {
      dom.hasAlertedGameOver = true;
      setTimeout(() => {
        alert(state.gameOverReason + "\n\n請點擊右上角「登錄專案成績至 Google 試算表」提交學習成效！");
      }, 300);
    }
  }

  // 6. 渲染歷史日誌表格
  function renderLogTable(history) {
    dom.logTableBody.innerHTML = "";
    // 依週次倒序排列，方便觀察最新一週
    const reversed = [...history].reverse();
    reversed.forEach(h => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 hover:bg-slate-50 text-xs";
      tr.innerHTML = `
        <td class="py-2 px-3 font-semibold text-slate-700">W${h.week}</td>
        <td class="py-2 px-3">${h.totalStaff} (資深:${h.experiencedStaff}/新人:${h.rookieStaff})</td>
        <td class="py-2 px-3">${h.scheduledWorkHours}h</td>
        <td class="py-2 px-3">${(h.qaIntensity * 100).toFixed(0)}%</td>
        <td class="py-2 px-3">${h.tasksRemaining}</td>
        <td class="py-2 px-3">${h.tasksDoneApparent}</td>
        <td class="py-2 px-3 font-medium ${h.undiscoveredRework > 50 ? 'text-rose-600' : 'text-slate-600'}">${h.undiscoveredRework}</td>
        <td class="py-2 px-3">${h.discoveredRework}</td>
        <td class="py-2 px-3 font-semibold text-emerald-600">${h.tasksTrulyDone}</td>
        <td class="py-2 px-3">${h.moraleIndex}</td>
        <td class="py-2 px-3">${h.errorGenerationRate}%</td>
        <td class="py-2 px-3 font-medium text-slate-800">$${(h.cumulativeCost/1000).toFixed(0)}k</td>
        <td class="py-2 px-3 font-semibold text-indigo-600">${h.scheduleProgressPercent}%</td>
      `;
      dom.logTableBody.appendChild(tr);
    });
  }

  // 7. 控制面板事件綁定
  dom.sliderHeadcount.addEventListener("input", (e) => {
    dom.valHeadcount.textContent = `${e.target.value} 人`;
  });
  dom.sliderWorkHours.addEventListener("input", (e) => {
    dom.valWorkHours.textContent = `${e.target.value} 小時/週`;
  });
  dom.sliderQaIntensity.addEventListener("input", (e) => {
    dom.valQaIntensity.textContent = `${(Number(e.target.value) * 100).toFixed(0)} %`;
  });

  // 單步推進 (1 週)
  dom.stepOneWeekBtn.addEventListener("click", () => {
    engine.step({
      plannedHeadcount: Number(dom.sliderHeadcount.value),
      scheduledWorkHours: Number(dom.sliderWorkHours.value),
      qaIntensity: Number(dom.sliderQaIntensity.value),
      scopeAcceptance: dom.checkScopeAcceptance.checked
    });
    updateUI();
  });

  // 批次推進 (4 週)
  dom.stepFourWeeksBtn.addEventListener("click", () => {
    for (let i = 0; i < 4; i++) {
      if (engine.gameOver) break;
      engine.step({
        plannedHeadcount: Number(dom.sliderHeadcount.value),
        scheduledWorkHours: Number(dom.sliderWorkHours.value),
        qaIntensity: Number(dom.sliderQaIntensity.value),
        scopeAcceptance: dom.checkScopeAcceptance.checked
      });
    }
    updateUI();
  });

  // 重設模擬
  dom.resetBtn.addEventListener("click", () => {
    if (confirm("確定要重設專案模擬嗎？所有進度將恢復至第 1 週初始狀態。")) {
      engine.reset();
      dom.hasAlertedGameOver = false;
      dom.sliderHeadcount.value = 22;
      dom.valHeadcount.textContent = "22 人";
      dom.sliderWorkHours.value = 40;
      dom.valWorkHours.textContent = "40 小時/週";
      dom.sliderQaIntensity.value = 0.8;
      dom.valQaIntensity.textContent = "80 %";
      dom.checkScopeAcceptance.checked = true;
      updateUI();
    }
  });

  // 決策情境預設 (Presets)
  dom.presetBalanced.addEventListener("click", () => {
    dom.sliderHeadcount.value = 22;
    dom.sliderWorkHours.value = 40;
    dom.sliderQaIntensity.value = 0.85;
    dom.checkScopeAcceptance.checked = false;
    dom.valHeadcount.textContent = "22 人";
    dom.valWorkHours.textContent = "40 小時/週";
    dom.valQaIntensity.textContent = "85 %";
  });

  dom.presetCrunch.addEventListener("click", () => {
    dom.sliderHeadcount.value = 24;
    dom.sliderWorkHours.value = 58;
    dom.sliderQaIntensity.value = 0.40;
    dom.checkScopeAcceptance.checked = true;
    dom.valHeadcount.textContent = "24 人";
    dom.valWorkHours.textContent = "58 小時/週";
    dom.valQaIntensity.textContent = "40 %";
  });

  dom.presetQuality.addEventListener("click", () => {
    dom.sliderHeadcount.value = 26;
    dom.sliderWorkHours.value = 38;
    dom.sliderQaIntensity.value = 1.0;
    dom.checkScopeAcceptance.checked = false;
    dom.valHeadcount.textContent = "26 人";
    dom.valWorkHours.textContent = "38 小時/週";
    dom.valQaIntensity.textContent = "100 %";
  });

  dom.presetBrooks.addEventListener("click", () => {
    dom.sliderHeadcount.value = 42;
    dom.sliderWorkHours.value = 45;
    dom.sliderQaIntensity.value = 0.60;
    dom.checkScopeAcceptance.checked = true;
    dom.valHeadcount.textContent = "42 人";
    dom.valWorkHours.textContent = "45 小時/週";
    dom.valQaIntensity.textContent = "60 %";
  });

  // 8. 模態視窗控制 (因果回饋迴路說明)
  dom.openCausalModalBtn.addEventListener("click", () => {
    dom.causalModal.classList.remove("hidden");
  });
  dom.closeCausalModalBtn.addEventListener("click", () => {
    dom.causalModal.classList.add("hidden");
  });

  // 9. 匯出 CSV 檔
  dom.exportCsvBtn.addEventListener("click", () => {
    const history = engine.history;
    if (!history || history.length === 0) return alert("尚無模擬紀錄可匯出！");

    let csvContent = "\uFEFF週次,總人力,排定工時,品管強度,待辦任務,表觀完成,未發現返工,已發現返工,真正完工,士氣,錯誤率,累計成本,進度率\n";
    history.forEach(h => {
      csvContent += `${h.week},${h.totalStaff},${h.scheduledWorkHours},${h.qaIntensity},${h.tasksRemaining},${h.tasksDoneApparent},${h.undiscoveredRework},${h.discoveredRework},${h.tasksTrulyDone},${h.moraleIndex},${h.errorGenerationRate}%,${h.cumulativeCost},${h.scheduleProgressPercent}%\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Project_Management_Log_W${engine.currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // 10. 成績提交至 Google 試算表 (Two-Sheet Architecture)
  dom.openSubmitModalBtn.addEventListener("click", () => {
    dom.submitModal.classList.remove("hidden");
  });
  dom.closeSubmitModalBtn.addEventListener("click", () => {
    dom.submitModal.classList.add("hidden");
  });
  dom.cancelSubmitBtn.addEventListener("click", () => {
    dom.submitModal.classList.add("hidden");
  });

  dom.submitForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const gasUrl = dom.inputGasUrl.value.trim();
    const className = dom.inputClassName.value.trim();
    const studentId = dom.inputStudentId.value.trim();
    const studentName = dom.inputStudentName.value.trim();
    const reportUrl = dom.inputReportUrl.value.trim();

    if (!gasUrl) {
      alert("請輸入 Google Apps Script 網路應用程式 URL！");
      return;
    }
    if (!studentId || !studentName) {
      alert("請填寫學號與姓名！");
      return;
    }

    localStorage.setItem("pm_sim_gas_url", gasUrl);

    dom.submitBtn.disabled = true;
    dom.submitBtn.textContent = "上傳同步中...";
    dom.submitStatusMsg.textContent = "正在將雙工作表資料（排行榜與每週明細）批次寫入 Google 試算表...";
    dom.submitStatusMsg.className = "text-xs text-blue-600 mt-2 block";

    const state = engine.getCurrentStatus();
    let outcome = "如期且在預算內完成";
    if (state.cumulativeCost > engine.initialBudget && state.currentWeek > engine.targetCompletionWeek) {
      outcome = "嚴重雙重超支與延遲";
    } else if (state.cumulativeCost > engine.initialBudget) {
      outcome = "預算超支交付";
    } else if (state.currentWeek > engine.targetCompletionWeek) {
      outcome = "延期交付";
    }

    const payload = {
      summary: {
        className,
        studentId,
        studentName,
        totalCost: state.cumulativeCost,
        completionWeek: state.currentWeek,
        scheduleVariance: engine.targetCompletionWeek - state.currentWeek,
        costVariance: state.costVariance,
        finalQualityPercent: state.trueQualityPercent,
        undiscoveredRework: state.undiscoveredRework,
        projectOutcome: outcome,
        gameOverReason: state.gameOverReason || "模擬執行中登錄",
      },
      reportUrl,
      history: state.history
    };

    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors", // Google Apps Script Web App 常見跨網域要求
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      dom.submitStatusMsg.textContent = "✅ 資料已成功發送至 Google 試算表後端！感謝您的提交。";
      dom.submitStatusMsg.className = "text-xs text-emerald-600 font-semibold mt-2 block";
      setTimeout(() => {
        dom.submitModal.classList.add("hidden");
        dom.submitBtn.disabled = false;
        dom.submitBtn.textContent = "確認送出";
      }, 1500);

    } catch (err) {
      console.error(err);
      dom.submitStatusMsg.textContent = `❌ 上傳發生錯誤: ${err.message}`;
      dom.submitStatusMsg.className = "text-xs text-rose-600 font-semibold mt-2 block";
      dom.submitBtn.disabled = false;
      dom.submitBtn.textContent = "重新送出";
    }
  });

  // 初始化啟動
  initCharts();
  updateUI();
});
