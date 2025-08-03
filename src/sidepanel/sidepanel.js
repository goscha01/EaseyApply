// EasyApply Side Panel JavaScript
class EasyApplySidePanel {
    constructor() {
        this.isRunning = false;
        this.currentJob = null;
        this.stats = { applied: 0, failed: 0, total: 0 };
        this.debugMode = false;
        this.init();
    }

    init() {
        // Show loading state initially
        this.showLoadingState();
        
        // Initialize after a short delay to show loading
        setTimeout(() => {
            this.bindEvents();
            this.loadSettings();
            this.updateStatus('Ready');
            this.setupDebugPanel();
            this.updateDebugInfo();
            this.startDebugUpdates();
            this.setupMessageListener();
            
            // Hide loading and show main content
            this.hideLoadingState();
        }, 1000);
    }

    showLoadingState() {
        const loadingState = document.getElementById('loading-state');
        const mainContent = document.getElementById('main-content');
        
        if (loadingState) loadingState.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'none';
    }

    hideLoadingState() {
        const loadingState = document.getElementById('loading-state');
        const mainContent = document.getElementById('main-content');
        
        if (loadingState) loadingState.style.display = 'none';
        if (mainContent) mainContent.style.display = 'flex';
        
        // Add loaded class to body
        document.body.classList.add('loaded');
    }

    bindEvents() {
        // Main action buttons
        document.getElementById('gather-jobs-btn')?.addEventListener('click', () => this.gatherJobs());
        document.getElementById('start-applications-btn')?.addEventListener('click', () => this.startSingleApplication());
        document.getElementById('fetch-all-descriptions-btn')?.addEventListener('click', () => this.fetchAllDescriptions());
        document.getElementById('view-field-history-btn')?.addEventListener('click', () => this.viewFieldHistory());
        document.getElementById('test-button-detection-btn')?.addEventListener('click', () => this.testButtonDetection());
        document.getElementById('test-easy-apply-btn')?.addEventListener('click', () => this.testEasyApplyButton());
        document.getElementById('debug-next-button-btn')?.addEventListener('click', () => this.debugNextButton());
        document.getElementById('debug-form-detection-btn')?.addEventListener('click', () => this.debugFormDetection());
        document.getElementById('debug-field-history-btn')?.addEventListener('click', () => this.debugFieldHistory());
        document.getElementById('ping-content-script-btn')?.addEventListener('click', () => this.pingContentScript());
        document.getElementById('toggle-auto-mode-btn')?.addEventListener('click', () => this.toggleAutoMode());
        document.getElementById('view-problematic-fields-btn')?.addEventListener('click', () => this.viewProblematicFields());
        document.getElementById('stop-process-btn')?.addEventListener('click', () => this.stopProcess());

        // Debug panel
        document.getElementById('toggle-debug')?.addEventListener('click', () => this.toggleDebugPanel());
        
        // Add a debug method to check UI state
        console.log('🔍 Sidepanel initialized with stop button support');
        console.log('Stop button element:', document.getElementById('stop-process-btn'));
        console.log('Test button element:', document.getElementById('test-stop-btn'));
    }

