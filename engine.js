/**
 * Project Management Flight Simulator Engine (系統動力學核心模擬引擎)
 * 依據 MIT Sloan (Burak Gozluklu, Nelson Repenning, John Sterman) 專案管理系統動力學模型建構
 * 
 * 核心反饋迴路 (Feedback Loops):
 * 1. The Rework Cycle (返工循環): 未發現返工 (Undiscovered Rework) 在測試/整合階段爆發，造成著名的「90% 完成症候群」(90% Syndrome)
 * 2. Brooks' Law (布魯克斯法則): 專案落後時倉促招聘新人 (Rookies)，資深員工 (Experienced) 必須耗費心力培訓與協調，短期內反而降低淨產能
 * 3. Schedule Pressure & Burnout (時程壓力與過勞): 盲目加班 (>40小時) 短期提升工作量，但迅速導致疲勞與士氣低落，引發錯誤率倍增及偷工減料 (Corner-cutting)
 * 4. Scope Creep & QA Trade-off (範疇蔓延與品管取捨): 盲目接受客戶變更需求擴大任務量；壓縮 QA 測試速率雖使表觀進度上升，卻累積海量潛在缺陷
 */

class ProjectManagementEngine {
  constructor(config = {}) {
    this.totalWeeks = config.totalWeeks || 50; // 模擬總週數 (標準專案排程 50 週)
    this.initialScope = config.initialScope || 1000; // 初始專案任務數 (Tasks / Work Packages)
    this.targetCompletionWeek = config.targetCompletionWeek || 40; // 預計交付週 (第 40 週)
    this.initialBudget = config.initialBudget || 2500000; // 專案總預算 $2.5M ($2,500,000)
    
    // 財務基準常數
    this.baseHourlyWage = 50; // 基本時薪 $50/小時 ($2,000/人/40小時週)
    this.overtimeMultiplier = 1.5; // 加班費加乘 1.5x
    this.hiringCostPerPerson = 8000; // 招聘與引進成本 $8,000/人
    this.severanceCostPerPerson = 5000; // 資遣費成本 $5,000/人
    this.weeklyOverhead = 15000; // 專案每週固定間接管理費 $15,000

    this.reset();
  }

  reset() {
    this.currentWeek = 1;
    this.isCompleted = false;
    this.gameOver = false;
    this.gameOverReason = "";

    // 存量狀態變數 (Stocks)
    this.tasksRemaining = this.initialScope; // 尚待完成之原始任務 (Tasks pending)
    this.tasksDoneApparent = 0; // 表觀已完成任務 (包括尚未發現缺陷之任務)
    this.undiscoveredRework = 0; // 潛在返工量 (隱藏缺陷，管理者無法直接看見)
    this.discoveredRework = 0; // 已發現並待修復之返工 (Discovered Rework)
    this.tasksTrulyDone = 0; // 真正高品質完成且通過檢驗之任務 (Verified Done)
    this.scopeAdditionsTotal = 0; // 累計客戶追加之範疇數量

    // 人力資源存量 (Workforce Stocks)
    this.experiencedStaff = 18; // 資深工程師人數 (人數)
    this.rookieStaff = 4; // 新人工程師人數 (處於培訓適應期)
    this.onboardingPipeline = []; // 招聘管線緩衝 [第1週待入職, 第2週待入職]

    // 心理與效率狀態 (Fatigue & Morale)
    this.fatigueIndex = 1.0; // 疲勞指數 (1.0 為標準無疲勞，最高 2.0)
    this.moraleIndex = 100; // 專案團隊士氣 (0 - 100)
    this.errorGenerationRate = 0.12; // 基本錯誤產生率 (12%)

    // 財務指標存量
    this.cumulativeCost = 0; // 累計實際成本 ($)
    this.weeklyCost = 0;

    // 歷史營運記錄 (用於雙工作表日誌與圖表)
    this.history = [];
    
    // 記錄初始週狀態
    this.logWeekState({
      plannedHeadcount: 22,
      scheduledWorkHours: 40,
      qaIntensity: 0.8,
      scopeAcceptance: true
    }, {
      newHires: 0,
      quits: 0,
      scopeAdded: 0,
      tasksAccomplished: 0,
      reworkDiscoveredThisWeek: 0,
      defectGeneratedThisWeek: 0
    });
  }

