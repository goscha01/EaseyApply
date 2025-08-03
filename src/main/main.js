// EasyApply Main Window JavaScript
class EasyApplyMainWindow {
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
        document.getElementById('start-btn')?.addEventListener('click', () => this.startProcess());
        document.getElementById('stop-btn')?.addEventListener('click', () => this.stopProcess());
        document.getElementById('settings-btn')?.addEventListener('click', () => this.toggleSettings());

        // Job description tools
        document.getElementById('fetch-description-btn')?.addEventListener('click', () => this.fetchJobDescription());
        document.getElementById('open-description-btn')?.addEventListener('click', () => this.openDescriptionWindow());
        document.getElementById('view-saved-btn')?.addEventListener('click', () => this.showSavedDescriptions());
        document.getElementById('back-to-settings-btn')?.addEventListener('click', () => this.showSettings());

        // Form inputs
        const inputs = ['skills', 'job_location', 'job_count', 'delay', 'job_type'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.saveSettings());
        });

        // Debug panel
        document.getElementById('toggle-debug')?.addEventListener('click', () => this.toggleDebugPanel());
    }

    validateForm() {
        const skills = document.getElementById('skills')?.value?.trim();
        const jobCount = parseInt(document.getElementById('job_count')?.value || '0');
        const delay = parseInt(document.getElementById('delay')?.value || '0');

        if (!skills) {
            this.showError('Please enter a skill or job title');
            return false;
        }

        if (jobCount < 1 || jobCount > 50) {
            this.showError('Job count must be between 1 and 50');
            return false;
        }

        if (delay < 1 || delay > 10) {
            this.showError('Delay must be between 1 and 10 seconds');
            return false;
        }

        return true;
    }

    async loadSettings() {
        try {
            const settings = await this.getStorageData('settings') || {};
            
            // Set form values
            if (settings.skills) document.getElementById('skills').value = settings.skills;
            if (settings.job_location) document.getElementById('job_location').value = settings.job_location;
            if (settings.job_count) document.getElementById('job_count').value = settings.job_count;
            if (settings.delay) document.getElementById('delay').value = settings.delay;
            if (settings.job_type) document.getElementById('job_type').value = settings.job_type;
            
            console.log('✅ Settings loaded successfully');
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
            skills: document.getElementById('skills')?.value || '',
            job_location: document.getElementById('job_location')?.value || '',
            job_count: parseInt(document.getElementById('job_count')?.value || '10'),
            delay: parseInt(document.getElementById('delay')?.value || '2'),
            job_type: document.getElementById('job_type')?.value || ''
        };
    }

    validateSettings() {
        const data = this.getFormData();
        
        if (!data.skills.trim()) {
            throw new Error('Skills/Job title is required');
        }
        
        if (data.job_count < 1 || data.job_count > 50) {
            throw new Error('Job count must be between 1 and 50');
        }
        
        if (data.delay < 1 || data.delay > 10) {
            throw new Error('Delay must be between 1 and 10 seconds');
        }
        
        return data;
    }

    async startProcess() {
        try {
            if (!this.validateForm()) return;
            
            const settings = this.validateSettings();
            this.isRunning = true;
            this.updateUI();
            this.updateStatus('Starting...');
            
            // Save settings
            await this.saveSettings();
            
            // Start the automation process
            console.log('🚀 Starting EasyApply process with settings:', settings);
            
            // Simulate process for now
            this.simulateProcess(settings);
            
        } catch (error) {
            console.error('❌ Error starting process:', error);
            this.showError(error.message);
            this.updateStatus('Error');
        }
    }

    async stopProcess() {
        this.isRunning = false;
        this.updateStatus('Stopped');
        this.updateUI();
        console.log('⏹️ Process stopped by user');
    }

    simulateProcess(settings) {
        let currentJob = 0;
        const totalJobs = settings.job_count;
        
        const interval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }
            
            currentJob++;
            this.stats.total = currentJob;
            
            // Simulate success/failure
            if (Math.random() > 0.3) {
                this.stats.applied++;
            } else {
                this.stats.failed++;
            }
            
            this.updateProgress();
            this.updateCurrentJob(`Job ${currentJob} of ${totalJobs}`);
            
            if (currentJob >= totalJobs) {
                clearInterval(interval);
                this.isRunning = false;
                this.updateStatus('Completed');
                this.updateUI();
            }
        }, settings.delay * 1000);
    }

    async fetchJobDescription() {
        try {
            this.showLoadingOverlay('Extracting job description...');
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url.includes('linkedin.com/jobs')) {
                throw new Error('Please navigate to a LinkedIn job page first');
            }
            
            // Inject and execute the description extractor
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/utils/description-extractor.js']
            });
            
            if (!results || !results[0] || !results[0].result) {
                throw new Error('Failed to extract job description');
            }
            
            const jobData = results[0].result;
            
            if (!jobData || !jobData.description) {
                throw new Error('Could not extract job description from this page');
            }
            
            // Save the job description
            await this.saveJobDescription(jobData);
            
            // Enable the open button
            document.getElementById('open-description-btn').disabled = false;
            
            this.hideLoadingOverlay();
            console.log('✅ Job description extracted successfully:', jobData);
            
        } catch (error) {
            console.error('❌ Error fetching job description:', error);
            this.hideLoadingOverlay();
            this.showError(error.message);
        }
    }

    async openDescriptionWindow() {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            if (savedDescriptions.length === 0) {
                this.showError('No job descriptions available. Please fetch one first.');
                return;
            }
            
            // Open the most recent description in a new window
            const latestDescription = savedDescriptions[savedDescriptions.length - 1];
            
            const descriptionWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
            if (descriptionWindow) {
                descriptionWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Job Description - ${latestDescription.title}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                            .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
                            .company { font-size: 18px; color: #64748b; margin-bottom: 20px; }
                            .description { background: #f8fafc; padding: 20px; border-radius: 8px; }
                            .meta { margin-bottom: 20px; color: #64748b; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="title">${latestDescription.title}</div>
                            <div class="company">${latestDescription.company}</div>
                            <div class="meta">${latestDescription.location} • ${latestDescription.date}</div>
                        </div>
                        <div class="description">${latestDescription.description}</div>
                    </body>
                    </html>
                `);
                descriptionWindow.document.close();
            }
            
        } catch (error) {
            console.error('❌ Error opening description window:', error);
            this.showError('Failed to open description window');
        }
    }

    async showSavedDescriptions() {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            
            // Hide settings form and show saved descriptions
            document.getElementById('settings-form').style.display = 'none';
            document.getElementById('saved-descriptions-section').style.display = 'block';
            
            this.renderSavedDescriptions(savedDescriptions);
            
        } catch (error) {
            console.error('❌ Error loading saved descriptions:', error);
            this.showError('Failed to load saved descriptions');
        }
    }

    async saveJobDescription(jobData) {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            
            // Create unique ID for the job
            const jobId = this.generateJobId(jobData.title + jobData.company);
            
            // Check if job already exists
            const existingIndex = savedDescriptions.findIndex(job => job.id === jobId);
            
            const jobDescription = {
                id: jobId,
                title: jobData.title || 'Unknown Position',
                company: jobData.company || 'Unknown Company',
                location: jobData.location || 'Unknown Location',
                description: jobData.description || 'No description available',
                date: new Date().toLocaleDateString(),
                timestamp: Date.now()
            };
            
            if (existingIndex >= 0) {
                // Update existing job
                savedDescriptions[existingIndex] = jobDescription;
            } else {
                // Add new job (limit to 20 saved descriptions)
                savedDescriptions.unshift(jobDescription);
                if (savedDescriptions.length > 20) {
                    savedDescriptions.pop();
                }
            }
            
            await this.setStorageData('savedJobDescriptions', savedDescriptions);
            console.log('✅ Job description saved successfully');
            
        } catch (error) {
            console.error('❌ Error saving job description:', error);
            throw error;
        }
    }

    generateJobId(text) {
        // Use shared JobUtils if available, otherwise fallback to local implementation
        if (typeof JobUtils !== 'undefined' && JobUtils.generateJobId) {
            return JobUtils.generateJobId(text);
        }
        
        // Fallback implementation
        return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    }

    renderSavedDescriptions(descriptions) {
        const container = document.getElementById('saved-descriptions-list');
        const emptyState = document.getElementById('saved-descriptions-empty');
        
        if (!container) return;
        
        if (descriptions.length === 0) {
            container.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        container.innerHTML = descriptions.map(job => `
            <div class="saved-job-item">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <div class="font-semibold text-slate-900">${job.title}</div>
                        <div class="text-blue-600">${job.company}</div>
                        <div class="text-sm text-slate-500">${job.location} • ${job.date}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.easyApply.openSavedJobDescription('${job.id}')" 
                                class="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
                            📄 View
                        </button>
                        <button onclick="window.easyApply.deleteSavedJobDescription('${job.id}')" 
                                class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="text-sm text-slate-700 line-clamp-3">${job.description.substring(0, 200)}...</div>
            </div>
        `).join('');
    }

    async openSavedJobDescription(jobId) {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            const job = savedDescriptions.find(j => j.id === jobId);
            
            if (!job) {
                this.showError('Job description not found');
                return;
            }
            
            const descriptionWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
            if (descriptionWindow) {
                descriptionWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Job Description - ${job.title}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
                            .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
                            .company { font-size: 18px; color: #64748b; margin-bottom: 20px; }
                            .description { background: #f8fafc; padding: 20px; border-radius: 8px; }
                            .meta { margin-bottom: 20px; color: #64748b; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="title">${job.title}</div>
                            <div class="company">${job.company}</div>
                            <div class="meta">${job.location} • ${job.date}</div>
                        </div>
                        <div class="description">${job.description}</div>
                    </body>
                    </html>
                `);
                descriptionWindow.document.close();
            }
            
        } catch (error) {
            console.error('❌ Error opening saved job description:', error);
            this.showError('Failed to open job description');
        }
    }

    async deleteSavedJobDescription(jobId) {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            const updatedDescriptions = savedDescriptions.filter(job => job.id !== jobId);
            await this.setStorageData('savedJobDescriptions', updatedDescriptions);
            
            // Re-render the list
            this.renderSavedDescriptions(updatedDescriptions);
            
            console.log('✅ Job description deleted successfully');
            
        } catch (error) {
            console.error('❌ Error deleting job description:', error);
            this.showError('Failed to delete job description');
        }
    }

    showSettings() {
        document.getElementById('settings-form').style.display = 'block';
        document.getElementById('saved-descriptions-section').style.display = 'none';
        document.getElementById('progress-section').style.display = 'none';
    }

    toggleSettings() {
        const settingsForm = document.getElementById('settings-form');
        const progressSection = document.getElementById('progress-section');
        
        if (settingsForm.style.display === 'none') {
            this.showSettings();
        } else {
            settingsForm.style.display = 'none';
            progressSection.style.display = 'block';
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

    updateUI() {
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (this.isRunning) {
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-block';
        } else {
            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
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
            // You can implement a toast notification here
            alert(`Error: ${message}`);
        }
    }

    setupDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = this.debugMode ? 'block' : 'none';
        }
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
                    linkedinTabSpan.textContent = `Found: ${tab.url.substring(0, 50)}...`;
                    linkedinTabSpan.style.color = '#10b981';
                } else if (tab && tab.url.includes('linkedin.com')) {
                    linkedinTabSpan.textContent = `LinkedIn (not job page): ${tab.url.substring(0, 50)}...`;
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.easyApply = new EasyApplyMainWindow();
}); 