    async loadSettings() {
        try {
            const settings = await this.getStorageData('settings') || {};
            this.settings = settings;
            console.log('✅ Settings loaded successfully:', settings);
        } catch (error) {
            console.error('❌ Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = this.getFormData();
            await this.setStorageData('settings', settings);
            console.log('✅ Settings saved successfully');
        } catch (error) {
            console.error('❌ Error saving settings:', error);
        }
    }

    getFormData() {
        return {
            job_count: this.settings?.job_count || 10,
            skills: this.settings?.skills || '',
            job_location: this.settings?.job_location || '',
            job_type: this.settings?.job_type || ''
        };
    }

    validateSettings() {
        const data = this.getFormData();
        
        if (data.job_count < 1 || data.job_count > 50) {
            throw new Error('Job count must be between 1 and 50');
        }
        
        return data;
    }

    async gatherJobs() {
        try {
            console.log('🔍 Starting job gathering process...');
            
            const settings = this.validateSettings();
            console.log('✅ Settings validated:', settings);
            
            this.isRunning = true;
            console.log('🔍 Setting isRunning = true for job gathering');
            this.updateUI();
            this.updateStatus('Gathering jobs...');
            
            // Save settings
            await this.saveSettings();
            console.log('✅ Settings saved');
            
            // Send message to background service worker to gather jobs
            console.log('📡 Sending gather jobs message to background service worker...');
            
            const response = await chrome.runtime.sendMessage({
                type: 'gatherJobs',
                data: settings
            });
            
            console.log('📡 Background service worker response:', response);
            
            if (response && response.success) {
                console.log('✅ Job gathering started successfully');
                this.updateStatus('Gathering jobs...');
                this.updateUI(); // Ensure UI is updated after successful start
                
                // Start polling for job list updates
                this.startJobListPolling();
                
                // Show the job list section
                this.showJobList();
                
            } else {
                console.error('❌ Background service worker failed to start job gathering:', response?.error);
                this.isRunning = false;
                this.updateStatus('Error');
                this.showError(response?.error || 'Failed to start job gathering');
            }
            
        } catch (error) {
            console.error('❌ Error starting job gathering:', error);
            this.isRunning = false;
            this.updateStatus('Error');
            this.showError(error.message);
        }
    }

    /**
     * Apply to the current job page only (doesn't require gathered jobs)
     */
    async startSingleApplication() {
        try {
            console.log('🚀 Starting single application process...');
            
            // Check if we're on a LinkedIn job page
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const currentUrl = tabs[0].url;
            if (!currentUrl.includes('linkedin.com/jobs/view/')) {
                this.showError('Please navigate to a LinkedIn job page first');
                return;
            }
            
            this.isRunning = true;
            console.log('🚀 Setting isRunning = true for single application');
            this.updateUI();
            this.updateStatus('Starting application process...');
            
            // Send message to background service worker to start single application
            this.updateStatus('Processing application...');
            const response = await chrome.runtime.sendMessage({
                type: 'startSingleApplication'
            });
            
            console.log('📡 Start single application response:', response);
            
            if (response && response.success) {
                console.log('✅ Single application completed successfully');
                this.updateStatus('Application completed');
                this.updateUI();
                
                // Add a delay to ensure the user sees the process complete first
                setTimeout(() => {
                    this.showSuccess('Successfully applied to current job!');
                }, 3000);
                
            } else {
                console.error('❌ Failed to complete single application:', response?.error || response?.message);
                this.isRunning = false;
                this.updateStatus('Error');
                this.showError(response?.error || response?.message || 'Failed to apply to current job');
            }
            
        } catch (error) {
            console.error('❌ Error starting single application:', error);
            this.isRunning = false;
            this.updateStatus('Error');
            this.showError(error.message);
        }
    }

    /**
     * Apply to all gathered jobs (requires job gathering first)
     */
    async startApplications() {
        try {
            console.log('🚀 Starting bulk application process...');
            
            this.isRunning = true;
            console.log('🚀 Setting isRunning = true for bulk applications');
            this.updateUI();
            this.updateStatus('Starting bulk applications...');
            
            // Send message to background service worker to start applications
            const response = await chrome.runtime.sendMessage({
                type: 'startApplications'
            });
            
            console.log('📡 Start applications response:', response);
            
            if (response && response.success) {
                console.log('✅ Applications started successfully');
                this.updateStatus('Running applications...');
                this.updateUI(); // Ensure UI is updated after successful start
                
                // Start polling for progress updates
                this.startProgressPolling();
                
            } else if (response && response.stopped) {
                console.log('⏹️ Applications stopped by user');
                this.isRunning = false;
                this.updateStatus('Stopped by user');
                this.updateUI();
                this.showSuccess(`Process stopped. Applied to ${response.appliedCount}/${response.totalJobs} jobs.`);
                
            } else {
                console.error('❌ Failed to start applications:', response?.error || response?.message);
                this.isRunning = false;
                this.updateStatus('Error');
                this.showError(response?.error || response?.message || 'Failed to start applications');
            }
            
        } catch (error) {
            console.error('❌ Error starting applications:', error);
            this.isRunning = false;
            this.updateStatus('Error');
            this.showError(error.message);
        }
    }

    async stopProcess() {
        try {
            console.log('⏹️ Stopping EasyApply process...');
            
            // Immediately stop UI and polling
            this.isRunning = false;
            this.updateStatus('Stopping...');
            this.updateUI();
            this.stopProgressPolling();
            this.stopJobListPolling();
            
            // Send stop message to background service worker
            console.log('📡 Sending stop message to background service worker...');
            const response = await chrome.runtime.sendMessage({
                type: 'stop_background_proccess' // This matches CONFIG.MESSAGE_TYPES.STOP_PROCESS
            });
            
            // Also send a force reset to ensure complete cleanup
            console.log('🔄 Sending force reset message...');
            const resetResponse = await chrome.runtime.sendMessage({
                type: 'forceResetState'
            });
            
            console.log('📡 Stop process response:', response);
            console.log('🔄 Force reset response:', resetResponse);
            
            if (response && response.success && resetResponse && resetResponse.success) {
                console.log('✅ Background service worker stopped and reset successfully');
                this.updateStatus('Stopped');
            } else {
                console.warn('⚠️ Background service worker response:', response);
                console.warn('⚠️ Force reset response:', resetResponse);
                this.updateStatus('Stopped (with warnings)');
            }
            
            // Ensure UI is properly reset
            this.updateUI();
            
            console.log('✅ Process stopped successfully');
            
        } catch (error) {
            console.error('❌ Error stopping process:', error);
            this.isRunning = false;
            this.updateStatus('Error');
            this.updateUI();
            this.showError('Failed to stop process');
        }
    }

    startProgressPolling() {
        console.log('🔄 Starting progress polling...');
        
        this.progressInterval = setInterval(async () => {
            if (!this.isRunning) {
                this.stopProgressPolling();
                return;
            }
            
            try {
                // Get current state from background service worker
                const response = await chrome.runtime.sendMessage({
                    type: 'getState'
                });
                
                if (response && response.state) {
                    console.log('📊 Progress update:', response.state);
                    this.updateProgressFromState(response.state);
                }
                
                // Get stats
                const statsResponse = await chrome.runtime.sendMessage({
                    type: 'getStats'
                });
                
                if (statsResponse && statsResponse.stats) {
                    console.log('📈 Stats update:', statsResponse.stats);
                    this.updateStatsFromResponse(statsResponse.stats);
                }
                
            } catch (error) {
                console.error('❌ Error polling progress:', error);
            }
        }, 2000); // Poll every 2 seconds
    }

    stopProgressPolling() {
        if (this.progressInterval) {
            console.log('🛑 Stopping progress polling...');
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgressFromState(state) {
        if (state.progress) {
            const { current, total, percentage } = state.progress;
            this.stats.total = total;
            this.stats.current = current;
            this.updateProgress();
        }
        
        if (state.currentJob) {
            this.updateCurrentJob(state.currentJob.title || `Job ${state.currentIndex + 1}`);
        }
        
        if (state.isRunning === false) {
            this.isRunning = false;
            this.updateStatus('Completed');
            this.updateUI();
            this.stopProgressPolling();
        }
    }

    updateStatsFromResponse(stats) {
        this.stats.applied = stats.appliedJobs || 0;
        this.stats.failed = stats.failedJobs || 0;
        this.stats.successRate = stats.successRate || 0;
        this.updateProgress();
    }

    updateUI() {
        const gatherBtn = document.getElementById('gather-jobs-btn');
        const applyBtn = document.getElementById('start-applications-btn');
        const stopBtn = document.getElementById('stop-process-btn');
        
        console.log('🔄 updateUI called - isRunning:', this.isRunning);
        console.log('🔄 Stop button element:', stopBtn);
        
        if (this.isRunning) {
            if (gatherBtn) gatherBtn.disabled = true;
            if (applyBtn) applyBtn.disabled = true;
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.textContent = '⏹️ Stop Process';
                console.log('✅ Stop button enabled and ready');
            } else {
                console.log('❌ Stop button element not found');
            }
        } else {
            if (gatherBtn) gatherBtn.disabled = false;
            if (applyBtn) applyBtn.disabled = false;
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.textContent = '⏹️ Stop Process (Not Running)';
                console.log('✅ Stop button disabled - no process running');
            }
        }
    }

    updateStatus(status) {
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.textContent = status;
    }

    updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const appliedCount = document.getElementById('applied-count');
        const failedCount = document.getElementById('failed-count');
        const successRate = document.getElementById('success-rate');
        
        const total = this.stats.total;
        const applied = this.stats.applied;
        const failed = this.stats.failed;
        
        if (progressFill) {
            const percentage = total > 0 ? (applied / total) * 100 : 0;
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) progressText.textContent = `${applied}/${total} jobs applied`;
        if (appliedCount) appliedCount.textContent = applied;
        if (failedCount) failedCount.textContent = failed;
        if (successRate) {
            const rate = total > 0 ? Math.round((applied / total) * 100) : 0;
            successRate.textContent = `${rate}%`;
        }
    }