  /**
   * 執行一週的模擬計算
   * @param {Object} decisions 決策變數
   * @param {number} decisions.plannedHeadcount 目標總團隊人數 (10 ~ 40 人)
   * @param {number} decisions.scheduledWorkHours 每週排定工時 (35 ~ 60 小時/週)
   * @param {number} decisions.qaIntensity 測試與品管強度 (0.2 ~ 1.0)
   * @param {boolean} decisions.scopeAcceptance 是否接受客戶本週範疇變更需求 (true: 接受, false: 凍結拒絕)
   */
  step(decisions) {
    if (this.gameOver) return this.getCurrentStatus();

    const plannedHeadcount = Math.max(8, Math.min(45, Number(decisions.plannedHeadcount) || 20));
    const scheduledWorkHours = Math.max(35, Math.min(65, Number(decisions.scheduledWorkHours) || 40));
    const qaIntensity = Math.max(0.2, Math.min(1.0, Number(decisions.qaIntensity) || 0.8));
    const scopeAcceptance = Boolean(decisions.scopeAcceptance);

    // 1. 範疇變更衝擊 (Scope Expansion / Client Change Requests)
    let scopeAdded = 0;
    // 在第 8, 16, 24, 32 週客戶可能提出功能變更需求
    if ([8, 16, 24, 32].includes(this.currentWeek)) {
      const requestAmount = 40 + Math.floor(Math.sin(this.currentWeek) * 20);
      if (scopeAcceptance) {
        scopeAdded = requestAmount;
        this.tasksRemaining += scopeAdded;
        this.scopeAdditionsTotal += scopeAdded;
      }
    }

    // 2. 人力資源調整與布魯克斯法則 (Brooks' Law)
    const currentTotalStaff = this.experiencedStaff + this.rookieStaff;
    const staffingGap = plannedHeadcount - currentTotalStaff;
    let newHires = 0;
    let layoffs = 0;
    let hiringExpense = 0;
    let severanceExpense = 0;

    if (staffingGap > 0) {
      newHires = staffingGap;
      hiringExpense = newHires * this.hiringCostPerPerson;
      // 招聘有 2 週引進延遲
      this.onboardingPipeline.push({ weeksRemaining: 2, count: newHires });
    } else if (staffingGap < 0) {
      layoffs = Math.abs(staffingGap);
      severanceExpense = layoffs * this.severanceCostPerPerson;
      // 裁員優先裁新人
      if (this.rookieStaff >= layoffs) {
        this.rookieStaff -= layoffs;
      } else {
        const remainingToCut = layoffs - this.rookieStaff;
        this.rookieStaff = 0;
        this.experiencedStaff = Math.max(5, this.experiencedStaff - remainingToCut);
      }
      this.moraleIndex = Math.max(30, this.moraleIndex - (layoffs * 3));
    }

    // 招聘管線更新：新人到達
    let newlyArrivedRookies = 0;
    this.onboardingPipeline = this.onboardingPipeline.map(item => {
      item.weeksRemaining -= 1;
      return item;
    }).filter(item => {
      if (item.weeksRemaining <= 0) {
        newlyArrivedRookies += item.count;
        return false;
      }
      return true;
    });
    this.rookieStaff += newlyArrivedRookies;

    // 新人熟練化 (Rookie assimilation): 每週約有 1/8 的新人轉為資深員工
    const assimilated = Math.min(this.rookieStaff, Math.floor(this.rookieStaff * 0.125 + 0.5));
    this.rookieStaff -= assimilated;
    this.experiencedStaff += assimilated;

    // 新人導師負擔 (Mentoring load): 每位新人佔用資深工程師 20% 的工時
    const mentoringBurdenFactor = Math.min(0.5, (this.rookieStaff * 0.20) / Math.max(1, this.experiencedStaff));

    // 3. 工時、疲勞度與產出率 (Overtime, Fatigue & Work Capacity)
    // 基準工時 40 小時。超過 40 小時累積疲勞，低於 40 小時恢復
    if (scheduledWorkHours > 40) {
      const overtimeDelta = (scheduledWorkHours - 40) / 40;
      this.fatigueIndex = Math.min(2.0, this.fatigueIndex + overtimeDelta * 0.25);
      // 長期加班損害士氣
      this.moraleIndex = Math.max(30, this.moraleIndex - overtimeDelta * 3.5);
    } else {
      this.fatigueIndex = Math.max(1.0, this.fatigueIndex - 0.20);
      this.moraleIndex = Math.min(100, this.moraleIndex + 2.0);
    }

    // 疲勞與壓力對錯誤率的非線性放大效應 (Error Generation Dynamics)
    // 基準錯誤率 10%，高疲勞與低士氣下激增至 40% 以上
    const fatigueErrorMultiplier = Math.pow(this.fatigueIndex, 1.8);
    const moraleErrorMultiplier = (120 - this.moraleIndex) / 100;
    this.errorGenerationRate = Math.min(0.50, 0.10 * fatigueErrorMultiplier * moraleErrorMultiplier);

    // 實際有效產能 (Productivity per Person-Hour)
    // 基準效率: 資深工程師 1.0，新人工程師 0.45，扣除導師時間與疲勞損耗
    const rookieRelativeSkill = 0.45;
    const effectiveStaffUnits = (this.experiencedStaff * (1 - mentoringBurdenFactor)) + (this.rookieStaff * rookieRelativeSkill);
    const fatigueProductivityLoss = 1 / (1 + (this.fatigueIndex - 1.0) * 0.6); // 疲勞導致效率下滑
    const moraleProductivityFactor = (this.moraleIndex / 100) * 0.4 + 0.6; // 士氣影響產能

    // 總工時數
    const totalWeeklyHours = (this.experiencedStaff + this.rookieStaff) * scheduledWorkHours;
    // 總產出潛力 (以標準任務點數計，假設正常情況下每人每週完成 1.4 個任務點數 / 40小時)
    const baseTaskRatePerHour = 1.4 / 40;
    const potentialTaskAccomplishment = effectiveStaffUnits * scheduledWorkHours * baseTaskRatePerHour * fatigueProductivityLoss * moraleProductivityFactor;

    // 4. 工作分配：開發新任務 vs. 修復已發現返工 (Task Allocation)
    // 團隊需優先修復已浮上檯面的缺陷 (discovered rework)，剩餘精力用於原始任務
    let reworkAddressed = 0;
    let initialTasksAddressed = 0;

    if (this.discoveredRework > 0) {
      // 撥出高達 60% 的產能修復已發現的返工
      const reworkCapacity = potentialTaskAccomplishment * 0.60;
      reworkAddressed = Math.min(this.discoveredRework, reworkCapacity);
      this.discoveredRework -= reworkAddressed;
      
      const remainingCapacity = potentialTaskAccomplishment - reworkAddressed;
      initialTasksAddressed = Math.min(this.tasksRemaining, remainingCapacity);
      this.tasksRemaining -= initialTasksAddressed;
    } else {
      initialTasksAddressed = Math.min(this.tasksRemaining, potentialTaskAccomplishment);
      this.tasksRemaining -= initialTasksAddressed;
    }

    const totalAccomplishedThisStep = reworkAddressed + initialTasksAddressed;

    // 5. 錯誤產生與未發現返工 (Generation of Undiscovered Rework)
    // 所完成的工作中，有部分因為錯誤或品質不足而包含潛在缺陷
    const defectGeneratedThisWeek = totalAccomplishedThisStep * this.errorGenerationRate;
    const correctlyDoneThisWeek = totalAccomplishedThisStep - defectGeneratedThisWeek;

    this.undiscoveredRework += defectGeneratedThisWeek;
    this.tasksDoneApparent += totalAccomplishedThisStep; // 表觀上似乎全部完成了

    // 6. 測試品管與缺陷發現 (Testing & QA Discovery)
    // QA 強度 (qaIntensity) 決定每週自「未發現返工」與「表觀完成」中抓出缺陷的比例
    // 若 qaIntensity 偏低，缺陷留在系統內，直到專案末期整合爆發！
    const schedulePressure = Math.max(0, (this.tasksRemaining + this.undiscoveredRework) / Math.max(1, (this.targetCompletionWeek - this.currentWeek + 1)));
    const cornerCuttingPressure = Math.min(0.5, schedulePressure / 50); // 時程壓力導致偷工減料，跳過品管
    const effectiveQA = Math.max(0.1, qaIntensity * (1 - cornerCuttingPressure));

    // 缺陷發現速率：受目前表觀完成任務、QA 強度與專案階段影響
    // 當專案越接近尾聲 (或表觀進度 > 75%)，系統整合時隱藏缺陷會被迫大量浮現 (The 90% Syndrome)
    let discoveryRateCoeff = effectiveQA * 0.35;
    if (this.currentWeek >= 30 || (this.tasksDoneApparent / Math.max(1, this.initialScope + this.scopeAdditionsTotal)) > 0.75) {
      discoveryRateCoeff += 0.25; // 後期整合測試撞牆期
    }
    const reworkDiscoveredThisWeek = Math.min(this.undiscoveredRework, this.undiscoveredRework * discoveryRateCoeff);
    this.undiscoveredRework -= reworkDiscoveredThisWeek;
    this.discoveredRework += reworkDiscoveredThisWeek;
    this.tasksDoneApparent = Math.max(0, this.tasksDoneApparent - reworkDiscoveredThisWeek);

    // 真正合格且無瑕疵任務
    this.tasksTrulyDone = Math.max(0, (this.initialScope + this.scopeAdditionsTotal) - this.tasksRemaining - this.undiscoveredRework - this.discoveredRework);

    // 7. 成本核算 (Financial Calculations)
    const baseHours = Math.min(40, scheduledWorkHours);
    const overtimeHours = Math.max(0, scheduledWorkHours - 40);
    const totalStaffCount = this.experiencedStaff + this.rookieStaff;

    const baseWageCost = totalStaffCount * baseHours * this.baseHourlyWage;
    const overtimeWageCost = totalStaffCount * overtimeHours * this.baseHourlyWage * this.overtimeMultiplier;
    this.weeklyCost = baseWageCost + overtimeWageCost + hiringExpense + severanceExpense + this.weeklyOverhead;
    this.cumulativeCost += this.weeklyCost;

    // 8. 專案完工與終止判斷 (Completion & Termination Criteria)
    const totalCurrentScope = this.initialScope + this.scopeAdditionsTotal;
    const isActuallyComplete = this.tasksRemaining <= 2 && this.undiscoveredRework <= 5 && this.discoveredRework <= 2;
    
    if (isActuallyComplete && !this.isCompleted) {
      this.isCompleted = true;
      this.gameOver = true;
      const onTime = this.currentWeek <= this.targetCompletionWeek;
      const underBudget = this.cumulativeCost <= this.initialBudget;
      if (onTime && underBudget) {
        this.gameOverReason = `🎉 卓越專案管理！於第 ${this.currentWeek} 週如期完工且在預算內（支出 $${(this.cumulativeCost/1000).toFixed(0)}k），未遺留嚴重技術債！`;
      } else if (onTime) {
        this.gameOverReason = `⚠️ 專案於第 ${this.currentWeek} 週如期交付，但發生嚴重預算超支（總支出 $${(this.cumulativeCost/1000).toFixed(0)}k，超出 $${((this.cumulativeCost - this.initialBudget)/1000).toFixed(0)}k）！`;
      } else if (underBudget) {
        this.gameOverReason = `⚠️ 專案嚴格控制在預算內，但進度延誤至第 ${this.currentWeek} 週才完成（原定第 ${this.targetCompletionWeek} 週）！`;
      } else {
        this.gameOverReason = `❌ 專案於第 ${this.currentWeek} 週勉強交付，同時發生嚴重進度延宕與預算失控超支！`;
      }
    } else if (this.currentWeek >= this.totalWeeks && !this.isCompleted) {
      this.gameOver = true;
      this.gameOverReason = `💥 專案抵達第 50 週截止期限宣告強制結案！仍有 ${Math.round(this.tasksRemaining)} 項任務未完成，且殘留 ${Math.round(this.undiscoveredRework)} 項隱藏技術債與缺陷！`;
    }

    // 9. 記錄歷史日誌
    this.logWeekState(decisions, {
      newHires,
      layoffs,
      scopeAdded,
      tasksAccomplished: totalAccomplishedThisStep,
      reworkDiscoveredThisWeek,
      defectGeneratedThisWeek
    });

    if (!this.gameOver) {
      this.currentWeek += 1;
    }

    return this.getCurrentStatus();
  }

