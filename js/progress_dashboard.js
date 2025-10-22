/**
 * progress_dashboard.js - Progress Dashboard Integration
 * Part of AP Statistics Consensus Quiz
 *
 * Creates dashboard view with all progress charts and real-time data integration.
 */

class ProgressDashboard {
    constructor() {
        this.adapter = null;
        this.container = null;
        this.charts = {
            unitProgress: null,
            timeSeries: null,
            successRate: null,
            velocity: null
        };
        this.lastUpdated = null;
        this.loading = false;
    }

    /**
     * Initialize dashboard
     * @param {string} containerId - Container element ID to inject dashboard into
     */
    initialize(containerId = 'progressDashboard') {
        console.log('[ProgressDashboard] Initializing...');

        // Create adapter
        if (typeof ProgressChartAdapter !== 'undefined') {
            this.adapter = new ProgressChartAdapter();
        } else {
            console.error('[ProgressDashboard] ProgressChartAdapter not found');
            return false;
        }

        // Get or create container
        this.container = document.getElementById(containerId);
        if (!this.container) {
            // Create container if it doesn't exist
            this.container = document.createElement('div');
            this.container.id = containerId;
            document.body.appendChild(this.container);
        }

        // Render dashboard HTML
        this.renderDashboardHTML();

        // Setup event listeners
        this.setupEventListeners();

        console.log('[ProgressDashboard] Initialized successfully');
        return true;
    }