    updateCurrentJob(jobName) {
        const currentJob = document.getElementById('current-job');
        const currentJobName = document.getElementById('current-job-name');
        
        if (currentJob && currentJobName) {
            currentJob.style.display = 'block';
            currentJobName.textContent = jobName;
        }
    }

    showError(message) {
        // Use shared UIUtils if available, otherwise fallback to local implementation
        if (typeof UIUtils !== 'undefined' && UIUtils.showError) {
            UIUtils.showError(message);
        } else {
            console.error('❌ Error:', message);
            alert(`Error: ${message}`);
        }
    }

    showSuccess(message) {
        // Use shared UIUtils if available, otherwise fallback to local implementation
        if (typeof UIUtils !== 'undefined' && UIUtils.showSuccess) {
            UIUtils.showSuccess(message);
        } else {
            console.log('✅ Success:', message);
            alert(`Success: ${message}`);
        }
    }

    setupDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = this.debugMode ? 'block' : 'none';
        }
    }
    
    setupMessageListener() {
        // Listen for progress updates from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'applicationProgressUpdate') {
                console.log('📊 Received progress update:', message.data);
                this.updateStatus(message.data.status);
            }
            sendResponse({ success: true });
        });
    }

    toggleDebugPanel() {
        this.debugMode = !this.debugMode;
        this.setupDebugPanel();
        console.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    }

    async updateDebugInfo() {
        const windowStatusSpan = document.getElementById('window-status');
        const extensionIdSpan = document.getElementById('extension-id');
        const storageStatusSpan = document.getElementById('storage-status');
        const linkedinTabSpan = document.getElementById('linkedin-tab');

        if (windowStatusSpan) windowStatusSpan.textContent = 'Active';
        if (extensionIdSpan) extensionIdSpan.textContent = chrome.runtime.id;

        try {
            await chrome.storage.local.get(null);
            if (storageStatusSpan) storageStatusSpan.textContent = 'Available';
        } catch (e) {
            if (storageStatusSpan) storageStatusSpan.textContent = `Error: ${e.message}`;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (linkedinTabSpan) {
                if (tab && tab.url.includes('linkedin.com/jobs')) {
                    linkedinTabSpan.textContent = `Found: ${tab.url.substring(0, 30)}...`;
                    linkedinTabSpan.style.color = '#10b981';
                } else if (tab && tab.url.includes('linkedin.com')) {
                    linkedinTabSpan.textContent = `LinkedIn (not job): ${tab.url.substring(0, 30)}...`;
                    linkedinTabSpan.style.color = '#f59e0b';
                } else {
                    linkedinTabSpan.textContent = 'Not on LinkedIn';
                    linkedinTabSpan.style.color = '#ef4444';
                }
            }
        } catch (e) {
            if (linkedinTabSpan) {
                linkedinTabSpan.textContent = `Error: ${e.message}`;
                linkedinTabSpan.style.color = '#ef4444';
            }
        }
    }

    startDebugUpdates() {
        setInterval(() => this.updateDebugInfo(), 2000);
    }

    startJobListPolling() {
        console.log('🔄 Starting job list polling...');
        
        this.jobListInterval = setInterval(async () => {
            if (!this.isRunning) {
                this.stopJobListPolling();
                return;
            }
            
            try {
                // Get current job list from background service worker
                const response = await chrome.runtime.sendMessage({
                    type: 'getJobList'
                });
                
                if (response && response.jobs) {
                    console.log('📋 Job list update:', response.jobs);
                    this.updateJobList(response.jobs);
                    
                    // Note: Single application button is always enabled (doesn't need gathered jobs)
                    // Bulk applications would need gathered jobs, but we're using single application
                }
                
                // Check if gathering is complete
                if (response && response.gatheringComplete) {
                    this.isRunning = false;
                    this.updateStatus('Jobs gathered');
                    this.updateUI();
                    this.stopJobListPolling();
                    
                    // Show the job list
                    this.showJobList();
                    
                    // Show success message
                    this.showSuccess(`✅ Successfully gathered ${response.jobs.length} jobs!`);
                }
                
            } catch (error) {
                console.error('❌ Error polling job list:', error);
            }
        }, 2000); // Poll every 2 seconds
    }

    stopJobListPolling() {
        if (this.jobListInterval) {
            console.log('🛑 Stopping job list polling...');
            clearInterval(this.jobListInterval);
            this.jobListInterval = null;
        }
    }

    updateJobList(jobs) {
        const jobListContainer = document.getElementById('job-list');
        const emptyContainer = document.getElementById('job-list-empty');
        const jobCount = document.getElementById('job-count');
        
        if (!jobListContainer || !emptyContainer) return;
        
        if (jobs.length === 0) {
            jobListContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            if (jobCount) jobCount.textContent = '0 jobs';
            return;
        }
        
        jobListContainer.style.display = 'block';
        emptyContainer.style.display = 'none';
        
        if (jobCount) jobCount.textContent = `${jobs.length} jobs`;
        
        jobListContainer.innerHTML = jobs.map((job, index) => `
            <div class="bg-slate-50 rounded p-2 border border-slate-200">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="text-xs font-medium text-slate-700 mb-1">${job.title || 'Unknown Title'}</div>
                        <div class="text-xs text-slate-500">${job.company || 'Unknown Company'}</div>
                        <div class="text-xs text-slate-400">${job.location || 'Unknown Location'}</div>
                    </div>
                    <div class="text-xs text-slate-400">#${index + 1}</div>
                </div>
            </div>
        `).join('');
    }

    showJobList() {
        // Show job list section (it's already visible in the current HTML structure)
        const jobList = document.getElementById('job-list');
        const jobListEmpty = document.getElementById('job-list-empty');
        
        if (jobList) jobList.style.display = 'block';
        if (jobListEmpty) jobListEmpty.style.display = 'none';
    }

    showSettings() {
        // Show settings form (it's already visible in the current HTML structure)
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) settingsForm.style.display = 'block';
    }

    toggleSettings() {
        const settingsForm = document.getElementById('settings-form');
        const progressSection = document.getElementById('progress-section');
        
        if (settingsForm && progressSection) {
            if (settingsForm.style.display === 'none') {
                settingsForm.style.display = 'block';
                progressSection.style.display = 'none';
            } else {
                settingsForm.style.display = 'none';
                progressSection.style.display = 'block';
            }
        }
    }

    showLoadingOverlay(text = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        
        if (overlay) overlay.style.display = 'flex';
        if (loadingText) loadingText.textContent = text;
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // Helper functions for storage - using shared StorageUtils
    async getStorageData(key) {
        // Use shared StorageUtils if available, otherwise fallback to local implementation
        if (typeof StorageUtils !== 'undefined' && StorageUtils.getStorageData) {
            return await StorageUtils.getStorageData(key);
        }
        
        // Fallback implementation
        return new Promise((resolve) => {
            chrome.storage.local.get(key, (result) => {
                resolve(result[key]);
            });
        });
    }

    async setStorageData(key, value) {
        // Use shared StorageUtils if available, otherwise fallback to local implementation
        if (typeof StorageUtils !== 'undefined' && StorageUtils.setStorageData) {
            return await StorageUtils.setStorageData(key, value);
        }
        
        // Fallback implementation
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    // Additional methods for the new buttons
    async fetchAllDescriptions() {
        try {
            console.log('📄 Fetching all job descriptions...');
            this.showSuccess('Fetch all descriptions functionality coming soon!');
        } catch (error) {
            console.error('❌ Error fetching all descriptions:', error);
            this.showError(error.message);
        }
    }

    async viewFieldHistory() {
        try {
            console.log('📋 Viewing field history...');
            this.showSuccess('Field history functionality coming soon!');
        } catch (error) {
            console.error('❌ Error viewing field history:', error);
            this.showError(error.message);
        }
    }

    async testButtonDetection() {
        try {
            console.log('🔍 Testing button detection...');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'testButtonDetection'
            });
            
            if (response && response.success) {
                this.showSuccess('Button detection test completed - check console');
            } else {
                this.showError(response?.error || 'Button detection test failed');
            }
            
        } catch (error) {
            console.error('❌ Error testing button detection:', error);
            this.showError('Failed to test button detection');
        }
    }

    async testEasyApplyButton() {
        try {
            console.log('🔍 Testing Easy Apply button detection...');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'testEasyApplyButton'
            });
            
            if (response && response.success) {
                this.showSuccess('Easy Apply button found - check console for details');
                console.log('✅ Easy Apply button details:', response.buttonDetails);
            } else {
                this.showError(response?.error || response?.message || 'Easy Apply button not found');
            }
            
        } catch (error) {
            console.error('❌ Error testing Easy Apply button:', error);
            this.showError(error.message);
        }
    }

    async debugNextButton() {
        try {
            console.log('🔍 Debugging Next button detection...');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'debugNextButton'
            });
            
            if (response && response.success) {
                this.showSuccess('Next button debug completed - check console');
            } else {
                this.showError(response?.message || 'Next button debug failed');
            }
            
        } catch (error) {
            console.error('❌ Error debugging Next button:', error);
            this.showError('Failed to debug Next button');
        }
    }

    async debugFormDetection() {
        try {
            console.log('🔍 Debugging form detection...');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'debugFormDetection'
            });
            
            if (response && response.success) {
                this.showSuccess('Form detection debug completed - check console');
            } else {
                this.showError(response?.message || 'Form detection debug failed');
            }
            
        } catch (error) {
            console.error('❌ Error debugging form detection:', error);
            this.showError('Failed to debug form detection');
        }
    }

    async debugFieldHistory() {
        try {
            console.log('📋 Debugging field history...');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showError('No active tab found');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'debugFieldHistory'
            });
            
            if (response && response.success) {
                this.showSuccess('Field history debug completed - check console');
            } else {
                this.showError(response?.message || 'Field history debug failed');
            }
            
        } catch (error) {
            console.error('❌ Error debugging field history:', error);
            this.showError('Failed to debug field history');
        }
    }

    async pingContentScript() {
        try {
            console.log('📡 Pinging content script...');
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url.includes('linkedin.com')) {
                this.showError('Please navigate to LinkedIn first');
                return;
            }
            
            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'ping'
            });
            
            if (response) {
                this.showSuccess('✅ Content script is active and responding!');
            } else {
                this.showError('❌ Content script not responding');
            }
            
        } catch (error) {
            console.error('❌ Error pinging content script:', error);
            this.showError('Content script not available or not responding');
        }
    }

    async toggleAutoMode() {
        try {
            console.log('🔄 Toggling auto mode...');
            this.showSuccess('Auto mode toggle functionality coming soon!');
        } catch (error) {
            console.error('❌ Error toggling auto mode:', error);
            this.showError(error.message);
        }
    }

    async viewProblematicFields() {
        try {
            console.log('⚠️ Viewing problematic fields...');
            this.showSuccess('Problematic fields viewer functionality coming soon!');
        } catch (error) {
            console.error('❌ Error viewing problematic fields:', error);
            this.showError(error.message);
        }
    }

    // Placeholder methods for future functionality
    async saveJobDescription(jobData) {
        console.log('💾 Saving job description:', jobData);
    }

    generateJobId(text) {
        // Use shared JobUtils if available, otherwise fallback to local implementation
        if (typeof JobUtils !== 'undefined' && JobUtils.generateJobId) {
            return JobUtils.generateJobId(text);
        }
        
        // Fallback implementation
        return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    }


}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.easyApplySidePanel = new EasyApplySidePanel();
});