  logWeekState(decisions, weeklyFlows) {
    const totalCurrentScope = this.initialScope + this.scopeAdditionsTotal;
    const scheduleProgressPercent = Math.min(100, (this.tasksDoneApparent / Math.max(1, totalCurrentScope)) * 100);
    const trueQualityPercent = Math.max(0, Math.min(100, (1 - (this.undiscoveredRework / Math.max(1, this.tasksDoneApparent))) * 100));

    this.history.push({
      week: this.currentWeek,
      // 決策變數
      plannedHeadcount: decisions.plannedHeadcount,
      scheduledWorkHours: decisions.scheduledWorkHours,
      qaIntensity: decisions.qaIntensity,
      scopeAcceptance: decisions.scopeAcceptance,
      // 任務與範疇指標
      totalCurrentScope,
      tasksRemaining: Math.round(this.tasksRemaining),
      tasksDoneApparent: Math.round(this.tasksDoneApparent),
      undiscoveredRework: Math.round(this.undiscoveredRework),
      discoveredRework: Math.round(this.discoveredRework),
      tasksTrulyDone: Math.round(this.tasksTrulyDone),
      scopeAdded: weeklyFlows.scopeAdded || 0,
      tasksAccomplished: Math.round(weeklyFlows.tasksAccomplished || 0),
      // 人力與心理指標
      experiencedStaff: Math.round(this.experiencedStaff),
      rookieStaff: Math.round(this.rookieStaff),
      totalStaff: Math.round(this.experiencedStaff + this.rookieStaff),
      newHires: weeklyFlows.newHires || 0,
      layoffs: weeklyFlows.layoffs || 0,
      fatigueIndex: Number(this.fatigueIndex.toFixed(2)),
      moraleIndex: Math.round(this.moraleIndex),
      errorGenerationRate: Number((this.errorGenerationRate * 100).toFixed(1)),
      // 成本與進度
      weeklyCost: Math.round(this.weeklyCost),
      cumulativeCost: Math.round(this.cumulativeCost),
      scheduleProgressPercent: Number(scheduleProgressPercent.toFixed(1)),
      trueQualityPercent: Number(trueQualityPercent.toFixed(1))
    });
  }