    /**
     * Render dashboard HTML structure
     */
    renderDashboardHTML() {
        this.container.innerHTML = `
            <div class="progress-dashboard">
                <div class="dashboard-header">
                    <div class="dashboard-title">
                        <h2>📊 Your Learning Progress</h2>
                        <p class="dashboard-subtitle">Track your performance across units and over time</p>
                    </div>
                    <div class="dashboard-controls">
                        <span class="last-updated">
                            Last updated: <time id="lastUpdatedTime">Never</time>
                        </span>
                        <button class="refresh-charts-btn" id="refreshChartsBtn" title="Refresh charts">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                            </svg>
                            Refresh
                        </button>
                        <button class="export-charts-btn" id="exportChartsBtn" title="Export charts as images">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
                            </svg>
                            Export
                        </button>
                    </div>
                </div>

                <!-- Stats Summary Bar -->
                <div class="dashboard-stats" id="dashboardStats">
                    <div class="stat-card">
                        <div class="stat-value" id="statTotalQuestions">-</div>
                        <div class="stat-label">Questions Answered</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statUnitsStarted">-</div>
                        <div class="stat-label">Units Started</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statAvgAttempts">-</div>
                        <div class="stat-label">Avg Attempts/Question</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statDateRange">-</div>
                        <div class="stat-label">Days Active</div>
                    </div>
                </div>

                <!-- Chart Grid -->
                <div class="chart-grid" id="chartGrid">
                    <!-- Unit Progress Card -->
                    <div class="chart-card" id="unitProgressCard">
                        <div class="chart-card-header">
                            <h3>Unit Completion</h3>
                            <span class="chart-info" title="Percentage of questions answered in each unit">ℹ️</span>
                        </div>
                        <div class="chart-card-body" id="unitProgressChart">
                            <div class="chart-skeleton"></div>
                        </div>
                    </div>

                    <!-- Time Series Card -->
                    <div class="chart-card" id="timeSeriesCard">
                        <div class="chart-card-header">
                            <h3>Activity Over Time</h3>
                            <span class="chart-info" title="Number of questions answered each day">ℹ️</span>
                        </div>
                        <div class="chart-card-body" id="timeSeriesChart">
                            <div class="chart-skeleton"></div>
                        </div>
                    </div>

                    <!-- Success Rate Card -->
                    <div class="chart-card" id="successRateCard">
                        <div class="chart-card-header">
                            <h3>Attempt Distribution</h3>
                            <span class="chart-info" title="First attempt vs retry breakdown by unit">ℹ️</span>
                        </div>
                        <div class="chart-card-body" id="successRateChart">
                            <div class="chart-skeleton"></div>
                        </div>
                    </div>

                    <!-- Learning Velocity Card -->
                    <div class="chart-card" id="velocityCard">
                        <div class="chart-card-header">
                            <h3>Learning Velocity</h3>
                            <span class="chart-info" title="Questions answered per day with 7-day moving average">ℹ️</span>
                        </div>
                        <div class="chart-card-body" id="velocityChart">
                            <div class="chart-skeleton"></div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div class="dashboard-empty" id="dashboardEmpty" style="display: none;">
                    <div class="empty-icon">📚</div>
                    <h3>No Progress Data Yet</h3>
                    <p>Start answering questions to see your progress charts!</p>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshChartsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadProgressCharts());
        }

        // Export button
        const exportBtn = document.getElementById('exportChartsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCharts());
        }
    }

    /**
     * Load and render all progress charts
     */
    async loadProgressCharts() {
        if (this.loading) {
            console.log('[ProgressDashboard] Already loading...');
            return;
        }

        this.loading = true;
        const refreshBtn = document.getElementById('refreshChartsBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }

        try {
            console.log('[ProgressDashboard] Loading progress data...');

            // Get progress data from progressSync or localStorage
            const progressData = await this.getProgressData();

            if (!progressData || progressData.length === 0) {
                this.showEmptyState();
                return;
            }

            console.log(`[ProgressDashboard] Loaded ${progressData.length} progress items`);

            // Hide empty state, show charts
            this.hideEmptyState();

            // Update stats summary
            this.updateStatsSummary(progressData);

            // Transform data using adapter
            const unitData = this.adapter.unitCompletionData(progressData, this.getUnitsMetadata());
            const timeData = this.adapter.timeSeriesData(progressData, 'daily');
            const successData = this.adapter.successRateData(progressData, null); // No answer key yet
            const velocityData = this.adapter.learningVelocityData(progressData, 7);

            // Render charts using two-phase pattern
            await this.renderChart('unitProgressChart', 'unitProgress', unitData, 400, 250);
            await this.renderChart('timeSeriesChart', 'timeSeries', timeData, 500, 280);
            await this.renderChart('successRateChart', 'successRate', successData, 400, 250);
            await this.renderChart('velocityChart', 'velocity', velocityData, 500, 280);

            // Update timestamp
            this.lastUpdated = new Date();
            this.updateLastUpdatedTime();

            console.log('[ProgressDashboard] Charts loaded successfully');

        } catch (error) {
            console.error('[ProgressDashboard] Error loading charts:', error);
            this.showError('Failed to load progress charts. Please try again.');
        } finally {
            this.loading = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Render individual chart
     */
    async renderChart(containerId, chartType, data, width, height) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container not found: ${containerId}`);
            return;
        }

        // Generate HTML (Phase 1)
        let html;
        let renderFn;

        switch (chartType) {
            case 'unitProgress':
                html = window.charts.getUnitProgressChartHtml(containerId, width, height);
                renderFn = () => window.charts.renderUnitProgressChartNow(`${containerId}-canvas`, data);
                break;
            case 'timeSeries':
                html = window.charts.getTimeSeriesChartHtml(containerId, width, height);
                renderFn = () => window.charts.renderTimeSeriesChartNow(`${containerId}-canvas`, data);
                break;
            case 'successRate':
                html = window.charts.getSuccessRateChartHtml(containerId, width, height);
                renderFn = () => window.charts.renderSuccessRateChartNow(`${containerId}-canvas`, data);
                break;
            case 'velocity':
                html = window.charts.getLearningVelocityChartHtml(containerId, width, height);
                renderFn = () => window.charts.renderLearningVelocityChartNow(`${containerId}-canvas`, data);
                break;
            default:
                console.warn(`Unknown chart type: ${chartType}`);
                return;
        }

        // Inject HTML
        container.innerHTML = html;

        // Wait for DOM to update, then render (Phase 2)
        await new Promise(resolve => requestAnimationFrame(resolve));
        renderFn();
    }

    /**
     * Get progress data from progressSync or fallback to localStorage
     */
    async getProgressData() {
        // Try progressSync first
        if (window.progressSync && typeof window.progressSync.loadAllProgress === 'function') {
            try {
                await window.progressSync.loadAllProgress();
                // Get data from classData
                return this.extractProgressFromClassData();
            } catch (error) {
                console.warn('[ProgressDashboard] Failed to load from progressSync:', error);
            }
        }

        // Fallback to localStorage
        return this.extractProgressFromClassData();
    }

    /**
     * Extract progress data from classData
     */
    extractProgressFromClassData() {
        if (!window.classData || !window.currentUsername) {
            console.warn('[ProgressDashboard] No classData or currentUsername');
            return [];
        }

        const userData = window.classData.users[window.currentUsername];
        if (!userData || !userData.answers) {
            return [];
        }

        const progressData = [];
        for (const [questionId, answerData] of Object.entries(userData.answers)) {
            progressData.push({
                question_id: questionId,
                answer: answerData.value || answerData,
                reason: userData.reasons?.[questionId] || '',
                attempt: userData.attempts?.[questionId] || 1,
                timestamp: answerData.timestamp ? new Date(answerData.timestamp).toISOString() : new Date().toISOString()
            });
        }

        return progressData;
    }

    /**
     * Get units metadata (total questions per unit)
     */
    getUnitsMetadata() {
        // Try to get from global unitsConfig
        if (window.unitsConfig) {
            const metadata = {};
            Object.entries(window.unitsConfig).forEach(([unitNum, unitData]) => {
                metadata[unitNum] = {
                    name: unitData.title || `Unit ${unitNum}`,
                    totalQuestions: unitData.totalQuestions || 0
                };
            });
            return metadata;
        }
        return null;
    }

    /**
     * Update stats summary bar
     */
    updateStatsSummary(progressData) {
        const stats = this.adapter.getStatsSummary(progressData);

        document.getElementById('statTotalQuestions').textContent = stats.uniqueQuestions || 0;
        document.getElementById('statUnitsStarted').textContent = stats.unitsStarted || 0;
        document.getElementById('statAvgAttempts').textContent = stats.avgAttemptsPerQuestion || '0';
        document.getElementById('statDateRange').textContent = stats.dateRange?.days || '0';
    }

    /**
     * Update last updated timestamp
     */
    updateLastUpdatedTime() {
        const timeEl = document.getElementById('lastUpdatedTime');
        if (timeEl && this.lastUpdated) {
            timeEl.textContent = this.lastUpdated.toLocaleTimeString();
        }
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        document.getElementById('dashboardEmpty').style.display = 'flex';
        document.getElementById('chartGrid').style.display = 'none';
        document.getElementById('dashboardStats').style.display = 'none';
    }

    /**
     * Hide empty state
     */
    hideEmptyState() {
        document.getElementById('dashboardEmpty').style.display = 'none';
        document.getElementById('chartGrid').style.display = 'grid';
        document.getElementById('dashboardStats').style.display = 'flex';
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error', 5000);
        } else {
            alert(message);
        }
    }

    /**
     * Export charts as images
     */
    async exportCharts() {
        console.log('[ProgressDashboard] Exporting charts...');

        try {
            const chartCanvases = [
                { id: 'unitProgressChart-canvas', name: 'unit-completion' },
                { id: 'timeSeriesChart-canvas', name: 'activity-over-time' },
                { id: 'successRateChart-canvas', name: 'attempt-distribution' },
                { id: 'velocityChart-canvas', name: 'learning-velocity' }
            ];

            for (const chartInfo of chartCanvases) {
                const canvas = document.getElementById(chartInfo.id);
                if (canvas) {
                    // Convert canvas to blob
                    canvas.toBlob(blob => {
                        // Create download link
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `progress-${chartInfo.name}-${Date.now()}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                }
            }

            if (window.showToast) {
                window.showToast('Charts exported successfully!', 'success');
            }

        } catch (error) {
            console.error('[ProgressDashboard] Export failed:', error);
            this.showError('Failed to export charts');
        }
    }

    /**
     * Destroy dashboard and cleanup
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Destroy chart instances
        Object.values(this.charts).forEach(chartId => {
            if (window.chartInstances?.[chartId]) {
                window.chartInstances[chartId].destroy();
            }
        });

        console.log('[ProgressDashboard] Destroyed');
    }
}

// Export for use in other modules
window.ProgressDashboard = ProgressDashboard;

// Helper function to show/hide progress dashboard
window.showProgressDashboard = function() {
    if (!window.progressDashboard) {
        window.progressDashboard = new ProgressDashboard();
        window.progressDashboard.initialize('progressDashboard');
    }

    const container = document.getElementById('progressDashboard');
    if (container) {
        container.style.display = 'block';
    }

    // Load charts
    window.progressDashboard.loadProgressCharts();
};

window.hideProgressDashboard = function() {
    const container = document.getElementById('progressDashboard');
    if (container) {
        container.style.display = 'none';
    }
};

console.log('[ProgressDashboard] Module loaded');