  getCurrentStatus() {
    const totalCurrentScope = this.initialScope + this.scopeAdditionsTotal;
    const scheduleProgressPercent = Math.min(100, (this.tasksDoneApparent / Math.max(1, totalCurrentScope)) * 100);
    const costVariance = this.initialBudget - this.cumulativeCost; // 正數代表在預算內，負數超支
    const trueQualityPercent = Math.max(0, Math.min(100, (1 - (this.undiscoveredRework / Math.max(1, this.tasksDoneApparent))) * 100));

    return {
      currentWeek: this.currentWeek,
      totalWeeks: this.totalWeeks,
      targetCompletionWeek: this.targetCompletionWeek,
      isCompleted: this.isCompleted,
      gameOver: this.gameOver,
      gameOverReason: this.gameOverReason,
      // 任務狀態
      totalCurrentScope,
      tasksRemaining: Math.round(this.tasksRemaining),
      tasksDoneApparent: Math.round(this.tasksDoneApparent),
      undiscoveredRework: Math.round(this.undiscoveredRework),
      discoveredRework: Math.round(this.discoveredRework),
      tasksTrulyDone: Math.round(this.tasksTrulyDone),
      scheduleProgressPercent: Number(scheduleProgressPercent.toFixed(1)),
      // 人力狀態
      experiencedStaff: Math.round(this.experiencedStaff),
      rookieStaff: Math.round(this.rookieStaff),
      totalStaff: Math.round(this.experiencedStaff + this.rookieStaff),
      fatigueIndex: Number(this.fatigueIndex.toFixed(2)),
      moraleIndex: Math.round(this.moraleIndex),
      errorGenerationRate: Number((this.errorGenerationRate * 100).toFixed(1)),
      // 財務狀態
      initialBudget: this.initialBudget,
      cumulativeCost: Math.round(this.cumulativeCost),
      weeklyCost: Math.round(this.weeklyCost),
      costVariance: Math.round(costVariance),
      trueQualityPercent: Number(trueQualityPercent.toFixed(1)),
      history: this.history
    };
  }
}

// 支援瀏覽器與 Node.js 雙環境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectManagementEngine;
}
